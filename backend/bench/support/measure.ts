import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { countQueries } from "./queryCounter";

export type Sample = { ms: number; queries: number };

export type MeasureOptions = {
  warmup: number;
  repetitions: number;
  prepare?: () => Promise<void>;
};

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

export async function measure(
  run: () => Promise<unknown>,
  options: MeasureOptions
): Promise<Sample> {
  const times: number[] = [];
  const queries: number[] = [];
  for (let index = 0; index < options.warmup + options.repetitions; index += 1) {
    if (options.prepare) {
      await options.prepare();
    }
    let elapsed = 0;
    const counted = await countQueries(async () => {
      const start = performance.now();
      const result = await run();
      elapsed = performance.now() - start;
      return result;
    });
    if (index >= options.warmup) {
      times.push(elapsed);
      queries.push(counted.queries);
    }
  }
  return { ms: median(times), queries: median(queries) };
}

export function repetitionsFor(size: number): MeasureOptions {
  if (size >= 50_000) {
    return { warmup: 1, repetitions: 3 };
  }
  if (size >= 5_000) {
    return { warmup: 1, repetitions: 5 };
  }
  return { warmup: 2, repetitions: 9 };
}

export type CsvRow = Record<string, string | number>;

export function writeCsv(fileName: string, rows: CsvRow[]): string {
  const directory = path.join(__dirname, "..", "..", "..", "docs", "complexidade", "dados");
  mkdirSync(directory, { recursive: true });
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(","), ...rows.map((row) => headers.map((key) => row[key]).join(","))];
  const target = path.join(directory, fileName);
  writeFileSync(target, `${lines.join("\n")}\n`);
  return target;
}

export function log(row: CsvRow): void {
  console.warn(
    Object.entries(row)
      .map(([key, value]) => `${key}=${value}`)
      .join(" ")
  );
}
