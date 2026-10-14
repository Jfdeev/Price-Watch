import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma/client";
import type { ProductDTO } from "./productService";
import { toNormalizedProductUrlColumn } from "./productUrl";

export type ExistingProductRow = {
  id: string;
  externalId: string;
  name: string;
  price: Prisma.Decimal | number;
  imageUrl: string | null;
  productUrl: string | null;
  normalizedProductUrl: string | null;
  storeName: string | null;
  category: string | null;
  isManual: boolean;
  isDeleted: boolean;
};

export type PlannedProductRow = {
  id: string;
  externalId: string;
  name: string;
  price: number;
  imageUrl: string | null;
  productUrl: string | null;
  normalizedProductUrl: string | null;
  storeName: string | null;
  category: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PlannedHistoryRow = {
  id: string;
  externalId: string;
  oldPrice: number;
  newPrice: number;
  capturedAt: Date;
};

export type UpsertBatchPlan = {
  inserts: PlannedProductRow[];
  updates: PlannedProductRow[];
  history: PlannedHistoryRow[];
};

type ProductState = PlannedProductRow & { frozen: boolean; isNew: boolean; touched: boolean };

function keepWhenUndefined<T>(next: T | undefined, current: T): T {
  return next === undefined ? current : next;
}

function stateFromExisting(row: ExistingProductRow, now: Date): ProductState {
  return {
    id: row.id,
    externalId: row.externalId,
    name: row.name,
    price: Number(row.price),
    imageUrl: row.imageUrl,
    productUrl: row.productUrl,
    normalizedProductUrl: row.normalizedProductUrl,
    storeName: row.storeName,
    category: row.category,
    createdAt: now,
    updatedAt: now,
    frozen: row.isManual || row.isDeleted,
    isNew: false,
    touched: false
  };
}

function createdState(product: ProductDTO, timestamp: Date): ProductState {
  return {
    id: randomUUID(),
    externalId: product.externalId,
    name: product.name,
    price: product.price,
    imageUrl: product.imageUrl ?? null,
    productUrl: product.productUrl ?? null,
    normalizedProductUrl: toNormalizedProductUrlColumn(product.productUrl),
    storeName: product.storeName ?? null,
    category: product.category ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
    frozen: false,
    isNew: true,
    touched: true
  };
}

function applyUpdate(state: ProductState, product: ProductDTO, timestamp: Date): void {
  state.name = product.name;
  state.price = product.price;
  state.imageUrl = keepWhenUndefined(product.imageUrl, state.imageUrl);
  if (product.productUrl !== undefined) {
    state.productUrl = product.productUrl;
    state.normalizedProductUrl = toNormalizedProductUrlColumn(product.productUrl);
  }
  state.storeName = keepWhenUndefined(product.storeName, state.storeName);
  state.category = keepWhenUndefined(product.category, state.category);
  state.updatedAt = timestamp;
  state.touched = true;
}

function toPlannedRow(state: ProductState): PlannedProductRow {
  return {
    id: state.id,
    externalId: state.externalId,
    name: state.name,
    price: state.price,
    imageUrl: state.imageUrl,
    productUrl: state.productUrl,
    normalizedProductUrl: state.normalizedProductUrl,
    storeName: state.storeName,
    category: state.category,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt
  };
}

export function planUpsertBatch(
  products: ProductDTO[],
  existingRows: ExistingProductRow[],
  now: Date
): UpsertBatchPlan {
  const states = new Map<string, ProductState>();
  for (const row of existingRows) {
    states.set(row.externalId, stateFromExisting(row, now));
  }

  const history: PlannedHistoryRow[] = [];
  products.forEach((product, index) => {
    const timestamp = new Date(now.getTime() + index);
    const state = states.get(product.externalId);

    if (!state) {
      states.set(product.externalId, createdState(product, timestamp));
      return;
    }
    if (state.frozen) {
      return;
    }

    const previousPrice = state.price;
    applyUpdate(state, product, timestamp);
    if (previousPrice !== product.price) {
      history.push({
        id: randomUUID(),
        externalId: product.externalId,
        oldPrice: previousPrice,
        newPrice: product.price,
        capturedAt: timestamp
      });
    }
  });

  const touched = [...states.values()].filter((state) => state.touched);
  return {
    inserts: touched.filter((state) => state.isNew).map(toPlannedRow),
    updates: touched.filter((state) => !state.isNew).map(toPlannedRow),
    history
  };
}

function toJson(rows: Array<PlannedProductRow | PlannedHistoryRow>): string {
  return JSON.stringify(rows);
}

function insertProductsStatement(rows: PlannedProductRow[]) {
  return prisma.$executeRaw(Prisma.sql`
    INSERT INTO "Product" (
      "id", "externalId", "name", "price", "imageUrl", "productUrl", "normalizedProductUrl",
      "storeName", "category", "isManual", "isDeleted", "createdAt", "updatedAt"
    )
    SELECT
      u."id", u."externalId", u."name", u."price", u."imageUrl", u."productUrl",
      u."normalizedProductUrl", u."storeName", u."category", false, false, u."createdAt", u."updatedAt"
    FROM jsonb_to_recordset(${toJson(rows)}::jsonb) AS u(
      "id" text, "externalId" text, "name" text, "price" numeric, "imageUrl" text,
      "productUrl" text, "normalizedProductUrl" text, "storeName" text, "category" text,
      "createdAt" timestamp(3), "updatedAt" timestamp(3)
    )
    ON CONFLICT ("externalId") DO NOTHING
  `);
}

function updateProductsStatement(rows: PlannedProductRow[]) {
  return prisma.$executeRaw(Prisma.sql`
    UPDATE "Product" AS p
    SET
      "name" = u."name",
      "price" = u."price",
      "imageUrl" = u."imageUrl",
      "productUrl" = u."productUrl",
      "normalizedProductUrl" = u."normalizedProductUrl",
      "storeName" = u."storeName",
      "category" = u."category",
      "isManual" = false,
      "updatedAt" = u."updatedAt"
    FROM jsonb_to_recordset(${toJson(rows)}::jsonb) AS u(
      "externalId" text, "name" text, "price" numeric, "imageUrl" text, "productUrl" text,
      "normalizedProductUrl" text, "storeName" text, "category" text, "updatedAt" timestamp(3)
    )
    WHERE p."externalId" = u."externalId"
  `);
}

function insertHistoryStatement(rows: PlannedHistoryRow[]) {
  return prisma.$executeRaw(Prisma.sql`
    INSERT INTO "PriceHistory" ("id", "productId", "oldPrice", "newPrice", "capturedAt")
    SELECT u."id", p."id", u."oldPrice", u."newPrice", u."capturedAt"
    FROM jsonb_to_recordset(${toJson(rows)}::jsonb) AS u(
      "id" text, "externalId" text, "oldPrice" numeric, "newPrice" numeric, "capturedAt" timestamp(3)
    )
    JOIN "Product" AS p ON p."externalId" = u."externalId"
  `);
}

async function findExistingProducts(externalIds: string[]): Promise<ExistingProductRow[]> {
  return prisma.$queryRaw<ExistingProductRow[]>(Prisma.sql`
    SELECT
      "id", "externalId", "name", "price", "imageUrl", "productUrl", "normalizedProductUrl",
      "storeName", "category", "isManual", "isDeleted"
    FROM "Product"
    WHERE "externalId" = ANY(${externalIds}::text[])
  `);
}

export async function upsertProductsBatch(products: ProductDTO[]): Promise<void> {
  if (products.length === 0) {
    return;
  }

  try {
    const externalIds = Array.from(new Set(products.map((product) => product.externalId)));
    const plan = planUpsertBatch(products, await findExistingProducts(externalIds), new Date());
    const statements = [
      ...(plan.inserts.length > 0 ? [insertProductsStatement(plan.inserts)] : []),
      ...(plan.updates.length > 0 ? [updateProductsStatement(plan.updates)] : []),
      ...(plan.history.length > 0 ? [insertHistoryStatement(plan.history)] : [])
    ];
    if (statements.length > 0) {
      await prisma.$transaction(statements);
    }
  } catch {
    return;
  }
}
