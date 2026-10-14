import { describe, expect, it } from "vitest";
import { upsertProductsBatch } from "../../src/services/productBatchUpsert";
import { upsertProduct as legacyUpsertProduct } from "../../bench/legacy/productService";
import { resetDatabase, seedProducts } from "../../bench/support/database";
import { attachQueryCounter, countQueries } from "../../bench/support/queryCounter";
import { generateUpsertScenario } from "../../bench/support/scenarios";
import { setupFakeSerpApi } from "./support";

setupFakeSerpApi();

const OPTIONS = { existingRate: 0.5, duplicateRate: 0, samePriceRate: 0.2 };

async function queriesFor(
  size: number,
  run: (input: ReturnType<typeof generateUpsertScenario>["input"]) => Promise<void>
) {
  const scenario = generateUpsertScenario(size, { existing: size, incoming: size, ...OPTIONS });
  await resetDatabase();
  await seedProducts(scenario.products);
  return (await countQueries(() => run(scenario.input))).queries;
}

describe("número de consultas do upsert da busca (F1)", () => {
  it("é constante em n no lote e linear em n na versão original", async () => {
    attachQueryCounter();
    const sizes = [5, 50, 500];
    const batch = [];
    const legacy = [];
    for (const size of sizes) {
      batch.push(await queriesFor(size, (input) => upsertProductsBatch(input)));
      legacy.push(
        await queriesFor(size, async (input) => {
          await Promise.allSettled(input.map((product) => legacyUpsertProduct(product)));
        })
      );
    }

    expect(Math.max(...batch)).toBeLessThanOrEqual(6);
    expect(batch[1]).toBe(batch[2]);
    expect(legacy[1]).toBeGreaterThan(50);
    expect(legacy[2] / legacy[1]).toBeGreaterThan(8);
  });
});
