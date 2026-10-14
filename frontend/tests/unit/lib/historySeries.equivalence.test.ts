import { afterEach, describe, expect, it, vi } from "vitest";
import { buildHistorySeries } from "../../../src/lib/historySeries";
import { buildHistorySeries as legacyBuildHistorySeries } from "../../../bench/legacy/buildHistorySeries";
import { generateHistory } from "../../../bench/generators";

afterEach(() => {
  vi.useRealTimers();
});

describe("buildHistorySeries (F8) equivale à versão original", () => {
  it("retorna o mesmo ponto para histórico vazio", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T10:00:00.000Z"));
    expect(buildHistorySeries(99.9, [])).toEqual(legacyBuildHistorySeries(99.9, []));
  });

  it.each([
    ["desc", 0],
    ["desc", 0.3],
    ["desc", 0.9],
    ["asc", 0],
    ["asc", 0.3],
    ["random", 0],
    ["random", 0.4]
  ] as const)("ordem %s com taxa de empate %s", (order, tieRate) => {
    for (const size of [1, 2, 3, 10, 31, 200, 1500]) {
      for (let seed = 1; seed <= 10; seed += 1) {
        const history = generateHistory(seed * 104729 + size, size, order, tieRate);
        expect(buildHistorySeries(50, history)).toEqual(legacyBuildHistorySeries(50, history));
      }
    }
  });

  it("preserva a ordem original entre timestamps iguais", () => {
    const history = [
      { oldPrice: 1, newPrice: 2, capturedAt: "2026-01-03T00:00:00.000Z" },
      { oldPrice: 3, newPrice: 4, capturedAt: "2026-01-02T00:00:00.000Z" },
      { oldPrice: 5, newPrice: 6, capturedAt: "2026-01-02T00:00:00.000Z" },
      { oldPrice: 7, newPrice: 8, capturedAt: "2026-01-02T00:00:00.000Z" },
      { oldPrice: 9, newPrice: 1, capturedAt: "2026-01-01T00:00:00.000Z" }
    ];
    expect(buildHistorySeries(1, history)).toEqual(legacyBuildHistorySeries(1, history));
  });

  it("não altera o array de entrada", () => {
    const history = generateHistory(7, 50, "desc", 0.2);
    const snapshot = JSON.parse(JSON.stringify(history));
    buildHistorySeries(10, history);
    expect(history).toEqual(snapshot);
  });

  it("lança o mesmo erro que a versão original para data inválida", () => {
    const history = [
      { oldPrice: 1, newPrice: 2, capturedAt: "2026-01-02T00:00:00.000Z" },
      { oldPrice: 3, newPrice: 4, capturedAt: "data-invalida" }
    ];
    expect(() => legacyBuildHistorySeries(1, history)).toThrow(RangeError);
    expect(() => buildHistorySeries(1, history)).toThrow(RangeError);
  });
});
