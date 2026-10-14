import { describe, expect, it } from "vitest";
import { computeDashboardMetrics } from "../../../src/lib/dashboardMetrics";
import { computeDashboardMetrics as legacyComputeDashboardMetrics } from "../../../bench/legacy/dashboardMetrics";
import { generateDashboardInput, monthBoundaryDates } from "../../../bench/generators";

const NOW = new Date(2026, 5, 15, 12, 0, 0);

describe("computeDashboardMetrics (F7) equivale à versão original", () => {
  it("retorna o mesmo resultado para entradas vazias", () => {
    expect(computeDashboardMetrics([], [], [], NOW)).toEqual(
      legacyComputeDashboardMetrics([], [], [], NOW)
    );
  });

  it.each([1, 2, 7, 50, 333, 2000])("retorna o mesmo resultado para n=%i", (size) => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const { priceHistory, alerts, favorites } = generateDashboardInput(
        seed * 7919 + size,
        size,
        NOW
      );
      const expected = legacyComputeDashboardMetrics(priceHistory, alerts, favorites, NOW);
      const actual = computeDashboardMetrics(priceHistory, alerts, favorites, NOW);
      expect(actual).toEqual(expected);
      expect(Object.is(actual.savingsTotal, expected.savingsTotal)).toBe(true);
      expect(Object.is(actual.savingsCurrent, expected.savingsCurrent)).toBe(true);
      expect(Object.is(actual.savingsPrevious, expected.savingsPrevious)).toBe(true);
    }
  });

  it("trata janeiro, quando o mês anterior pertence ao ano anterior", () => {
    const january = new Date(2026, 0, 10);
    const { priceHistory, alerts, favorites } = generateDashboardInput(42, 500, january);
    expect(computeDashboardMetrics(priceHistory, alerts, favorites, january)).toEqual(
      legacyComputeDashboardMetrics(priceHistory, alerts, favorites, january)
    );
  });

  it("classifica cada fronteira de mês no mesmo intervalo", () => {
    const dates = monthBoundaryDates(NOW);
    const priceHistory = dates.map((capturedAt, index) => ({
      productName: `P${index % 2}`,
      oldPrice: 10.1 + index,
      newPrice: 3.3,
      capturedAt
    }));
    const alerts = dates.map((createdAt, index) => ({ isActive: index % 3 !== 0, createdAt }));
    const favorites = dates.map((createdAt) => ({ createdAt }));
    expect(computeDashboardMetrics(priceHistory, alerts, favorites, NOW)).toEqual(
      legacyComputeDashboardMetrics(priceHistory, alerts, favorites, NOW)
    );
  });
});
