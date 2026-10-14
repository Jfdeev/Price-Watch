import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/prisma/client", () => ({
  prisma: {
    product: {
      findMany: vi.fn(async () => []),
      count: vi.fn(async () => 0)
    }
  }
}));

vi.mock("../../src/services/productBatchUpsert", () => ({
  upsertProductsBatch: vi.fn(async () => undefined)
}));

import { prisma } from "../../src/prisma/client";
import { searchProducts } from "../../src/services/productService";

function serpResponse(ids: string[], totalResults?: number) {
  return new Response(
    JSON.stringify({
      shopping_results: ids.map((id) => ({
        product_id: id,
        title: `Item ${id}`,
        extracted_price: 10
      })),
      search_information: totalResults === undefined ? undefined : { total_results: totalResults }
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

function local(index: number) {
  return {
    id: `db-${index}`,
    externalId: `local-${index}`,
    name: `Notebook ${index}`,
    price: 10,
    imageUrl: null,
    productUrl: null,
    storeName: null,
    category: null,
    priceHistory: []
  };
}

function mockLocals(page: ReturnType<typeof local>[], total: number, overlap?: number) {
  vi.mocked(prisma.product.findMany)
    .mockResolvedValueOnce([] as never)
    .mockResolvedValueOnce(page as never);
  vi.mocked(prisma.product.count).mockResolvedValueOnce(total as never);
  if (overlap !== undefined) {
    vi.mocked(prisma.product.count).mockResolvedValueOnce(overlap as never);
  }
}

describe("searchProducts: produtos locais paginados no banco (F6)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.stubEnv("SERPAPI_API_KEY", "test-key");
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("busca só limit locais e conta o total no banco", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(serpResponse(["e1"]));
    mockLocals([local(1), local(2)], 2);

    const result = await searchProducts("notebook", 1, 4);

    expect(vi.mocked(prisma.product.findMany).mock.calls[1][0]).toMatchObject({ take: 4 });
    expect(prisma.product.count).toHaveBeenCalledTimes(1);
    expect(result.products.map((product) => product.externalId)).toEqual([
      "local-1",
      "local-2",
      "e1"
    ]);
    expect(result.totalResults).toBe(3);
    expect(result.hasNextPage).toBe(false);
  });

  it("quando L > limit sem total da SerpApi, desconta a sobreposição com uma contagem", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(serpResponse(["e1", "e1", "e2"]));
    mockLocals([local(1), local(2)], 10, 1);

    const result = await searchProducts("notebook", 1, 2);

    expect(result.products.map((product) => product.externalId)).toEqual(["local-1", "local-2"]);
    expect(prisma.product.count).toHaveBeenCalledTimes(2);
    expect(vi.mocked(prisma.product.count).mock.calls[1][0]).toMatchObject({
      where: { AND: [expect.anything(), { externalId: { in: ["e1"] } }] }
    });
    expect(result.totalResults).toBe(10 + 1 - 1);
    expect(result.hasNextPage).toBe(true);
  });

  it("quando a SerpApi informa o total, não conta a sobreposição", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(serpResponse(["e1"], 500));
    mockLocals([local(1), local(2)], 10);

    const result = await searchProducts("notebook", 1, 2);

    expect(prisma.product.count).toHaveBeenCalledTimes(1);
    expect(result.totalResults).toBe(500);
    expect(result.totalPages).toBe(250);
    expect(result.hasNextPage).toBe(true);
  });

  it("quando L > limit sem externos, o total é L", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(serpResponse([]));
    mockLocals([local(1), local(2)], 7);

    const result = await searchProducts("notebook", 1, 2);

    expect(prisma.product.count).toHaveBeenCalledTimes(1);
    expect(result.totalResults).toBe(7);
  });
});
