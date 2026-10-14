export type Random = () => number;

export function createRandom(seed: number): Random {
  let state = seed >>> 0;
  return function next(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomInt(random: Random, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

export function pick<T>(random: Random, items: readonly T[]): T {
  return items[randomInt(random, 0, items.length - 1)];
}

export function randomPrice(random: Random): number {
  return randomInt(random, 100, 999_999) / 100;
}
