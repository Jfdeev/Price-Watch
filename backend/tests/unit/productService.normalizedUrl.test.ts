import { beforeEach, describe, expect, it, vi } from "vitest";

const savedProduct = {
  id: "db-1",
  externalId: "ext-1",
  name: "Notebook",
  price: 1000,
  imageUrl: null,
  productUrl: null,
  storeName: null,
  category: null
};

vi.mock("../../src/prisma/client", () => ({
  prisma: {
    product: {
      findUnique: vi.fn(async () => null),
      findFirst: vi.fn(async () => null),
      upsert: vi.fn(async () => savedProduct),
      create: vi.fn(async () => savedProduct),
      update: vi.fn(async () => savedProduct)
    },
    priceHistory: { create: vi.fn() },
    store: {
      findFirst: vi.fn(async () => ({ id: "s1" }))
    },
    category: { findFirst: vi.fn(async () => ({ id: "c1" })) },
    $queryRaw: vi.fn(async () => [{ found: 1 }])
  }
}));

import { prisma } from "../../src/prisma/client";
import {
  createProduct,
  findDeletedProductUrls,
  updateProduct,
  upsertProduct
} from "../../src/services/productService";

type DataArgument = { data: Record<string, unknown> };
type UpsertArgument = { create: Record<string, unknown>; update: Record<string, unknown> };

function lastUpsert(): UpsertArgument {
  return vi.mocked(prisma.product.upsert).mock.calls.at(-1)?.[0] as unknown as UpsertArgument;
}

function lastData(method: "create" | "update"): Record<string, unknown> {
  const calls = vi.mocked(prisma.product[method]).mock.calls;
  return (calls.at(-1)?.[0] as unknown as DataArgument).data;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("normalizedProductUrl em todo ponto de escrita (F2)", () => {
  it("upsertProduct grava a URL normalizada no create e no update", async () => {
    await upsertProduct({
      id: "ext-1",
      externalId: "ext-1",
      name: "Notebook",
      price: 10,
      productUrl: "https://Loja.com/Item?A=1#x"
    });

    expect(lastUpsert().create.normalizedProductUrl).toBe("https://loja.com/item?a=1");
    expect(lastUpsert().update.normalizedProductUrl).toBe("https://loja.com/item?a=1");
  });

  it("upsertProduct sem URL grava null no create e preserva no update", async () => {
    await upsertProduct({ id: "ext-1", externalId: "ext-1", name: "Notebook", price: 10 });

    expect(lastUpsert().create.normalizedProductUrl).toBeNull();
    expect(lastUpsert().update.normalizedProductUrl).toBeUndefined();
  });

  it("createProduct grava a URL normalizada da URL aparada", async () => {
    await createProduct({
      name: "Produto",
      price: 10,
      storeName: "Loja A",
      productUrl: "  HTTPS://LOJA.COM/P  ",
      ownerUserId: "u1"
    });

    expect(lastData("create").normalizedProductUrl).toBe("https://loja.com/p");
  });

  it("createProduct sem URL grava null", async () => {
    await createProduct({ name: "Produto", price: 10, storeName: "Loja A", ownerUserId: "u1" });

    expect(lastData("create").normalizedProductUrl).toBeNull();
  });

  it.each([
    [undefined, undefined],
    [null, null],
    ["", null],
    ["https://Loja.com/Novo", "https://loja.com/novo"]
  ])("updateProduct com productUrl %j grava %j", async (productUrl, expected) => {
    vi.mocked(prisma.product.findFirst).mockResolvedValueOnce(savedProduct as never);

    await updateProduct("db-1", { productUrl }, "u1");

    expect(lastData("update").normalizedProductUrl).toBe(expected);
  });
});

describe("findDeletedProductUrls (F2)", () => {
  it("não consulta o banco quando a página não tem URLs", async () => {
    const findMany = vi.fn();
    Object.assign(prisma.product, { findMany });

    await expect(findDeletedProductUrls(["", ""])).resolves.toEqual(new Set());
    expect(findMany).not.toHaveBeenCalled();
  });

  it("consulta só as URLs distintas da página entre os excluídos", async () => {
    const findMany = vi.fn(async () => [{ normalizedProductUrl: "https://a.test/x" }]);
    Object.assign(prisma.product, { findMany });

    const result = await findDeletedProductUrls([
      "https://a.test/x",
      "",
      "https://a.test/x",
      "https://b.test/y"
    ]);

    expect(result).toEqual(new Set(["https://a.test/x"]));
    expect(findMany).toHaveBeenCalledWith({
      where: {
        isDeleted: true,
        normalizedProductUrl: { in: ["https://a.test/x", "https://b.test/y"] }
      },
      select: { normalizedProductUrl: true }
    });
  });
});
