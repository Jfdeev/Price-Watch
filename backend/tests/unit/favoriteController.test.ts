import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/services/favoriteService", () => ({
  createFavorite: vi.fn(),
  listFavorites: vi.fn(),
  deleteFavorite: vi.fn(),
  findFavoriteForProduct: vi.fn(),
  findFavoritesForProducts: vi.fn(),
}));

import {
  createFavoriteController,
  listFavoritesController,
  deleteFavoriteController,
  getFavoriteForProductController,
  lookupFavoritesController,
} from "../../src/controllers/favoriteController";
import * as svc from "../../src/services/favoriteService";

function mockReqRes(body: any = {}, params: any = {}, user?: { id: string }) {
  const req = { body, params } as any;
  if (user) req.user = user;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  } as any;
  return { req, res };
}

beforeEach(() => vi.clearAllMocks());

describe("createFavoriteController", () => {
  it("creates favorite", async () => {
    const fav = { id: "f1" };
    vi.mocked(svc.createFavorite).mockResolvedValue(fav as any);
    const { req, res } = mockReqRes({ productId: "p1" }, {}, { id: "u1" });
    await createFavoriteController(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("returns 401 without user", async () => {
    const { req, res } = mockReqRes();
    await createFavoriteController(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 400 on error", async () => {
    vi.mocked(svc.createFavorite).mockRejectedValue(new Error("fail"));
    const { req, res } = mockReqRes({ productId: "p1" }, {}, { id: "u1" });
    await createFavoriteController(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe("listFavoritesController", () => {
  it("returns favorites", async () => {
    const favs = [{ id: "f1" }];
    vi.mocked(svc.listFavorites).mockResolvedValue(favs as any);
    const { req, res } = mockReqRes({}, {}, { id: "u1" });
    await listFavoritesController(req, res);
    expect(res.json).toHaveBeenCalledWith(favs);
  });

  it("returns 401 without user", async () => {
    const { req, res } = mockReqRes();
    await listFavoritesController(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe("deleteFavoriteController", () => {
  it("deletes favorite", async () => {
    vi.mocked(svc.deleteFavorite).mockResolvedValue(true as any);
    const { req, res } = mockReqRes({}, { id: "f1" }, { id: "u1" });
    await deleteFavoriteController(req, res);
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it("returns 404 when not found", async () => {
    vi.mocked(svc.deleteFavorite).mockResolvedValue(null as any);
    const { req, res } = mockReqRes({}, { id: "x" }, { id: "u1" });
    await deleteFavoriteController(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns 401 without user", async () => {
    const { req, res } = mockReqRes();
    await deleteFavoriteController(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe("getFavoriteForProductController", () => {
  it("returns the favorite of the product for the user", async () => {
    vi.mocked(svc.findFavoriteForProduct).mockResolvedValue({ id: "f1", productId: "p1" });
    const { req, res } = mockReqRes({}, { productId: "p1" }, { id: "u1" });
    await getFavoriteForProductController(req, res);
    expect(svc.findFavoriteForProduct).toHaveBeenCalledWith("u1", "p1");
    expect(res.json).toHaveBeenCalledWith({ id: "f1", productId: "p1" });
  });

  it("returns null when the product is not a favorite", async () => {
    vi.mocked(svc.findFavoriteForProduct).mockResolvedValue(null);
    const { req, res } = mockReqRes({}, { productId: "p1" }, { id: "u1" });
    await getFavoriteForProductController(req, res);
    expect(res.json).toHaveBeenCalledWith(null);
  });

  it("returns 401 without user", async () => {
    const { req, res } = mockReqRes({}, { productId: "p1" });
    await getFavoriteForProductController(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(svc.findFavoriteForProduct).not.toHaveBeenCalled();
  });
});

describe("lookupFavoritesController", () => {
  it("returns the favorites of the requested products", async () => {
    vi.mocked(svc.findFavoritesForProducts).mockResolvedValue([{ id: "f1", productId: "p1" }]);
    const { req, res } = mockReqRes({ productIds: ["p1", "p2"] }, {}, { id: "u1" });
    await lookupFavoritesController(req, res);
    expect(svc.findFavoritesForProducts).toHaveBeenCalledWith("u1", ["p1", "p2"]);
    expect(res.json).toHaveBeenCalledWith([{ id: "f1", productId: "p1" }]);
  });

  it("accepts an empty list", async () => {
    vi.mocked(svc.findFavoritesForProducts).mockResolvedValue([]);
    const { req, res } = mockReqRes({ productIds: [] }, {}, { id: "u1" });
    await lookupFavoritesController(req, res);
    expect(res.json).toHaveBeenCalledWith([]);
  });

  it.each([
    [undefined],
    ["p1"],
    [[1, 2]],
    [[""]],
    [Array.from({ length: 101 }, (_, index) => `p${index}`)],
  ])("returns 400 for invalid productIds %j", async (productIds) => {
    const { req, res } = mockReqRes({ productIds }, {}, { id: "u1" });
    await lookupFavoritesController(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(svc.findFavoritesForProducts).not.toHaveBeenCalled();
  });

  it("returns 401 without user", async () => {
    const { req, res } = mockReqRes({ productIds: ["p1"] });
    await lookupFavoritesController(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
