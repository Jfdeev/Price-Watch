import { afterEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "../../src/prisma/client";
import { mockProductNotFound, mockProductFound } from "./helpers";

vi.mock("../../src/services/productService", () => ({
  getProductById: vi.fn(),
  upsertProduct: vi.fn(),
}));

import { getProductById, upsertProduct } from "../../src/services/productService";
import {
  createFavorite,
  listFavorites,
  deleteFavorite,
  findFavoriteForProduct,
  findFavoritesForProducts,
} from "../../src/services/favoriteService";

const originalFavorite = prisma.favorite;

afterEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(prisma, "favorite", {
    value: originalFavorite,
    configurable: true,
  });
});

function mockFavoriteModel(methods: Record<string, unknown>) {
  Object.defineProperty(prisma, "favorite", { value: methods, configurable: true });
}

describe("favoriteService", () => {
  describe("createFavorite", () => {
    it("throws when product is not found", async () => {
      mockProductNotFound(getProductById as any);

      await expect(
        createFavorite({ productId: "p1", userId: "u1" }),
      ).rejects.toThrow("Produto não encontrado");
    });

    it("creates favorite with default userName", async () => {
      mockProductFound(getProductById as any, upsertProduct as any);
      mockFavoriteModel({
        findFirst: vi.fn().mockResolvedValueOnce(null),
        create: vi.fn().mockResolvedValueOnce({
          id: "f1",
          productId: "saved-p1",
          userId: "u1",
          userName: "Aluno PriceWatch",
          product: { id: "saved-p1", name: "Product" },
        }),
      });

      const result = await createFavorite({ productId: "p1", userId: "u1" });

      expect(result.userName).toBe("Aluno PriceWatch");
      expect(upsertProduct).toHaveBeenCalled();
    });

    it("creates favorite with custom userName", async () => {
      mockProductFound(getProductById as any, upsertProduct as any);
      mockFavoriteModel({
        findFirst: vi.fn().mockResolvedValueOnce(null),
        create: vi.fn().mockResolvedValueOnce({
          id: "f1",
          productId: "saved-p1",
          userId: "u1",
          userName: "Custom User",
          product: { id: "saved-p1", name: "Product" },
        }),
      });

      const result = await createFavorite({
        productId: "p1",
        userId: "u1",
        userName: "Custom User",
      });

      expect(result.userName).toBe("Custom User");
    });

    it("returns existing favorite instead of creating duplicate", async () => {
      mockProductFound(getProductById as any, upsertProduct as any);
      const existing = {
        id: "f-existing",
        productId: "saved-p1",
        userId: "u1",
        userName: "Aluno PriceWatch",
        product: { id: "saved-p1", name: "Product" },
      };

      mockFavoriteModel({
        findFirst: vi.fn().mockResolvedValueOnce(existing),
        create: vi.fn(),
      });

      const result = await createFavorite({ productId: "p1", userId: "u1" });

      expect(result).toEqual(existing);
      expect(prisma.favorite.create).not.toHaveBeenCalled();
    });

    it("recovers existing favorite when create hits unique constraint race", async () => {
      mockProductFound(getProductById as any, upsertProduct as any);
      const existing = {
        id: "f-race",
        productId: "saved-p1",
        userId: "u1",
        userName: "Aluno PriceWatch",
        product: { id: "saved-p1", name: "Product" },
      };

      mockFavoriteModel({
        findFirst: vi
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(existing),
        create: vi.fn().mockRejectedValueOnce(
          new Prisma.PrismaClientKnownRequestError("Unique", {
            code: "P2002",
            clientVersion: "test",
          })
        ),
      });

      const result = await createFavorite({ productId: "p1", userId: "u1" });

      expect(result).toEqual(existing);
      expect(prisma.favorite.findFirst).toHaveBeenCalledTimes(2);
    });

    it("rethrows known request error when race recovery finds nothing", async () => {
      mockProductFound(getProductById as any, upsertProduct as any);

      mockFavoriteModel({
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockRejectedValueOnce(
          new Prisma.PrismaClientKnownRequestError("Unique", {
            code: "P2002",
            clientVersion: "test",
          })
        ),
      });

      await expect(createFavorite({ productId: "p1", userId: "u1" })).rejects.toBeInstanceOf(
        Prisma.PrismaClientKnownRequestError
      );
    });
  });

  describe("listFavorites", () => {
    it("returns favorites filtered by userId", async () => {
      mockFavoriteModel({
        findMany: vi.fn().mockResolvedValueOnce([
          { id: "f1", userId: "u1", product: { name: "P1" } },
          { id: "f2", userId: "u1", product: { name: "P2" } },
        ]),
      });

      const result = await listFavorites("u1");

      expect(result).toHaveLength(2);
      expect(prisma.favorite.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "u1" },
          orderBy: { createdAt: "desc" },
        }),
      );
    });
  });

  describe("deleteFavorite", () => {
    it("returns null when not found or not owned", async () => {
      mockFavoriteModel({ findFirst: vi.fn().mockResolvedValueOnce(null) });

      const result = await deleteFavorite("f1", "u1");

      expect(result).toBeNull();
    });

    it("deletes the favorite when ownership is valid", async () => {
      const existingFav = { id: "f1", userId: "u1", product: { name: "P1" } };
      mockFavoriteModel({
        findFirst: vi.fn().mockResolvedValueOnce(existingFav),
        delete: vi.fn().mockResolvedValueOnce(existingFav),
      });

      const result = await deleteFavorite("f1", "u1");

      expect(result).toEqual(existingFav);
      expect(prisma.favorite.delete).toHaveBeenCalledWith({ where: { id: "f1" } });
    });
  });
});

describe("findFavoriteForProduct", () => {
  it("uses the unique index on userId and productId", async () => {
    const findUnique = vi.fn().mockResolvedValueOnce({ id: "f1", productId: "p1" });
    mockFavoriteModel({ findUnique });

    const result = await findFavoriteForProduct("u1", "p1");

    expect(result).toEqual({ id: "f1", productId: "p1" });
    expect(findUnique).toHaveBeenCalledWith({
      where: { userId_productId: { userId: "u1", productId: "p1" } },
      select: { id: true, productId: true },
    });
  });

  it("returns null when there is no favorite", async () => {
    mockFavoriteModel({ findUnique: vi.fn().mockResolvedValueOnce(null) });

    await expect(findFavoriteForProduct("u1", "p1")).resolves.toBeNull();
  });
});

describe("findFavoritesForProducts", () => {
  it("queries only the requested products of the user", async () => {
    const findMany = vi.fn().mockResolvedValueOnce([{ id: "f1", productId: "p1" }]);
    mockFavoriteModel({ findMany });

    const result = await findFavoritesForProducts("u1", ["p1", "p2"]);

    expect(result).toEqual([{ id: "f1", productId: "p1" }]);
    expect(findMany).toHaveBeenCalledWith({
      where: { userId: "u1", productId: { in: ["p1", "p2"] } },
      select: { id: true, productId: true },
    });
  });

  it("skips the database for an empty list", async () => {
    const findMany = vi.fn();
    mockFavoriteModel({ findMany });

    await expect(findFavoritesForProducts("u1", [])).resolves.toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });
});
