import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/prisma/client", () => ({
  prisma: {
    product: {
      upsert: vi.fn(async ({ create }: { create: { externalId: string } }) => ({
        id: `db-${create.externalId}`,
        externalId: create.externalId,
        name: "Notebook",
        price: 1000,
        imageUrl: null,
        productUrl: null,
        storeName: null,
        category: null
      })),
      findFirst: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
      count: vi.fn(async () => 0),
      create: vi.fn(
        async ({ data }: { data: { externalId: string; name: string; price: number } }) => ({
          id: `db-${data.externalId}`,
          externalId: data.externalId,
          name: data.name,
          price: data.price,
          imageUrl: null,
          productUrl: null,
          storeName: null,
          category: null
        })
      ),
      update: vi.fn(async () => ({
        id: "db-id",
        externalId: "db-ext",
        name: "Notebook atualizado",
        price: 900,
        imageUrl: null,
        productUrl: null,
        storeName: null,
        category: null
      })),
      findUnique: vi.fn(async () => null)
    },
    priceHistory: {
      findMany: vi.fn(async () => []),
      create: vi.fn(async () => ({
        id: "history-1",
        productId: "p1",
        oldPrice: 1000,
        newPrice: 900,
        capturedAt: new Date("2026-06-02T10:00:00.000Z")
      })),
      count: vi.fn(async () => 0)
    },
    favorite: {
      count: vi.fn(async () => 0)
    },
    priceAlert: {
      count: vi.fn(async () => 0)
    },
    store: {
      findFirst: vi.fn(async () => ({ id: "s1" }))
    },
    $queryRaw: vi.fn(async () => [{ found: 1 }]),
    category: {
      findFirst: vi.fn(async () => ({ id: "c1" }))
    }
  }
}));

vi.mock("../../src/services/productBatchUpsert", () => ({
  upsertProductsBatch: vi.fn(async () => undefined)
}));

import { prisma } from "../../src/prisma/client";
import {
  ProductDeleteConflictError,
  createProduct,
  deleteProduct,
  getProductById,
  getShowcaseProducts,
  listProductComparableOffers,
  listProductPriceHistory,
  upsertProduct,
  searchProducts,
  updateProduct
} from "../../src/services/productService";

