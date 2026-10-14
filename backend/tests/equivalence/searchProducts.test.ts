import { describe, expect, it } from "vitest";
import { searchProducts } from "../../src/services/productService";
import { searchProducts as legacySearchProducts } from "../../bench/legacy/productService";
import {
  generateSearchScenario,
  SEARCH_QUERY,
  type SearchScenarioOptions
} from "../../bench/support/scenarios";
import { runSearch, seededCreationOrder, setupFakeSerpApi } from "./support";

const serpApi = setupFakeSerpApi();

const BASE: SearchScenarioOptions = {
  matchingLocals: 5,
  otherLocals: 5,
  deletedProducts: 10,
  serpItems: 8,
  overlapRate: 0.25,
  deletedHitRate: 0.25,
  manualRate: 0.2,
  duplicateRate: 0.15,
  newMatchingItems: 0,
  totalResults: undefined,
  nextLink: false
};

type Case = {
  name: string;
  options: Partial<SearchScenarioOptions>;
  query?: string;
  category?: string;
  page?: number;
  limit?: number;
};

const CASES: Case[] = [
  { name: "sem produtos locais", options: { matchingLocals: 0, otherLocals: 0 } },
  { name: "L < limit sem sobreposição", options: { matchingLocals: 3, overlapRate: 0 } },
  { name: "L < limit com sobreposição", options: { matchingLocals: 4, overlapRate: 0.6 } },
  { name: "L = limit", options: { matchingLocals: 8 } },
  { name: "L = limit sem externos", options: { matchingLocals: 8, serpItems: 0 } },
  { name: "L = limit + 1", options: { matchingLocals: 9 } },
  { name: "L > limit sem sobreposição", options: { matchingLocals: 30, overlapRate: 0 } },
  { name: "L > limit com sobreposição alta", options: { matchingLocals: 30, overlapRate: 0.8 } },
  { name: "L > limit com total da SerpApi", options: { matchingLocals: 30, totalResults: 1234 } },
  { name: "L > limit com próxima página", options: { matchingLocals: 30, nextLink: true } },
  { name: "externos duplicados", options: { duplicateRate: 0.8, serpItems: 12 } },
  {
    name: "muitos excluídos e acertos de URL",
    options: { deletedProducts: 200, deletedHitRate: 0.7 }
  },
  { name: "total da SerpApi zero", options: { totalResults: 0 } },
  {
    name: "um externo novo que casa com a busca",
    options: { newMatchingItems: 1, overlapRate: 0 }
  },
  { name: "limit 24 com L grande", options: { matchingLocals: 60, serpItems: 24 }, limit: 24 },
  { name: "página 2", options: { matchingLocals: 12 }, page: 2 },
  { name: "busca com categoria", options: { matchingLocals: 20 }, category: "Notebook gamer" },
  {
    name: "apenas categoria",
    options: { matchingLocals: 20 },
    query: "",
    category: "notebook GAMER"
  },
  { name: "apenas categoria sem resultados", options: {}, query: "", category: "Inexistente" }
];

describe("searchProducts equivale à versão original (F1 sem duplicados divergentes, F2, F6)", () => {
  for (const testCase of CASES) {
    it(testCase.name, async () => {
      for (let seed = 1; seed <= 3; seed += 1) {
        const scenario = generateSearchScenario(seed * 1_000_003 + testCase.name.length, {
          ...BASE,
          ...testCase.options
        });
        const query = testCase.query ?? SEARCH_QUERY;
        const page = testCase.page ?? 1;
        const limit = testCase.limit ?? 8;
        const seeded = new Set(scenario.products.map((product) => product.externalId));

        const before = await runSearch(serpApi.current(), scenario, () =>
          legacySearchProducts(query, page, limit, testCase.category)
        );
        const after = await runSearch(serpApi.current(), scenario, () =>
          searchProducts(query, page, limit, testCase.category)
        );

        expect(after.result).toEqual(before.result);
        expect(after.snapshot.products).toEqual(before.snapshot.products);
        expect(seededCreationOrder(after.snapshot, seeded)).toEqual(
          seededCreationOrder(before.snapshot, seeded)
        );
        expect(after.snapshot.normalizedUrlMismatches).toEqual([]);
      }
    });
  }

  it("mantém a mensagem quando não há termo nem categoria", async () => {
    await expect(searchProducts("  ", 1, 8)).resolves.toEqual(
      await legacySearchProducts("  ", 1, 8)
    );
  });
});
