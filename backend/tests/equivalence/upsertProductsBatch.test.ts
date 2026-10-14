import { describe, expect, it } from "vitest";
import { upsertProductsBatch } from "../../src/services/productBatchUpsert";
import { upsertProduct as legacyUpsertProduct } from "../../bench/legacy/productService";
import {
  isConsistentOrder,
  resetDatabase,
  seedProducts,
  snapshotDatabase
} from "../../bench/support/database";
import {
  generateUpsertScenario,
  type UpsertProductInput,
  type UpsertScenario,
  type UpsertScenarioOptions
} from "../../bench/support/scenarios";
import { setupFakeSerpApi } from "./support";

setupFakeSerpApi();

async function runSequentialReference(scenario: UpsertScenario) {
  await resetDatabase();
  await seedProducts(scenario.products);
  for (const product of scenario.input) {
    try {
      await legacyUpsertProduct(product);
    } catch {
      continue;
    }
  }
  return snapshotDatabase();
}

async function runBatch(scenario: UpsertScenario) {
  await resetDatabase();
  await seedProducts(scenario.products);
  await upsertProductsBatch(scenario.input);
  return snapshotDatabase();
}

async function expectEquivalent(scenario: UpsertScenario) {
  const reference = await runSequentialReference(scenario);
  const batch = await runBatch(scenario);
  expect(batch.products).toEqual(reference.products);
  expect(isConsistentOrder(reference.creationOrder, batch.creationOrder)).toBe(true);
  expect(isConsistentOrder(reference.historyOrder, batch.historyOrder)).toBe(true);
  expect(batch.normalizedUrlMismatches).toEqual([]);
}

const CASES: Array<[string, UpsertScenarioOptions]> = [
  [
    "lista vazia",
    { existing: 5, incoming: 0, existingRate: 0, duplicateRate: 0, samePriceRate: 0 }
  ],
  [
    "apenas novos",
    { existing: 0, incoming: 20, existingRate: 0, duplicateRate: 0, samePriceRate: 0 }
  ],
  [
    "apenas existentes",
    { existing: 30, incoming: 20, existingRate: 1, duplicateRate: 0, samePriceRate: 0.3 }
  ],
  [
    "mistura",
    { existing: 30, incoming: 40, existingRate: 0.5, duplicateRate: 0.1, samePriceRate: 0.3 }
  ],
  [
    "muitos duplicados",
    { existing: 10, incoming: 40, existingRate: 0.4, duplicateRate: 0.6, samePriceRate: 0.4 }
  ],
  [
    "preço sempre igual",
    { existing: 20, incoming: 30, existingRate: 0.7, duplicateRate: 0.3, samePriceRate: 1 }
  ]
];

describe("upsertProductsBatch equivale à execução sequencial de upsertProduct (F1)", () => {
  for (const [name, options] of CASES) {
    it(name, async () => {
      for (let seed = 1; seed <= 4; seed += 1) {
        await expectEquivalent(generateUpsertScenario(seed * 7_368_787 + name.length, options));
      }
    });
  }

  it("trata campos ausentes como no update do Prisma", async () => {
    const base: UpsertProductInput = { id: "e1", externalId: "e1", name: "A", price: 10 };
    await expectEquivalent({
      products: [
        {
          externalId: "e1",
          name: "Antigo",
          price: 10,
          imageUrl: "https://img.test/antiga.png",
          productUrl: "https://loja.test/antiga",
          storeName: "Loja Antiga",
          category: "Categoria Antiga",
          createdAt: new Date(Date.UTC(2026, 0, 1))
        }
      ],
      input: [
        base,
        { ...base, price: 12, imageUrl: "https://img.test/nova.png" },
        { ...base, price: 11 }
      ]
    });
  });

  it("cria e depois atualiza o mesmo produto novo na mesma lista", async () => {
    const base: UpsertProductInput = { id: "novo", externalId: "novo", name: "Novo", price: 10 };
    await expectEquivalent({
      products: [],
      input: [
        { ...base, productUrl: "https://Loja.test/Novo" },
        { ...base, price: 15, category: "Informatica" },
        { ...base, price: 15 },
        { ...base, price: 9.99, productUrl: "https://loja.test/outra" }
      ]
    });
  });

  it("não toca produtos manuais nem excluídos, mesmo repetidos", async () => {
    const createdAt = new Date(Date.UTC(2026, 0, 1));
    await expectEquivalent({
      products: [
        { externalId: "manual", name: "Manual", price: 5, isManual: true, createdAt },
        { externalId: "excluido", name: "Excluido", price: 6, isDeleted: true, createdAt }
      ],
      input: [
        { id: "manual", externalId: "manual", name: "X", price: 50 },
        { id: "excluido", externalId: "excluido", name: "Y", price: 60 },
        { id: "manual", externalId: "manual", name: "Z", price: 70 }
      ]
    });
  });
});
