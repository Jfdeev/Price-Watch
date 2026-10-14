import { prisma } from "../../src/prisma/client";
import { toNormalizedProductUrlColumn } from "../../src/services/productUrl";

export type SeedProduct = {
  externalId: string;
  name: string;
  price: number;
  imageUrl?: string | null;
  productUrl?: string | null;
  storeName?: string | null;
  category?: string | null;
  isManual?: boolean;
  isDeleted?: boolean;
  createdAt: Date;
  history?: Array<{ oldPrice: number; newPrice: number; capturedAt: Date }>;
};

export async function resetDatabase(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "PriceHistory", "Favorite", "PriceAlert", "Product", "Store", "Category", "User", "PriceHistoryEntry" CASCADE'
  );
}

export async function seedProducts(
  products: SeedProduct[],
  options: { withNormalizedUrl: boolean } = { withNormalizedUrl: true }
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  const chunkSize = 5_000;
  for (let start = 0; start < products.length; start += chunkSize) {
    const chunk = products.slice(start, start + chunkSize);
    const created = await prisma.product.createManyAndReturn({
      data: chunk.map((product) => ({
        externalId: product.externalId,
        name: product.name,
        price: product.price,
        imageUrl: product.imageUrl ?? null,
        productUrl: product.productUrl ?? null,
        normalizedProductUrl: options.withNormalizedUrl
          ? toNormalizedProductUrlColumn(product.productUrl)
          : null,
        storeName: product.storeName ?? null,
        category: product.category ?? null,
        isManual: product.isManual ?? false,
        isDeleted: product.isDeleted ?? false,
        createdAt: product.createdAt
      })),
      select: { id: true, externalId: true }
    });
    for (const row of created) {
      ids.set(row.externalId, row.id);
    }
  }
  const history = products.flatMap((product) =>
    (product.history ?? []).map((entry) => ({
      productId: ids.get(product.externalId) as string,
      oldPrice: entry.oldPrice,
      newPrice: entry.newPrice,
      capturedAt: entry.capturedAt
    }))
  );
  for (let start = 0; start < history.length; start += chunkSize) {
    await prisma.priceHistory.createMany({ data: history.slice(start, start + chunkSize) });
  }
  return ids;
}

export type OrderGroups = string[][];

function groupByTime<T>(
  items: T[],
  key: (item: T) => string,
  time: (item: T) => number
): OrderGroups {
  const sorted = [...items].sort((left, right) => time(left) - time(right));
  const groups: OrderGroups = [];
  let lastTime: number | null = null;
  for (const item of sorted) {
    const current = time(item);
    if (lastTime === null || current !== lastTime) {
      groups.push([]);
      lastTime = current;
    }
    groups[groups.length - 1].push(key(item));
  }
  return groups.map((group) => group.sort());
}

export type DatabaseSnapshot = {
  products: Array<Record<string, unknown>>;
  creationOrder: OrderGroups;
  historyOrder: OrderGroups;
  normalizedUrlMismatches: string[];
};

export async function snapshotDatabase(): Promise<DatabaseSnapshot> {
  const products = await prisma.product.findMany({
    include: { priceHistory: true },
    orderBy: { externalId: "asc" }
  });
  const history = products.flatMap((product) =>
    product.priceHistory.map((entry) => ({
      key: `${product.externalId}|${entry.oldPrice.toString()}|${entry.newPrice.toString()}`,
      time: entry.capturedAt.getTime()
    }))
  );
  return {
    products: products.map((product) => ({
      externalId: product.externalId,
      name: product.name,
      price: product.price.toString(),
      imageUrl: product.imageUrl,
      productUrl: product.productUrl,
      storeName: product.storeName,
      category: product.category,
      isManual: product.isManual,
      isDeleted: product.isDeleted,
      history: product.priceHistory
        .map((entry) => `${entry.oldPrice.toString()}->${entry.newPrice.toString()}`)
        .sort()
    })),
    creationOrder: groupByTime(
      products,
      (product) => product.externalId,
      (product) => product.createdAt.getTime()
    ),
    historyOrder: groupByTime(
      history,
      (entry) => entry.key,
      (entry) => entry.time
    ),
    normalizedUrlMismatches: products
      .filter(
        (product) =>
          product.normalizedProductUrl !== toNormalizedProductUrlColumn(product.productUrl)
      )
      .map((product) => product.externalId)
  };
}

export function isConsistentOrder(reference: OrderGroups, actual: OrderGroups): boolean {
  const positions = new Map<string, number[]>();
  reference.forEach((group, index) => {
    for (const key of group) {
      positions.set(key, [...(positions.get(key) ?? []), index]);
    }
  });
  let previousMax = -1;
  for (const group of actual) {
    const indexes: number[] = [];
    for (const key of group) {
      const available = positions.get(key);
      if (!available || available.length === 0) {
        return false;
      }
      indexes.push(available.shift() as number);
    }
    if (Math.min(...indexes) < previousMax) {
      return false;
    }
    previousMax = Math.max(previousMax, ...indexes);
  }
  return [...positions.values()].every((remaining) => remaining.length === 0);
}

export async function externalIdsById(): Promise<Map<string, string>> {
  const rows = await prisma.product.findMany({ select: { id: true, externalId: true } });
  return new Map(rows.map((row) => [row.id, row.externalId]));
}
