import jwt from "jsonwebtoken";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../../../src/app";
import { prisma } from "../../../src/prisma/client";

const JWT_SECRET = process.env.JWT_SECRET ?? "change_this_to_a_secure_value";
const originalStore = prisma.store;
const originalPriceHistory = prisma.priceHistory;
const originalPriceHistoryEntry = prisma.priceHistoryEntry;
const originalUser = prisma.user;
const originalProduct = prisma.product;

function buildToken(role = "USER") {
  return jwt.sign({ userId: "user-1", role }, JWT_SECRET);
}

afterEach(() => {
  Object.defineProperty(prisma, "store", {
    value: originalStore,
    configurable: true,
  });
  Object.defineProperty(prisma, "priceHistory", {
    value: originalPriceHistory,
    configurable: true,
  });
  Object.defineProperty(prisma, "priceHistoryEntry", {
    value: originalPriceHistoryEntry,
    configurable: true,
  });
  Object.defineProperty(prisma, "user", {
    value: originalUser,
    configurable: true,
  });
  Object.defineProperty(prisma, "product", {
    value: originalProduct,
    configurable: true,
  });
});

describe("admin routes", () => {
  it("POST /stores bloqueia usuario nao admin", async () => {
    const response = await request(app)
      .post("/stores")
      .set("Authorization", `Bearer ${buildToken("USER")}`)
      .send({
        name: "Loja",
        website: "https://loja.test",
        contactEmail: "contato@loja.test",
      });

    expect(response.status).toBe(403);
  });

  it("POST /stores permite admin", async () => {
    Object.defineProperty(prisma, "store", {
      value: {
        create: async () => ({
          id: "store-1",
          name: "Loja",
          website: "https://loja.test",
          contactEmail: "contato@loja.test",
          isActive: true,
          createdAt: new Date("2026-05-21T10:00:00.000Z"),
          updatedAt: new Date("2026-05-21T10:00:00.000Z"),
        }),
      },
      configurable: true,
    });

    const response = await request(app)
      .post("/stores")
      .set("Authorization", `Bearer ${buildToken("ADMIN")}`)
      .send({
        name: "Loja",
        website: "https://loja.test",
        contactEmail: "contato@loja.test",
      });

    expect(response.status).toBe(201);
    expect(response.body.id).toBe("store-1");
  });

  it("POST /price-history bloqueia usuario nao admin", async () => {
    const response = await request(app)
      .post("/price-history")
      .set("Authorization", `Bearer ${buildToken("USER")}`)
      .send({ productName: "Produto", oldPrice: 1000, newPrice: 900 });

    expect(response.status).toBe(403);
  });

  it("POST /price-history permite admin", async () => {
    Object.defineProperty(prisma, "priceHistoryEntry", {
      value: {
        create: async () => ({
          id: "history-1",
          productName: "Produto",
          oldPrice: 1000,
          newPrice: 900,
          capturedAt: new Date("2026-05-21T10:00:00.000Z"),
        }),
      },
      configurable: true,
    });

    const response = await request(app)
      .post("/price-history")
      .set("Authorization", `Bearer ${buildToken("ADMIN")}`)
      .send({ productName: "Produto", oldPrice: 1000, newPrice: 900 });

    expect(response.status).toBe(201);
    expect(response.body.id).toBe("history-1");
  });

  it("GET /users bloqueia usuario nao admin", async () => {
    const response = await request(app)
      .get("/users")
      .set("Authorization", `Bearer ${buildToken("USER")}`);

    expect(response.status).toBe(403);
  });

  it("GET /users permite admin", async () => {
    Object.defineProperty(prisma, "user", {
      value: {
        findMany: async () => [
          {
            id: "user-1",
            email: "admin@example.com",
            name: "Admin",
            role: "ADMIN",
            createdAt: new Date("2026-05-21T10:00:00.000Z"),
          },
        ],
      },
      configurable: true,
    });

    const response = await request(app)
      .get("/users")
      .set("Authorization", `Bearer ${buildToken("ADMIN")}`);

    expect(response.status).toBe(200);
    expect(response.body.users).toHaveLength(1);
  });

  it("DELETE /products/:id bloqueia usuario nao admin", async () => {
    const response = await request(app)
      .delete("/products/prod-1")
      .set("Authorization", `Bearer ${buildToken("USER")}`);

    expect(response.status).toBe(403);
  });

  it("POST /products bloqueia usuario nao admin", async () => {
    const response = await request(app)
      .post("/products")
      .set("Authorization", `Bearer ${buildToken("USER")}`)
      .send({
        name: "Produto manual",
        price: 199.9
      });

    expect(response.status).toBe(403);
  });

  it("POST /products permite admin", async () => {
    Object.defineProperty(prisma, "product", {
      value: {
        create: async () => ({
          id: "prod-1",
          externalId: "manual-prod-1",
          name: "Produto manual",
          price: 199.9,
          imageUrl: null,
          productUrl: null,
          storeName: null,
          category: null,
          isManual: true,
          isDeleted: false,
          createdAt: new Date("2026-05-21T10:00:00.000Z"),
          updatedAt: new Date("2026-05-21T10:00:00.000Z")
        }),
        findFirst: async () => null
      },
      configurable: true
    });
    Object.defineProperty(prisma, "store", {
      value: {
        findFirst: async () => ({ id: "store-1" })
      },
      configurable: true
    });
    const queryRaw = vi.spyOn(prisma, "$queryRaw").mockResolvedValue([{ found: 1 }] as never);

    const response = await request(app)
      .post("/products")
      .set("Authorization", `Bearer ${buildToken("ADMIN")}`)
      .send({
        name: "Produto manual",
        price: 199.9,
        storeName: "Loja A"
      });

    expect(response.status).toBe(201);
    expect(response.body.id).toBe("prod-1");
    expect(queryRaw).toHaveBeenCalledTimes(3);
    queryRaw.mockRestore();
  });

  it("DELETE /products/:id permite admin quando sem dependencias", async () => {
    Object.defineProperty(prisma, "product", {
      value: {
        findFirst: async () => ({ id: "prod-1" }),
        update: async () => ({ id: "prod-1" }),
      },
      configurable: true,
    });
    Object.defineProperty(prisma, "favorite", {
      value: { count: async () => 0 },
      configurable: true,
    });
    Object.defineProperty(prisma, "priceAlert", {
      value: { count: async () => 0 },
      configurable: true,
    });
    Object.defineProperty(prisma, "priceHistory", {
      value: { count: async () => 0 },
      configurable: true,
    });

    const response = await request(app)
      .delete("/products/prod-1")
      .set("Authorization", `Bearer ${buildToken("ADMIN")}`);

    expect(response.status).toBe(204);
  });
});
