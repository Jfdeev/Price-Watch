import { afterAll, beforeAll } from "vitest";
import { prisma } from "../../src/prisma/client";
import {
  startFakeSerpApi,
  useFakeSerpApi,
  type FakeSerpApi
} from "../../bench/support/fakeSerpApi";
import {
  externalIdsById,
  resetDatabase,
  seedProducts,
  snapshotDatabase,
  type DatabaseSnapshot
} from "../../bench/support/database";
import type { SearchScenario } from "../../bench/support/scenarios";

export function setupFakeSerpApi(): { current: () => FakeSerpApi } {
  let api: FakeSerpApi;
  beforeAll(async () => {
    api = await startFakeSerpApi();
    useFakeSerpApi(api);
  });
  afterAll(async () => {
    await api.close();
    await prisma.$disconnect();
  });
  return { current: () => api };
}

type ProductLike = { id: string; externalId: string };

export function normalizeIds<T extends { products: ProductLike[] }>(
  result: T,
  externalIds: Map<string, string>
): T {
  return {
    ...result,
    products: result.products.map((product) => ({
      ...product,
      id:
        product.id !== product.externalId && externalIds.has(product.id)
          ? `db:${externalIds.get(product.id)}`
          : product.id
    }))
  };
}

export type SearchRun<T> = { result: T; snapshot: DatabaseSnapshot };

export async function runSearch<T extends { products: ProductLike[] }>(
  api: FakeSerpApi,
  scenario: SearchScenario,
  search: () => Promise<T>
): Promise<SearchRun<T>> {
  await resetDatabase();
  await seedProducts(scenario.products);
  api.setResponse(scenario.serp);
  const result = await search();
  const externalIds = await externalIdsById();
  return { result: normalizeIds(result, externalIds), snapshot: await snapshotDatabase() };
}

export function seededCreationOrder(snapshot: DatabaseSnapshot, seeded: Set<string>): string[][] {
  return snapshot.creationOrder
    .map((group) => group.filter((key) => seeded.has(key)))
    .filter((group) => group.length > 0);
}