describe("productService extra coverage", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.stubEnv("SERPAPI_API_KEY", "test-key");
    vi.stubEnv("SERPAPI_API_URL", "https://serpapi.com/search");
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("returns showcase products with pagination metadata", async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValueOnce([
      {
        id: "p1",
        externalId: "ext-1",
        name: "Notebook",
        price: 4500,
        imageUrl: null,
        productUrl: null,
        storeName: "Loja A",
        category: null
      }
    ] as never);
    vi.mocked(prisma.product.count).mockResolvedValueOnce(1 as never);

    const result = await getShowcaseProducts(2, 12);

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 12, take: 12 })
    );
    expect(result.source).toBe("mock");
    expect(result.page).toBe(2);
    expect(result.limit).toBe(12);
    expect(result.products).toHaveLength(1);
  });

  it("normalizes invalid showcase pagination inputs", async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.product.count).mockResolvedValueOnce(0 as never);

    const result = await getShowcaseProducts(Number.NaN, 0);

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 8 })
    );
    expect(result.page).toBe(1);
    expect(result.limit).toBe(8);
  });

  it("returns an empty-search message without calling SerpApi", async () => {
    const result = await searchProducts("   ");

    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(result.message).toContain("Informe um termo de busca");
    expect(result.products).toHaveLength(0);
  });

  it("surfaces SerpApi errors and API error payloads", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response("gateway down", { status: 503, headers: { "Content-Type": "text/plain" } })
    );

    await expect(searchProducts("notebook")).rejects.toMatchObject({ status: 503 });

    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Quota exceeded" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );

    await expect(searchProducts("notebook")).rejects.toMatchObject({
      status: 502,
      body: "Quota exceeded"
    });
  });

  it("throws when SerpApi key is missing", async () => {
    vi.stubEnv("SERPAPI_API_KEY", "");

    await expect(searchProducts("notebook")).rejects.toMatchObject({
      status: 500
    });
  });

  it("maps inline/categorized results and discount parsing branches", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          inline_shopping_results: [
            {
              title: "Produto Inline",
              source: "Loja Inline",
              price: "R$ 1.234,56",
              product_link: "https://inline.com/p"
            }
          ],
          categorized_shopping_results: [
            {
              shopping_results: [
                {
                  title: "Produto Categoria",
                  source: "Loja Cat",
                  extracted_price: 90,
                  tag: "Desconto 10%",
                  link: "https://cat.com/p"
                },
                {
                  title: "Produto Ext",
                  source: "Loja Ext",
                  extracted_price: 80,
                  extensions: ["Promo 20%"],
                  link: "https://ext.com/p"
                }
              ]
            }
          ],
          pagination: {
            previous: "https://serpapi.com/search?start=0"
          },
          search_information: {
            total_results: 3
          }
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    vi.mocked(prisma.product.findUnique).mockResolvedValue(null as never);
    vi.mocked(prisma.product.findMany)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never);

    const result = await searchProducts("produto", 2, 2);

    expect(result.products).toHaveLength(2);
    expect(result.hasPreviousPage).toBe(true);
    expect(result.products[0].price).toBeCloseTo(1234.56, 2);
    expect(result.products[1].originalPrice).toBeCloseTo(100, 2);
  });

  it("filters deleted and manual products when merging search results", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          shopping_results: [
            {
              product_id: "ext-1",
              title: "Notebook A",
              source: "Loja A",
              extracted_price: 1000,
              product_link: "https://loja-a.com/item"
            }
          ],
          search_information: {
            total_results: 1
          },
          serpapi_pagination: {
            next_link: "https://serpapi.com/search.json?engine=google_shopping&q=notebook&start=8"
          }
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    vi.mocked(prisma.product.findUnique).mockResolvedValue(null as never);
    vi.mocked(prisma.product.findMany)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([{ normalizedProductUrl: "https://loja-a.com/item" }] as never);

    const result = await searchProducts("notebook", 1, 4);

    expect(prisma.product.findMany).toHaveBeenCalledWith({
      where: { isDeleted: true, normalizedProductUrl: { in: ["https://loja-a.com/item"] } },
      select: { normalizedProductUrl: true }
    });
    expect(result.products).toHaveLength(0);
    expect(result.totalResults).toBe(1);
    expect(result.totalPages).toBe(1);
    expect(result.hasNextPage).toBe(true);
    expect(result.products.map((product) => product.externalId)).toEqual([]);
  });

  it("replaces search results with saved manual product data", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          shopping_results: [
            {
              product_id: "ext-1",
              title: "Notebook A",
              source: "Loja A",
              extracted_price: 1000,
              product_link: "https://loja-a.com/item"
            }
          ],
          search_information: {
            total_results: 1
          }
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    vi.mocked(prisma.product.findUnique).mockResolvedValue(null as never);
    vi.mocked(prisma.product.findMany)
      .mockResolvedValueOnce([
        {
          id: "saved-1",
          externalId: "ext-1",
          name: "Notebook Manual",
          price: 850,
          imageUrl: null,
          productUrl: "https://loja-a.com/item",
          storeName: "Loja Manual",
          category: "Eletrônicos",
          isManual: true,
          isDeleted: false
        }
      ] as never)
      .mockResolvedValueOnce([] as never);

    const result = await searchProducts("notebook", 1, 4);

    expect(result.products).toHaveLength(1);
    expect(result.products[0]).toMatchObject({
      externalId: "ext-1",
      name: "Notebook Manual",
      storeName: "Loja Manual",
      price: 850,
      category: "Eletrônicos"
    });
  });

  it("creates a manual product and rejects duplicate urls", async () => {
    vi.mocked(prisma.product.findFirst).mockResolvedValueOnce(null as never);

    const created = await createProduct({
      name: "Produto manual",
      price: 100,
      storeName: "Loja A",
      productUrl: "https://example.com/p",
      ownerUserId: "u1"
    });

    expect(prisma.product.create).toHaveBeenCalled();
    expect(created.name).toBe("Produto manual");

    vi.mocked(prisma.product.findFirst).mockResolvedValueOnce({ id: "existing" } as never);

    await expect(
      createProduct({
        name: "Produto manual",
        price: 100,
        storeName: "Loja A",
        productUrl: "https://example.com/p",
        ownerUserId: "u1"
      })
    ).rejects.toThrow("Já existe um produto com a mesma URL.");
  });

  it("validates createProduct required fields", async () => {
    await expect(
      createProduct({ name: "   ", price: 10, storeName: "Loja A", ownerUserId: "u1" })
    ).rejects.toThrow("Nome do produto é obrigatório.");
    await expect(
      createProduct({ name: "Produto", price: 0, storeName: "Loja A", ownerUserId: "u1" })
    ).rejects.toThrow("Preço inválido.");
  });

  it("keeps manual or deleted products untouched during upsert", async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValueOnce({
      id: "existing-manual",
      isManual: true,
      isDeleted: false
    } as never);

    const result = await upsertProduct({
      id: "external-1",
      externalId: "external-1",
      name: "Notebook",
      price: 1000,
      imageUrl: null,
      productUrl: null,
      storeName: null,
      category: null
    });

    expect(result).toBe("existing-manual");
    expect(prisma.product.upsert).not.toHaveBeenCalled();
  });

  it("creates price history when upserting an existing product with a new price", async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValueOnce({
      id: "existing-1",
      price: 100,
      isManual: false,
      isDeleted: false
    } as never);

    vi.mocked(prisma.product.upsert).mockResolvedValueOnce({
      id: "existing-1",
      externalId: "external-1",
      name: "Notebook",
      price: 120,
      imageUrl: null,
      productUrl: null,
      storeName: null,
      category: null
    } as never);

    const result = await upsertProduct({
      id: "external-1",
      externalId: "external-1",
      name: "Notebook",
      price: 120,
      imageUrl: null,
      productUrl: null,
      storeName: null,
      category: null
    });

    expect(result).toBe("existing-1");
    expect(prisma.priceHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          productId: "existing-1",
          oldPrice: 100,
          newPrice: 120
        })
      })
    );
  });

  it("lists history and comparable offers", async () => {
    vi.mocked(prisma.product.findFirst)
      .mockResolvedValueOnce({ id: "p1" } as never)
      .mockResolvedValueOnce({
        id: "p1",
        externalId: "ext-1",
        name: "Notebook",
        price: 1000,
        imageUrl: null,
        productUrl: null,
        storeName: "Loja A",
        category: null
      } as never);

    vi.mocked(prisma.priceHistory.findMany).mockResolvedValueOnce([
      {
        id: "h1",
        oldPrice: 1200,
        newPrice: 1000,
        capturedAt: new Date("2026-06-01T10:00:00.000Z")
      }
    ] as never);

    const history = await listProductPriceHistory("p1");
    expect(history).toHaveLength(1);

    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          shopping_results: [
            {
              product_id: "dup",
              title: "Notebook",
              source: "Loja A",
              extracted_price: 1000,
              product_link: null,
              link: null
            },
            {
              product_id: "alt",
              title: "Notebook da outra loja",
              source: "Loja B",
              extracted_price: 950,
              product_link: "https://lojab.com/p"
            }
          ]
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const offers = await listProductComparableOffers("p1", 3);
    expect(offers).toHaveLength(2);
    expect(offers?.[0].name).toBe("Notebook");
  });

  it("updates and deletes products with conflict handling", async () => {
    vi.mocked(prisma.product.findFirst).mockResolvedValueOnce({
      id: "p1",
      externalId: "ext-1",
      name: "Notebook",
      price: 1000,
      imageUrl: null,
      productUrl: null,
      storeName: null,
      category: null
    } as never);

    const updated = await updateProduct("p1", { name: "Notebook 2", price: 900 });
    expect(updated?.name).toBe("Notebook atualizado");

    vi.mocked(prisma.product.findFirst).mockResolvedValueOnce(null as never);
    await expect(updateProduct("missing", { name: "Notebook 3" })).resolves.toBeNull();

    vi.mocked(prisma.product.findFirst).mockResolvedValueOnce({ id: "p1" } as never);
    vi.mocked(prisma.favorite.count).mockResolvedValueOnce(1 as never);

    await expect(deleteProduct("p1")).rejects.toBeInstanceOf(ProductDeleteConflictError);

    vi.mocked(prisma.product.findFirst).mockResolvedValueOnce({ id: "p2" } as never);
    vi.mocked(prisma.favorite.count).mockResolvedValueOnce(0 as never);
    vi.mocked(prisma.priceAlert.count).mockResolvedValueOnce(0 as never);
    vi.mocked(prisma.priceHistory.count).mockResolvedValueOnce(0 as never);

    await expect(deleteProduct("p2")).resolves.toEqual({ deleted: true });
  });

  it("returns null when listing history or offers for unknown product", async () => {
    vi.mocked(prisma.product.findFirst).mockResolvedValueOnce(null as never);
    await expect(listProductPriceHistory("missing")).resolves.toBeNull();

    vi.mocked(prisma.product.findFirst).mockResolvedValueOnce(null as never);
    await expect(listProductComparableOffers("missing")).resolves.toBeNull();
  });

  it("falls back to base offer when comparable search fails", async () => {
    vi.mocked(prisma.product.findFirst).mockResolvedValueOnce({
      id: "p1",
      externalId: "ext-1",
      name: "Notebook",
      price: 1000,
      imageUrl: null,
      productUrl: "https://store.com/p",
      storeName: "Loja A",
      category: null,
      priceHistory: []
    } as never);

    vi.mocked(globalThis.fetch).mockRejectedValueOnce(new Error("network"));

    const offers = await listProductComparableOffers("p1", 3);
    expect(offers).toHaveLength(1);
    expect(offers?.[0].externalId).toBe("ext-1");
  });

  it("returns null when deleting missing product and includes dependency summary", async () => {
    vi.mocked(prisma.product.findFirst).mockResolvedValueOnce(null as never);
    await expect(deleteProduct("missing")).resolves.toBeNull();

    vi.mocked(prisma.product.findFirst).mockResolvedValueOnce({ id: "p3" } as never);
    vi.mocked(prisma.favorite.count).mockResolvedValueOnce(0 as never);
    vi.mocked(prisma.priceAlert.count).mockResolvedValueOnce(2 as never);
    vi.mocked(prisma.priceHistory.count).mockResolvedValueOnce(1 as never);

    await expect(deleteProduct("p3")).rejects.toMatchObject({
      dependencySummary: "favoritos=0, alertas=2, historico=1"
    });
  });

  it("returns mapped product when finding by external id", async () => {
    vi.mocked(prisma.product.findFirst).mockResolvedValueOnce({
      id: "p4",
      externalId: "ext-4",
      name: "Product",
      price: 500,
      imageUrl: null,
      productUrl: null,
      storeName: null,
      category: null,
      priceHistory: []
    } as never);

    const found = await getProductById("ext-4");
    expect(found?.externalId).toBe("ext-4");
  });

  it("skips history creation when update keeps same price", async () => {
    vi.mocked(prisma.product.findFirst).mockResolvedValueOnce({
      id: "p5",
      externalId: "ext-5",
      name: "Notebook",
      price: 900,
      imageUrl: null,
      productUrl: null,
      storeName: null,
      category: null
    } as never);

    vi.mocked(prisma.product.update).mockResolvedValueOnce({
      id: "p5",
      externalId: "ext-5",
      name: "Notebook",
      price: 900,
      imageUrl: null,
      productUrl: null,
      storeName: null,
      category: null,
      priceHistory: []
    } as never);

    await updateProduct("p5", { name: "Notebook" });

    expect(prisma.priceHistory.create).not.toHaveBeenCalled();
  });
});
