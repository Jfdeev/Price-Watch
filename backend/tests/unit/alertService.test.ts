import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../src/prisma/client";

vi.mock("../../src/services/productService", () => ({
  getProductById: vi.fn(),
  upsertProduct: vi.fn(),
}));

import { getProductById, upsertProduct } from "../../src/services/productService";
import {
  createPriceAlert,
  listPriceAlerts,
  updatePriceAlert,
  deletePriceAlert,
} from "../../src/services/alertService";

const mockedGetProductById = vi.mocked(getProductById);
const mockedUpsertProduct = vi.mocked(upsertProduct);

const originalPriceAlert = prisma.priceAlert;

afterEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(prisma, "priceAlert", {
    value: originalPriceAlert,
    configurable: true,
  });
});

describe("alertService", () => {
  describe("createPriceAlert", () => {
    it("throws when product is not found", async () => {
      mockedGetProductById.mockResolvedValueOnce(null);

      await expect(
        createPriceAlert({
          productId: "p1",
          userId: "u1",
          targetPrice: 100,
          email: "x@y.com",
        }),
      ).rejects.toThrow("Produto não encontrado");
    });

    it("creates alert after upserting product", async () => {
      mockedGetProductById.mockResolvedValueOnce({
        id: "p1",
        externalId: "e1",
        name: "Product",
        price: 200,
      } as any);
      mockedUpsertProduct.mockResolvedValueOnce("saved-p1");

      const mockAlert = {
        id: "a1",
        productId: "saved-p1",
        userId: "u1",
        targetPrice: 100,
        email: "x@y.com",
        product: { id: "saved-p1", name: "Product" },
      };

      Object.defineProperty(prisma, "priceAlert", {
        value: {
          create: vi.fn().mockResolvedValueOnce(mockAlert),
        },
        configurable: true,
      });

      const result = await createPriceAlert({
        productId: "p1",
        userId: "u1",
        targetPrice: 100,
        email: "x@y.com",
      });

      expect(mockedUpsertProduct).toHaveBeenCalled();
      expect(result.id).toBe("a1");
      expect(result.email).toBe("x@y.com");
    });
  });

  describe("listPriceAlerts", () => {
    it("returns alerts filtered by userId", async () => {
      const alerts = [
        { id: "a1", userId: "u1", targetPrice: 50, product: { name: "P1" } },
        { id: "a2", userId: "u1", targetPrice: 80, product: { name: "P2" } },
      ];

      Object.defineProperty(prisma, "priceAlert", {
        value: {
          findMany: vi.fn().mockResolvedValueOnce(alerts),
        },
        configurable: true,
      });

      const result = await listPriceAlerts("u1");

      expect(result).toHaveLength(2);
      expect(prisma.priceAlert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "u1" },
          orderBy: { createdAt: "desc" },
        }),
      );
    });
  });

  describe("updatePriceAlert", () => {
    it("returns null when alert not found or not owned", async () => {
      Object.defineProperty(prisma, "priceAlert", {
        value: {
          findFirst: vi.fn().mockResolvedValueOnce(null),
        },
        configurable: true,
      });

      const result = await updatePriceAlert("a1", { targetPrice: 50 }, "u1");

      expect(result).toBeNull();
    });

    it("updates alert fields", async () => {
      const existingAlert = {
        id: "a1",
        userId: "u1",
        targetPrice: { toNumber: () => 100 },
        email: "old@y.com",
        isActive: true,
      };
      const updatedAlert = {
        id: "a1",
        targetPrice: 80,
        email: "new@y.com",
        isActive: true,
        product: { name: "P1" },
      };

      Object.defineProperty(prisma, "priceAlert", {
        value: {
          findFirst: vi.fn().mockResolvedValueOnce(existingAlert),
          update: vi.fn().mockResolvedValueOnce(updatedAlert),
        },
        configurable: true,
      });

      const result = await updatePriceAlert("a1", { targetPrice: 80, email: "new@y.com" }, "u1");

      expect(result).not.toBeNull();
      expect(result!.targetPrice).toBe(80);
      expect(result!.email).toBe("new@y.com");
    });
  });

  describe("deletePriceAlert", () => {
    it("returns null when alert not found or not owned", async () => {
      Object.defineProperty(prisma, "priceAlert", {
        value: {
          findFirst: vi.fn().mockResolvedValueOnce(null),
        },
        configurable: true,
      });

      const result = await deletePriceAlert("a1", "u1");

      expect(result).toBeNull();
    });

    it("deletes the alert when ownership is valid", async () => {
      const existingAlert = { id: "a1", userId: "u1" };

      Object.defineProperty(prisma, "priceAlert", {
        value: {
          findFirst: vi.fn().mockResolvedValueOnce(existingAlert),
          delete: vi.fn().mockResolvedValueOnce(existingAlert),
        },
        configurable: true,
      });

      const result = await deletePriceAlert("a1", "u1");

      expect(result).toEqual(existingAlert);
      expect(prisma.priceAlert.delete).toHaveBeenCalledWith({ where: { id: "a1" } });
    });
  });
});
