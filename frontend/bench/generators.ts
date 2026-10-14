import { createRandom, randomInt } from "./random";

export function monthBoundaryDates(now: Date): string[] {
  const year = now.getFullYear();
  const month = now.getMonth();
  const previousStart = new Date(year, month - 1, 1).getTime();
  const currentStart = new Date(year, month, 1).getTime();
  const nextStart = new Date(year, month + 1, 1).getTime();
  return [
    previousStart,
    currentStart,
    nextStart,
    previousStart - 1,
    currentStart - 1,
    nextStart - 1
  ].map((timestamp) => new Date(timestamp).toISOString());
}

function randomDate(random: () => number, now: Date, boundaries: string[]): string {
  if (random() < 0.1) {
    return boundaries[randomInt(random, 0, boundaries.length - 1)];
  }
  const offset = randomInt(random, -75, 45) * 86_400_000 + randomInt(random, 0, 86_399_999);
  return new Date(now.getTime() + offset).toISOString();
}

function randomPrice(random: () => number): number {
  return randomInt(random, 0, 500_000) / 100;
}

export function generateDashboardInput(seed: number, size: number, now: Date) {
  const random = createRandom(seed);
  const boundaries = monthBoundaryDates(now);
  const names = Math.max(1, Math.floor(size / 3));
  const priceHistory = Array.from({ length: size }, () => ({
    productName: `Produto ${randomInt(random, 0, names)}`,
    oldPrice: randomPrice(random),
    newPrice: randomPrice(random),
    capturedAt: randomDate(random, now, boundaries)
  }));
  const alerts = Array.from({ length: size }, () => ({
    isActive: random() < 0.6,
    createdAt: randomDate(random, now, boundaries)
  }));
  const favorites = Array.from({ length: size }, () => ({
    createdAt: randomDate(random, now, boundaries)
  }));
  return { priceHistory, alerts, favorites };
}

export type HistoryOrder = "desc" | "asc" | "random";

export function generateHistory(seed: number, size: number, order: HistoryOrder, tieRate: number) {
  const random = createRandom(seed);
  const timestamps: number[] = [];
  let current = Date.UTC(2026, 0, 1) + size * 3_600_000;
  for (let index = 0; index < size; index += 1) {
    if (index === 0 || random() >= tieRate) {
      current -= randomInt(random, 1, 3_600_000);
    }
    timestamps.push(current);
  }
  if (order === "asc") {
    timestamps.reverse();
  }
  if (order === "random") {
    for (let index = timestamps.length - 1; index > 0; index -= 1) {
      const swap = randomInt(random, 0, index);
      [timestamps[index], timestamps[swap]] = [timestamps[swap], timestamps[index]];
    }
  }
  const prices = [10, 12.5, 12.5, 15, 9.99];
  return timestamps.map((timestamp) => ({
    oldPrice: prices[randomInt(random, 0, prices.length - 1)],
    newPrice: prices[randomInt(random, 0, prices.length - 1)],
    capturedAt: new Date(timestamp).toISOString()
  }));
}
