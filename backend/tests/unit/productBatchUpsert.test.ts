import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/prisma/client", () => ({
  prisma: {
    $queryRaw: vi.fn(async () => []),
    $executeRaw: vi.fn(async () => 1),
    $transaction: vi.fn(async (statements: unknown[]) => statements)
  }
}));

import { prisma } from "../../src/prisma/client";
import {
  planUpsertBatch,
  upsertProductsBatch,
  type ExistingProductRow
} from "../../src/services/productBatchUpsert";
import type { ProductDTO } from "../../src/services/productService";

const NOW = new Date("2026-10-14T12:00:00.000Z");

function dto(externalId: string, price: number, extra: Partial<ProductDTO> = {}): ProductDTO {
  return { id: externalId, externalId, name: `Produto ${externalId}`, price, ...extra };
}

function existing(externalId: string, extra: Partial<ExistingProductRow> = {}): ExistingProductRow {
  return {
    id: `db-${externalId}`,
    externalId,
    name: "Antigo",
    price: 10,
    imageUrl: "https://img.test/antiga.png",
    productUrl: "https://loja.test/antiga",
    normalizedProductUrl: "https://loja.test/antiga",
    storeName: "Loja Antiga",
    category: "Categoria",
    isManual: false,
    isDeleted: false,
    ...extra
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("planUpsertBatch", () => {
  it("cria produtos novos com createdAt crescente na ordem de entrada e sem histórico", () => {
    const plan = planUpsertBatch(
      [dto("a", 1), dto("b", 2, { productUrl: "https://L.test/B#x" })],
      [],
      NOW
    );

    expect(plan.updates).toEqual([]);
    expect(plan.history).toEqual([]);
    expect(plan.inserts.map((row) => [row.externalId, row.createdAt.toISOString()])).toEqual([
      ["a", "2026-10-14T12:00:00.000Z"],
      ["b", "2026-10-14T12:00:00.001Z"]
    ]);
    expect(plan.inserts[0]).toMatchObject({
      imageUrl: null,
      productUrl: null,
      normalizedProductUrl: null
    });
    expect(plan.inserts[1].normalizedProductUrl).toBe("https://l.test/b");
  });

  it("atualiza existentes mantendo campos ausentes e registra mudança de preço", () => {
    const plan = planUpsertBatch([dto("a", 12)], [existing("a")], NOW);

    expect(plan.inserts).toEqual([]);
    expect(plan.updates).toEqual([
      expect.objectContaining({
        externalId: "a",
        name: "Produto a",
        price: 12,
        imageUrl: "https://img.test/antiga.png",
        productUrl: "https://loja.test/antiga",
        storeName: "Loja Antiga",
        category: "Categoria"
      })
    ]);
    expect(plan.history).toEqual([
      expect.objectContaining({ externalId: "a", oldPrice: 10, newPrice: 12, capturedAt: NOW })
    ]);
  });

  it("não registra histórico quando o preço não muda", () => {
    expect(planUpsertBatch([dto("a", 10)], [existing("a")], NOW).history).toEqual([]);
  });

  it.each([
    ["manual", { isManual: true }],
    ["excluído", { isDeleted: true }]
  ])("ignora produto %s", (_label, flags) => {
    const plan = planUpsertBatch([dto("a", 99), dto("a", 98)], [existing("a", flags)], NOW);

    expect(plan).toEqual({ inserts: [], updates: [], history: [] });
  });

  it("aplica duplicados em sequência: o último vence e o histórico segue a sequência", () => {
    const plan = planUpsertBatch(
      [
        dto("novo", 10, { imageUrl: "https://img.test/1.png" }),
        dto("novo", 15),
        dto("novo", 15),
        dto("novo", 9, { productUrl: "https://loja.test/x" })
      ],
      [],
      NOW
    );

    expect(plan.inserts).toHaveLength(1);
    expect(plan.inserts[0]).toMatchObject({
      price: 9,
      imageUrl: "https://img.test/1.png",
      productUrl: "https://loja.test/x",
      createdAt: NOW
    });
    expect(
      plan.history.map((row) => [
        row.oldPrice,
        row.newPrice,
        row.capturedAt.getTime() - NOW.getTime()
      ])
    ).toEqual([
      [10, 15, 1],
      [15, 9, 3]
    ]);
  });

  it("converte o preço Decimal existente em número", () => {
    const plan = planUpsertBatch(
      [dto("a", 10.5)],
      [existing("a", { price: { toString: () => "10.50", valueOf: () => 10.5 } as never })],
      NOW
    );

    expect(plan.history).toEqual([]);
  });
});

describe("upsertProductsBatch", () => {
  it("não consulta o banco para lista vazia", async () => {
    await upsertProductsBatch([]);

    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("faz uma leitura e uma transação com apenas os comandos necessários", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([existing("a")] as never);

    await upsertProductsBatch([dto("a", 12), dto("b", 3), dto("b", 4)]);

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(3);
    expect(vi.mocked(prisma.$transaction).mock.calls[0][0]).toHaveLength(3);
  });

  it("omite comandos sem linhas", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([existing("a", { isManual: true })] as never);

    await upsertProductsBatch([dto("a", 12)]);

    expect(prisma.$executeRaw).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("engole falhas do banco como o Promise.allSettled original", async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(new Error("falha"));

    await expect(upsertProductsBatch([dto("a", 1)])).resolves.toBeUndefined();
  });
});
