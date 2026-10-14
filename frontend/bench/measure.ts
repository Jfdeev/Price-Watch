import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";

export type MeasureOptions = { warmup: number; samples: number; minSampleMs: number };

export const DEFAULT_OPTIONS: MeasureOptions = { warmup: 5, samples: 21, minSampleMs: 2 };

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function calibrate(run: () => unknown, minSampleMs: number): number {
  let iterations = 1;
  for (;;) {
    const start = performance.now();
    for (let index = 0; index < iterations; index += 1) {
      run();
    }
    if (performance.now() - start >= minSampleMs || iterations >= 1 << 20) {
      return iterations;
    }
    iterations *= 2;
  }
}

export function measureMedianMs(run: () => unknown, options = DEFAULT_OPTIONS): number {
  const iterations = calibrate(run, options.minSampleMs);
  for (let index = 0; index < options.warmup; index += 1) {
    run();
  }
  const samples: number[] = [];
  for (let sample = 0; sample < options.samples; sample += 1) {
    const start = performance.now();
    for (let index = 0; index < iterations; index += 1) {
      run();
    }
    samples.push((performance.now() - start) / iterations);
  }
  return median(samples);
}

export type CsvRow = Record<string, string | number>;

export function writeCsv(fileName: string, rows: CsvRow[]): string {
  const directory = path.join(__dirname, "..", "..", "docs", "complexidade", "dados");
  mkdirSync(directory, { recursive: true });
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(","), ...rows.map((row) => headers.map((key) => row[key]).join(","))];
  const target = path.join(directory, fileName);
  writeFileSync(target, `${lines.join("\n")}\n`);
  return target;
}
