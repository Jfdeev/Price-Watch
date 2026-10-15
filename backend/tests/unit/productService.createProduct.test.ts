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
    vi.mocked(prisma.$queryRaw)
      .mockResolvedValueOnce([{ found: 1 }] as never)
      .mockResolvedValueOnce([{ found: 1 }] as never)
      .mockResolvedValueOnce([] as never);
    vi.mocked(prisma.store.findFirst).mockResolvedValueOnce(null as never);

    await expect(createProduct(input)).rejects.toThrow("Selecione uma loja ativa criada por voce.");
    expect(rawCall(2).sql).toContain('"userId" =');
    expect(rawCall(2).values).toEqual(["Loja Azul", "u1"]);
  });

  it("confirma o dono pelo índice sem recorrer ao ILIKE quando há igualdade exata", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ found: 1 }] as never);

    await createProduct(input);

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(3);
    expect(prisma.store.findFirst).not.toHaveBeenCalled();
  });

  it("recorre ao ILIKE original quando a igualdade exata não encontra a loja", async () => {
    vi.mocked(prisma.$queryRaw)
      .mockResolvedValueOnce([{ found: 1 }] as never)
      .mockResolvedValueOnce([{ found: 1 }] as never)
      .mockResolvedValueOnce([] as never);

    await createProduct(input);

    expect(prisma.store.findFirst).toHaveBeenCalledWith({
      where: { name: { equals: "Loja Azul", mode: "insensitive" }, userId: "u1", isActive: true },
      select: { id: true }
    });
  });

  it("usa só o ILIKE original quando o nome tem barra invertida", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ found: 1 }] as never);

    await createProduct({ ...input, storeName: String.raw`Loja\Azul` });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    expect(prisma.store.findFirst).toHaveBeenCalledTimes(1);
  });

  it("cria o produto quando todas as validações passam", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ found: 1 }] as never);

    const product = await createProduct(input);

    expect(product.storeName).toBe("Loja Azul");
    expect(prisma.product.create).toHaveBeenCalledTimes(1);
  });
});
