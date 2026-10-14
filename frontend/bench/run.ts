import { computeDashboardMetrics } from "../src/lib/dashboardMetrics";
import { buildHistorySeries } from "../src/lib/historySeries";
import { computeDashboardMetrics as legacyComputeDashboardMetrics } from "./legacy/dashboardMetrics";
import { buildHistorySeries as legacyBuildHistorySeries } from "./legacy/buildHistorySeries";
import { generateDashboardInput, generateHistory, type HistoryOrder } from "./generators";
import { measureMedianMs, writeCsv, type CsvRow } from "./measure";

const SIZES = [10, 100, 1_000, 10_000, 100_000];
const NOW = new Date(2026, 5, 15, 12, 0, 0);
const SEED = 20261014;

function benchDashboardMetrics(): CsvRow[] {
  const rows: CsvRow[] = [];
  for (const n of SIZES) {
    const { priceHistory, alerts, favorites } = generateDashboardInput(SEED + n, n, NOW);
    const versions = [
      ["antes", () => legacyComputeDashboardMetrics(priceHistory, alerts, favorites, NOW)],
      ["depois", () => computeDashboardMetrics(priceHistory, alerts, favorites, NOW)]
    ] as const;
    for (const [version, run] of versions) {
      const ms = measureMedianMs(run);
      rows.push({ funcao: "F7", versao: version, cenario: "aleatorio", n: 3 * n, mediana_ms: ms });
      console.log(`F7 ${version} n=${3 * n} ${ms.toFixed(4)} ms`);
    }
  }
  return rows;
}

const HISTORY_SCENARIOS: Array<[string, HistoryOrder, number]> = [
  ["decrescente", "desc", 0],
  ["decrescente_com_empates", "desc", 0.3],
  ["aleatorio", "random", 0]
];

function benchHistorySeries(): CsvRow[] {
  const rows: CsvRow[] = [];
  for (const [scenario, order, tieRate] of HISTORY_SCENARIOS) {
    for (const n of SIZES) {
      const history = generateHistory(SEED + n, n, order, tieRate);
      const versions = [
        ["antes", () => legacyBuildHistorySeries(50, history)],
        ["depois", () => buildHistorySeries(50, history)]
      ] as const;
      for (const [version, run] of versions) {
        const ms = measureMedianMs(run);
        rows.push({ funcao: "F8", versao: version, cenario: scenario, n, mediana_ms: ms });
        console.log(`F8 ${scenario} ${version} n=${n} ${ms.toFixed(4)} ms`);
      }
    }
  }
  return rows;
}

const selected = process.argv[2];

if (!selected || selected === "f7") {
  console.log(writeCsv("f7_dashboard_metrics.csv", benchDashboardMetrics()));
}

if (!selected || selected === "f8") {
  console.log(writeCsv("f8_build_history_series.csv", benchHistorySeries()));
}
