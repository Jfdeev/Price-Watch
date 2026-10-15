import { writeFileSync } from "node:fs";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { prisma } from "../src/prisma/client";
import { upsertProductsBatch } from "../src/services/productBatchUpsert";
import {
  createProduct,
  findDeletedProductUrls,
  searchProducts
} from "../src/services/productService";
import { normalizeProductUrl } from "../src/services/productUrl";
import {
  findFavoriteForProduct,
  findFavoritesForProducts,
  listFavorites
} from "../src/services/favoriteService";
import {
  createProduct as legacyCreateProduct,
  searchProducts as legacySearchProducts,
  upsertProduct as legacyUpsertProduct
} from "./legacy/productService";
import { legacyFavoriteForProduct, legacyFavoritesByProduct } from "./legacy/favoriteLookup";
import { legacyDeletedProductUrls } from "./legacy/deletedProductUrls";
import { resetDatabase, seedProducts } from "./support/database";
import { startFakeSerpApi, useFakeSerpApi, type FakeSerpApi } from "./support/fakeSerpApi";
import { log, measure, repetitionsFor, writeCsv, type CsvRow } from "./support/measure";
import { attachQueryCounter } from "./support/queryCounter";
import {
  BASE_TIME,
  generateSearchScenario,
  generateUpsertScenario,
  SEARCH_QUERY,
  type SearchScenarioOptions
} from "./support/scenarios";

const SEED = 20261014;
const LEGACY_SIZES = [10, 100, 1_000, 10_000];
const ALL_SIZES = [10, 100, 1_000, 10_000, 100_000];

type Version = "antes" | "depois";

function sizesFor(version: Version, legacyLimit: number[] = LEGACY_SIZES): number[] {
  return version === "antes" ? legacyLimit : ALL_SIZES;
}

async function benchUpsert(): Promise<CsvRow[]> {
  const rows: CsvRow[] = [];
  for (const version of ["antes", "depois"] as const) {
    for (const n of sizesFor(version)) {
      const scenario = generateUpsertScenario(SEED + n, {
        existing: n,
        incoming: n,
        existingRate: 0.5,
        duplicateRate: 0,
        samePriceRate: 0.2
      });
      const run =
        version === "antes"
          ? () => Promise.allSettled(scenario.input.map((product) => legacyUpsertProduct(product)))
          : () => upsertProductsBatch(scenario.input);
      const sample = await measure(run, {
        ...repetitionsFor(n),
        prepare: async () => {
          await resetDatabase();
          await seedProducts(scenario.products);
        }
      });
      const row = {
        funcao: "F1",
        versao: version,
        n,
        mediana_ms: sample.ms,
        consultas: sample.queries
      };
      log(row);
      rows.push(row);
    }
  }
  return rows;
}

const SEARCH_BASE: SearchScenarioOptions = {
  matchingLocals: 5,
  otherLocals: 0,
  deletedProducts: 0,
  serpItems: 24,
  overlapRate: 0.2,
  deletedHitRate: 0.3,
  manualRate: 0.1,
  duplicateRate: 0,
  newMatchingItems: 0,
  totalResults: undefined,
  nextLink: false
};

async function benchSearch(
  api: FakeSerpApi,
  functionName: string,
  limit: number,
  options: (n: number) => Partial<SearchScenarioOptions>,
  legacySizes: number[]
): Promise<CsvRow[]> {
  const rows: CsvRow[] = [];
  for (const version of ["antes", "depois"] as const) {
    for (const n of sizesFor(version, legacySizes)) {
      const scenario = generateSearchScenario(SEED + n, { ...SEARCH_BASE, ...options(n) });
      const search = version === "antes" ? legacySearchProducts : searchProducts;
      const sample = await measure(() => search(SEARCH_QUERY, 1, limit), {
        ...repetitionsFor(n),
        prepare: async () => {
          await resetDatabase();
          await seedProducts(scenario.products);
          api.setResponse(scenario.serp);
        }
      });
      const row = {
        funcao: functionName,
        versao: version,
        n,
        mediana_ms: sample.ms,
        consultas: sample.queries
      };
      log(row);
      rows.push(row);
    }
  }
  return rows;
}

const PAGE_SIZE = 24;

function pageUrls(size: number): string[] {
  return Array.from({ length: PAGE_SIZE }, (_, index) =>
    index % 3 === 0 && size > 0
      ? `HTTPS://LOJA.BENCH/EXCLUIDO/${(index * 7919) % size}#detalhes`
      : `https://outra.bench/item/${index}`
  );
}

