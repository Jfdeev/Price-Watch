import jwt from "jsonwebtoken";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { app } from "../../../src/app";
import { prisma } from "../../../src/prisma/client";

const originalFavorite = prisma.favorite;
const originalProduct = prisma.product;
const JWT_SECRET = process.env.JWT_SECRET ?? "change_this_to_a_secure_value";

function buildToken(userId = "user-1", role = "USER") {
  return jwt.sign({ userId, role }, JWT_SECRET);
}

afterEach(() => {
  Object.defineProperty(prisma, "favorite", {
    value: originalFavorite,
    configurable: true,
  });
  Object.defineProperty(prisma, "product", {
    value: originalProduct,
    configurable: true,
  });
});

describe("favorite routes", () => {
  it("GET /favorites exige autenticacao", async () => {
    const response = await request(app).get("/favorites");

    expect(response.status).toBe(401);
  });

  it("GET /favorites lista favoritos do usuario autenticado", async () => {
    Object.defineProperty(prisma, "favorite", {
      value: {
        findMany: async () => [
          {
            id: "fav-1",
            userId: "user-1",
            userName: "Usuario",
            createdAt: new Date("2026-05-21T10:00:00.000Z"),
            product: {
              id: "prod-1",
              externalId: "ext-1",
              name: "Notebook",
              price: 3999,
              imageUrl: null,
              productUrl: null,
              storeName: "Loja",
              category: null,
            },
          },
        ],
      },
      configurable: true,
    });

    const token = buildToken("user-1");
    const response = await request(app)
      .get("/favorites")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].id).toBe("fav-1");
  });

  it("POST /favorites cria favorito para usuario autenticado", async () => {
    Object.defineProperty(prisma, "product", {
      value: {
        findFirst: async () => ({
          id: "prod-1",
          externalId: "ext-1",
          name: "Notebook",
          price: 3999,
          imageUrl: null,
          productUrl: null,
          storeName: "Loja",
          category: null,
        }),
        findUnique: async () => null,
        upsert: async () => ({ id: "prod-1", externalId: "ext-1" }),
      },
      configurable: true,
    });

    Object.defineProperty(prisma, "favorite", {
      value: {
        findFirst: async () => null,
        create: async () => ({
          id: "fav-1",
          userId: "user-1",
          userName: "Usuario",
          createdAt: new Date("2026-05-21T10:00:00.000Z"),
          product: {
            id: "prod-1",
            externalId: "ext-1",
            name: "Notebook",
            price: 3999,
            imageUrl: null,
            productUrl: null,
            storeName: "Loja",
            category: null,
          },
        }),
      },
      configurable: true,
    });

    const token = buildToken("user-1");
    const response = await request(app)
      .post("/favorites")
      .set("Authorization", `Bearer ${token}`)
      .send({ productId: "prod-1" });

    expect(response.status).toBe(201);
    expect(response.body.id).toBe("fav-1");
  });

  it("DELETE /favorites/:id remove favorito do usuario autenticado", async () => {
    Object.defineProperty(prisma, "favorite", {
      value: {
        findFirst: async () => ({
          id: "fav-1",
          userId: "user-1",
          product: { id: "prod-1" },
        }),
        delete: async () => ({ id: "fav-1" }),
      },
      configurable: true,
    });

    const token = buildToken("user-1");
    const response = await request(app)
      .delete("/favorites/fav-1")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(204);
  });

  it("GET /favorites/product/:productId exige autenticacao", async () => {
    const response = await request(app).get("/favorites/product/prod-1");

    expect(response.status).toBe(401);
  });

  it("GET /favorites/product/:productId retorna o favorito do produto", async () => {
    Object.defineProperty(prisma, "favorite", {
      value: {
        findUnique: async (args: {
          where: { userId_productId: { userId: string; productId: string } };
        }) =>
          args.where.userId_productId.userId === "user-1" &&
          args.where.userId_productId.productId === "prod-1"
            ? { id: "fav-1", productId: "prod-1" }
            : null,
      },
      configurable: true,
    });

    const token = buildToken("user-1");
    const found = await request(app)
      .get("/favorites/product/prod-1")
      .set("Authorization", `Bearer ${token}`);
    const missing = await request(app)
      .get("/favorites/product/prod-2")
      .set("Authorization", `Bearer ${token}`);

    expect(found.status).toBe(200);
    expect(found.body).toEqual({ id: "fav-1", productId: "prod-1" });
    expect(missing.status).toBe(200);
    expect(missing.body).toBeNull();
  });

  it("POST /favorites/lookup exige autenticacao", async () => {
    const response = await request(app).post("/favorites/lookup").send({ productIds: [] });

    expect(response.status).toBe(401);
  });

  it("POST /favorites/lookup retorna apenas os favoritos dos produtos pedidos", async () => {
    Object.defineProperty(prisma, "favorite", {
      value: {
        findMany: async () => [{ id: "fav-1", productId: "prod-1" }],
      },
      configurable: true,
    });

    const token = buildToken("user-1");
    const response = await request(app)
      .post("/favorites/lookup")
      .set("Authorization", `Bearer ${token}`)
      .send({ productIds: ["prod-1", "prod-2"] });

    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ id: "fav-1", productId: "prod-1" }]);
  });

  it("POST /favorites/lookup rejeita lista invalida", async () => {
    const token = buildToken("user-1");
    const response = await request(app)
      .post("/favorites/lookup")
      .set("Authorization", `Bearer ${token}`)
      .send({ productIds: "prod-1" });

    expect(response.status).toBe(400);
  });
});
