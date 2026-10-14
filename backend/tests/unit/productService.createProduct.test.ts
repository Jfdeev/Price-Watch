import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/prisma/client", () => ({
  prisma: {
    product: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: "db-1",
        imageUrl: null,
        productUrl: null,
        storeName: null,
        category: null,
        ...data
      }))
    },
    store: { findFirst: vi.fn(async () => ({ id: "s1" })) },
    category: { findFirst: vi.fn(async () => ({ id: "c1" })) },
    $queryRaw: vi.fn()
  }
}));

import { prisma } from "../../src/prisma/client";
import { createProduct } from "../../src/services/productService";

type SqlArgument = { sql: string; values: unknown[] };

function rawCall(index: number): SqlArgument {
  return vi.mocked(prisma.$queryRaw).mock.calls[index][0] as unknown as SqlArgument;
}

const input = { name: "Produto", price: 10, storeName: "  Loja Azul ", ownerUserId: "u1" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createProduct: validação de loja (F3)", () => {
  it("exige ao menos uma loja ativa antes de olhar o nome", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([] as never);

    await expect(createProduct({ ...input, storeName: "" })).rejects.toThrow(
      "Cadastre ao menos uma loja ativa antes de criar um produto."
    );
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(rawCall(0).sql).toContain('WHERE "isActive" LIMIT 1');
  });

  it("exige o nome da loja", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ found: 1 }] as never);

    await expect(createProduct({ ...input, storeName: "   " })).rejects.toThrow(
      "Selecione uma loja ativa para cadastrar o produto."
    );
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it("procura a loja ativa pelo nome aparado com lower()", async () => {
    vi.mocked(prisma.$queryRaw)
      .mockResolvedValueOnce([{ found: 1 }] as never)
      .mockResolvedValueOnce([] as never);

    await expect(createProduct(input)).rejects.toThrow(
      "A loja selecionada não está ativa ou não existe."
    );
    expect(rawCall(1).sql).toContain('lower("name") = lower(');
    expect(rawCall(1).values).toEqual(["Loja Azul"]);
    expect(prisma.store.findFirst).not.toHaveBeenCalled();
  });

  it("exige que a loja seja do usuário", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ found: 1 }] as never);
    vi.mocked(prisma.store.findFirst).mockResolvedValueOnce(null as never);

    await expect(createProduct(input)).rejects.toThrow("Selecione uma loja ativa criada por voce.");
  });

  it("cria o produto quando todas as validações passam", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ found: 1 }] as never);

    const product = await createProduct(input);

    expect(product.storeName).toBe("Loja Azul");
    expect(prisma.product.create).toHaveBeenCalledTimes(1);
  });
});