async function benchDeletedUrls(): Promise<CsvRow[]> {
  const rows: CsvRow[] = [];
  for (const n of ALL_SIZES) {
    await resetDatabase();
    await seedProducts(
      Array.from({ length: n }, (_, index) => ({
        externalId: `excluido-${index}`,
        name: `Produto excluido ${index}`,
        price: 10,
        productUrl: `https://loja.bench/excluido/${index}`,
        isDeleted: true,
        createdAt: new Date(BASE_TIME - index * 1_000)
      }))
    );
    await prisma.$executeRawUnsafe('ANALYZE "Product"');
    const urls = pageUrls(n);
    const normalized = urls.map((url) => normalizeProductUrl(url));
    const versions = [
      [
        "antes",
        async () => {
          const deleted = await legacyDeletedProductUrls();
          return normalized.filter((url) => url && deleted.has(url));
        }
      ],
      [
        "depois",
        async () => {
          const deleted = await findDeletedProductUrls(normalized);
          return normalized.filter((url) => url && deleted.has(url));
        }
      ]
    ] as const;
    const expected = await versions[0][1]();
    const actual = await versions[1][1]();
    if (JSON.stringify(expected) !== JSON.stringify(actual)) {
      throw new Error(`F2 divergiu para n=${n}`);
    }
    for (const [version, run] of versions) {
      const sample = await measure(run, repetitionsFor(n));
      const row = {
        funcao: "F2",
        versao: version,
        n,
        mediana_ms: sample.ms,
        consultas: sample.queries
      };
      log(row);
      rows.push(row);
    }
  }
  return rows;
}

async function seedStores(size: number): Promise<string> {
  await resetDatabase();
  await prisma.user.createMany({
    data: [
      { id: "u1", email: "u1@bench.local", password: "x" },
      { id: "u2", email: "u2@bench.local", password: "x" }
    ]
  });
  const chunk = 10_000;
  for (let start = 0; start < size; start += chunk) {
    const count = Math.min(chunk, size - start);
    await prisma.store.createMany({
      data: Array.from({ length: count }, (_, offset) => {
        const index = start + offset;
        return {
          name: `Loja Benchmark ${index}`,
          website: `https://loja${index}.bench`,
          contactEmail: `loja${index}@bench.local`,
          userId: index % 2 === 0 ? "u1" : "u2",
          isActive: index % 10 !== 0
        };
      })
    });
  }
  await prisma.$executeRawUnsafe('ANALYZE "Store"');
  return `loja benchmark ${size - 2 - ((size - 2) % 2)}`;
}

async function explainStoreLookups(storeName: string): Promise<string> {
  const plans: string[] = [];
  const statements: Array<[string, Prisma.Sql]> = [
    [
      "antes: findMany de todas as lojas ativas",
      Prisma.sql`SELECT "name" FROM "Store" WHERE "isActive" = true`
    ],
    [
      "antes: loja ativa do usuário por ILIKE",
      Prisma.sql`SELECT "id" FROM "Store" WHERE "name" ILIKE ${storeName} AND "userId" = ${"u1"} AND "isActive" = true LIMIT 1`
    ],
    [
      "depois: existe loja ativa",
      Prisma.sql`SELECT 1 AS found FROM "Store" WHERE "isActive" LIMIT 1`
    ],
    [
      "depois: loja ativa pelo nome",
      Prisma.sql`SELECT 1 AS found FROM "Store" WHERE "isActive" AND lower("name") = lower(${storeName}) LIMIT 1`
    ],
    [
      "depois: loja ativa do usuário pelo nome",
      Prisma.sql`SELECT 1 AS found FROM "Store" WHERE "isActive" AND lower("name") = lower(${storeName}) AND "userId" = ${"u1"} LIMIT 1`
    ]
  ];
  for (const [title, statement] of statements) {
    const result = await prisma.$queryRaw<Array<{ "QUERY PLAN": string }>>(
      Prisma.sql`EXPLAIN (ANALYZE, BUFFERS, TIMING OFF) ${statement}`
    );
    plans.push(`-- ${title}\n${result.map((line) => line["QUERY PLAN"]).join("\n")}`);
  }
  return plans.join("\n\n");
}

async function benchCreateProduct(): Promise<CsvRow[]> {
  const rows: CsvRow[] = [];
  for (const n of ALL_SIZES) {
    const storeName = await seedStores(n);
    for (const version of ["antes", "depois"] as const) {
      const create = version === "antes" ? legacyCreateProduct : createProduct;
      const sample = await measure(
        () => create({ name: "Produto", price: 10, storeName, ownerUserId: "u1" }),
        repetitionsFor(n)
      );
      const row = {
        funcao: "F3",
        versao: version,
        n,
        mediana_ms: sample.ms,
        consultas: sample.queries
      };
      log(row);
      rows.push(row);
    }
    if (n === ALL_SIZES[ALL_SIZES.length - 1]) {
      const target = path.join(
        __dirname,
        "..",
        "..",
        "docs",
        "complexidade",
        "dados",
        "f3_explain.txt"
      );
      writeFileSync(target, `${await explainStoreLookups(storeName)}\n`);
    }
  }
  return rows;
}

