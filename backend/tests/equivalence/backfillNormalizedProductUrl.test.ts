import { describe, expect, it } from "vitest";
import { backfillNormalizedProductUrls } from "../../scripts/backfillNormalizedProductUrl";
import { resetDatabase, seedProducts, snapshotDatabase } from "../../bench/support/database";
import { generateSearchScenario } from "../../bench/support/scenarios";
import { setupFakeSerpApi } from "./support";

setupFakeSerpApi();

describe("backfill de normalizedProductUrl", () => {
  it("preenche todas as linhas existentes com a mesma normalização da aplicação", async () => {
    const scenario = generateSearchScenario(99, {
      matchingLocals: 40,
      otherLocals: 40,
      deletedProducts: 120,
      serpItems: 0,
      overlapRate: 0,
      deletedHitRate: 0,
      manualRate: 0.2,
      duplicateRate: 0,
      newMatchingItems: 0,
      nextLink: false
    });
    await resetDatabase();
    await seedProducts(scenario.products, { withNormalizedUrl: false });

    const before = await snapshotDatabase();
    expect(before.normalizedUrlMismatches.length).toBeGreaterThan(0);

    const updated = await backfillNormalizedProductUrls(17);
    const after = await snapshotDatabase();

    expect(updated).toBe(before.normalizedUrlMismatches.length);
    expect(after.normalizedUrlMismatches).toEqual([]);
    expect(after.products).toEqual(before.products);
    await expect(backfillNormalizedProductUrls(17)).resolves.toBe(0);
  });
});