async function seedFavorites(size: number): Promise<string[]> {
  await resetDatabase();
  await prisma.user.createMany({ data: [{ id: "u1", email: "u1@bench.local", password: "x" }] });
  const ids = await seedProducts(
    Array.from({ length: size + 8 }, (_, index) => ({
      externalId: `fav-${index}`,
      name: `Produto favorito ${index}`,
      price: 10 + (index % 100),
      productUrl: `https://loja.bench/produto/${index}`,
      imageUrl: `https://img.bench/${index}.png`,
      storeName: "Loja Benchmark",
      category: "Informatica",
      createdAt: new Date(BASE_TIME - index * 1_000)
    }))
  );
  const productIds = Array.from(ids.values());
  const chunk = 10_000;
  for (let start = 0; start < size; start += chunk) {
    await prisma.favorite.createMany({
      data: productIds.slice(start, Math.min(size, start + chunk)).map((productId) => ({
        productId,
        userId: "u1",
        userName: "Aluno PriceWatch"
      }))
    });
  }
  return [...productIds.slice(Math.max(0, size - 4), size), ...productIds.slice(size, size + 4)];
}

function bytesOf(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value));
}

async function benchFavorites(): Promise<{ single: CsvRow[]; page: CsvRow[] }> {
  const single: CsvRow[] = [];
  const page: CsvRow[] = [];
  for (const n of ALL_SIZES) {
    const pageIds = await seedFavorites(n);
    const target = pageIds[0];
    const legacyPayload = bytesOf(await listFavorites("u1"));
    const versions = [
      {
        version: "antes",
        one: () => legacyFavoriteForProduct("u1", target),
        many: () => legacyFavoritesByProduct("u1", pageIds),
        oneBytes: legacyPayload,
        manyBytes: legacyPayload
      },
      {
        version: "depois",
        one: () => findFavoriteForProduct("u1", target),
        many: () => findFavoritesForProducts("u1", pageIds),
        oneBytes: bytesOf(await findFavoriteForProduct("u1", target)),
        manyBytes: bytesOf(await findFavoritesForProducts("u1", pageIds))
      }
    ];
    for (const entry of versions) {
      const one = await measure(entry.one, repetitionsFor(n));
      const many = await measure(entry.many, repetitionsFor(n));
      const singleRow = {
        funcao: "F4",
        versao: entry.version,
        n,
        mediana_ms: one.ms,
        consultas: one.queries,
        bytes: entry.oneBytes
      };
      const pageRow = {
        funcao: "F5",
        versao: entry.version,
        n,
        mediana_ms: many.ms,
        consultas: many.queries,
        bytes: entry.manyBytes
      };
      log(singleRow);
      log(pageRow);
      single.push(singleRow);
      page.push(pageRow);
    }
  }
  return { single, page };
}

export async function runSuites(selected: string[]): Promise<void> {
  attachQueryCounter();
  const wants = (name: string) => selected.length === 0 || selected.includes(name);
  const api = await startFakeSerpApi();
  useFakeSerpApi(api);
  try {
    if (wants("f1")) {
      console.warn(writeCsv("f1_upsert_lote.csv", await benchUpsert()));
    }
    if (wants("f2")) {
      console.warn(writeCsv("f2_produtos_excluidos.csv", await benchDeletedUrls()));
    }
    if (wants("f2-busca")) {
      const rows = await benchSearch(
        api,
        "F2",
        PAGE_SIZE,
        (n) => ({ deletedProducts: n }),
        ALL_SIZES
      );
      console.warn(writeCsv("f2_busca_completa.csv", rows));
    }
    if (wants("f3")) {
      console.warn(writeCsv("f3_create_product.csv", await benchCreateProduct()));
    }
    if (wants("f4") || wants("f5")) {
      const { single, page } = await benchFavorites();
      console.warn(writeCsv("f4_favorito_produto.csv", single));
      console.warn(writeCsv("f5_favoritos_pagina.csv", page));
    }
    if (wants("f6")) {
      const rows = await benchSearch(
        api,
        "F6",
        8,
        (n) => ({
          matchingLocals: n,
          serpItems: 8,
          deletedHitRate: 0,
          overlapRate: 0.25
        }),
        LEGACY_SIZES
      );
      console.warn(writeCsv("f6_produtos_locais.csv", rows));
    }
  } finally {
    await api.close();
    await prisma.$disconnect();
  }
}
