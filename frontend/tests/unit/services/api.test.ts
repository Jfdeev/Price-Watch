import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  setAuthToken,
  registerUser,
  loginUser,
  getCurrentUser,
  updateCurrentUser,
  deleteCurrentUser,
  getUsers,
  updateUserRole,
  searchProducts,
  getShowcaseProducts,
  mapProductToCard,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  favoriteProduct,
  deleteFavorite,
  listFavorites,
  getFavoriteForProduct,
  lookupFavorites,
  createAlert,
  updateAlert,
  deleteAlert,
  listAlerts,
  listStores,
  createStore,
  updateStore,
  deleteStore,
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  listPriceHistory,
  createPriceHistory,
  updatePriceHistory,
  deletePriceHistory,
  listProductPriceHistory,
  listProductOffers
} from "../../../src/services/api";
import type { Product } from "../../../src/services/api";

const mockFetch = vi.fn();
global.fetch = mockFetch;

function jsonResponse(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data)
  });
}

function emptyResponse() {
  return Promise.resolve({
    ok: true,
    status: 204,
    json: () => Promise.resolve(undefined)
  });
}

function errorResponse(message: string, status = 400) {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve({ message })
  });
}

beforeEach(() => {
  mockFetch.mockReset();
  localStorage.clear();
  setAuthToken(null);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("setAuthToken", () => {
  it("stores token in localStorage", () => {
    setAuthToken("abc123");
    expect(localStorage.getItem("pw_token")).toBe("abc123");
  });

  it("removes token from localStorage when null", () => {
    localStorage.setItem("pw_token", "old");
    setAuthToken(null);
    expect(localStorage.getItem("pw_token")).toBeNull();
  });
});

describe("mapProductToCard", () => {
  it("maps product to card view using API pricing metadata", () => {
    const product: Product = {
      id: "1",
      externalId: "ext-1",
      name: "Notebook",
      price: 3000,
      originalPrice: 3600,
      priceChange: -16.7,
      imageUrl: "https://img.com/nb.jpg",
      productUrl: "https://store.com/nb",
      storeName: "TechStore",
      category: "Electronics"
    };

    const card = mapProductToCard(product);

    expect(card.id).toBe("1");
    expect(card.name).toBe("Notebook");
    expect(card.currentPrice).toBe(3000);
    expect(card.image).toBe("https://img.com/nb.jpg");
    expect(card.store).toBe("TechStore");
    expect(card.originalPrice).toBe(3600);
    expect(card.priceChange).toBe(-16.7);
  });

  it("keeps optional pricing metadata undefined when not provided", () => {
    const product: Product = {
      id: "2",
      externalId: "ext-2",
      name: "",
      price: 0
    };

    const card = mapProductToCard(product);

    expect(card.name).toBe("");
    expect(card.store).toBe("Loja parceira");
    expect(card.image).toContain("unsplash");
    expect(card.originalPrice).toBeUndefined();
    expect(card.priceChange).toBeUndefined();
  });
});

describe("Auth API", () => {
  it("registerUser sends POST with credentials", async () => {
    const mockResponse = { token: "t1", user: { id: "u1", email: "a@b.com", role: "USER" } };
    mockFetch.mockReturnValueOnce(jsonResponse(mockResponse));

    const result = await registerUser("John", "a@b.com", "pass123");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/auth/register"),
      expect.objectContaining({ method: "POST" })
    );
    expect(result.token).toBe("t1");
  });

  it("loginUser sends POST with email and password", async () => {
    const mockResponse = { token: "t2", user: { id: "u1", email: "a@b.com", role: "USER" } };
    mockFetch.mockReturnValueOnce(jsonResponse(mockResponse));

    const result = await loginUser("a@b.com", "pass123");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/auth/login/local"),
      expect.objectContaining({ method: "POST" })
    );
    expect(result.token).toBe("t2");
  });

  it("getCurrentUser sends GET with auth header", async () => {
    setAuthToken("mytoken");
    const mockResponse = { user: { id: "u1", email: "a@b.com", role: "USER" } };
    mockFetch.mockReturnValueOnce(jsonResponse(mockResponse));

    const result = await getCurrentUser();

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/auth/me"),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer mytoken" })
      })
    );
    expect(result.user.email).toBe("a@b.com");
  });

  it("updateCurrentUser sends PATCH", async () => {
    setAuthToken("mytoken");
    const mockResponse = { user: { id: "u1", email: "a@b.com", name: "New", role: "USER" } };
    mockFetch.mockReturnValueOnce(jsonResponse(mockResponse));

    const result = await updateCurrentUser({ name: "New" });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/auth/me"),
      expect.objectContaining({ method: "PATCH" })
    );
    expect(result.user.name).toBe("New");
  });

  it("deleteCurrentUser sends DELETE", async () => {
    setAuthToken("mytoken");
    mockFetch.mockReturnValueOnce(emptyResponse());

    await deleteCurrentUser();

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/auth/me"),
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("throws on error response", async () => {
    mockFetch.mockReturnValueOnce(errorResponse("Email already in use", 409));

    await expect(registerUser("X", "x@y.com", "p")).rejects.toThrow("Email already in use");
  });

  it("falls back to a generic message when the API error is not JSON", async () => {
    mockFetch.mockReturnValueOnce(
      Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error("invalid json"))
      })
    );

    await expect(getCurrentUser()).rejects.toThrow("Falha na comunicação com a API.");
  });
});

describe("Admin API", () => {
  it("getUsers fetches user list", async () => {
    setAuthToken("admin-token");
    mockFetch.mockReturnValueOnce(
      jsonResponse({ users: [{ id: "u1", email: "a@b.com", role: "ADMIN" }] })
    );

    const result = await getUsers();

    expect(result.users).toHaveLength(1);
  });

  it("updateUserRole sends PATCH with role", async () => {
    setAuthToken("admin-token");
    mockFetch.mockReturnValueOnce(
      jsonResponse({ user: { id: "u1", email: "a@b.com", role: "ADMIN" } })
    );

    const result = await updateUserRole("u1", "ADMIN");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/users/u1/role"),
      expect.objectContaining({ method: "PATCH" })
    );
    expect(result.user.role).toBe("ADMIN");
  });
});

describe("Products API", () => {
  it("searchProducts with query and pagination", async () => {
    const mockResponse = {
      products: [],
      source: "serpapi",
      page: 2,
      limit: 10,
      hasNextPage: false,
      hasPreviousPage: true
    };
    mockFetch.mockReturnValueOnce(jsonResponse(mockResponse));

    const result = await searchProducts("notebook", { page: 2, limit: 10 });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringMatching(/q=notebook.*page=2.*limit=10/),
      expect.anything()
    );
    expect(result.page).toBe(2);
  });

  it("getShowcaseProducts sends query params when provided", async () => {
    const mockResponse = {
      products: [{ id: "p1", externalId: "e1", name: "Notebook", price: 1000 }],
      source: "mock",
      page: 2,
      limit: 24,
      hasNextPage: false,
      hasPreviousPage: false
    };
    mockFetch.mockReturnValueOnce(jsonResponse(mockResponse));

    const result = await getShowcaseProducts({ page: 2, limit: 24 });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/products/showcase?page=2&limit=24"),
      expect.anything()
    );
    expect(result.source).toBe("mock");
  });

  it("getShowcaseProducts uses the base path when no filters are provided", async () => {
    mockFetch.mockReturnValueOnce(
      jsonResponse({
        products: [],
        source: "mock",
        page: 1,
        limit: 8,
        hasNextPage: false,
        hasPreviousPage: false
      })
    );

    await getShowcaseProducts();

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/products/showcase"),
      expect.anything()
    );
  });

  it("searchProducts uses default pagination when omitted", async () => {
    const mockResponse = {
      products: [],
      source: "serpapi",
      page: 1,
      limit: 8,
      hasNextPage: false,
      hasPreviousPage: false
    };
    mockFetch.mockReturnValueOnce(jsonResponse(mockResponse));

    await searchProducts("notebook");

    expect(mockFetch).toHaveBeenCalledWith(expect.stringMatching(/q=notebook/), expect.anything());
  });

  it("createProduct sends POST with product payload", async () => {
    const product: Product = {
      id: "p1",
      externalId: "manual-p1",
      name: "Produto Manual",
      price: 100
    };
    mockFetch.mockReturnValueOnce(jsonResponse(product));

    const result = await createProduct({ name: "Produto Manual", price: 100 });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/products"),
      expect.objectContaining({ method: "POST" })
    );
    expect(result.name).toBe("Produto Manual");
  });

  it("listProductPriceHistory hits the product history endpoint", async () => {
    mockFetch.mockReturnValueOnce(jsonResponse([{ id: "h1", oldPrice: 10, newPrice: 8 }]));

    const result = await listProductPriceHistory("p1");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/products/p1/history"),
      expect.anything()
    );
    expect(result).toHaveLength(1);
  });

  it("listProductOffers hits the offers endpoint with limit", async () => {
    mockFetch.mockReturnValueOnce(jsonResponse([{ externalId: "o1", name: "Oferta", price: 9 }]));

    const result = await listProductOffers("p1", 3);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/products/p1/offers?limit=3"),
      expect.anything()
    );
    expect(result).toHaveLength(1);
  });

  it("getProduct fetches by id", async () => {
    const product: Product = { id: "p1", externalId: "e1", name: "Item", price: 100 };
    mockFetch.mockReturnValueOnce(jsonResponse(product));

    const result = await getProduct("p1");

    expect(result?.name).toBe("Item");
  });

  it("updateProduct sends PUT", async () => {
    const product: Product = { id: "p1", externalId: "e1", name: "Updated", price: 200 };
    mockFetch.mockReturnValueOnce(jsonResponse(product));

    const result = await updateProduct("p1", { name: "Updated", price: 200 });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/products/p1"),
      expect.objectContaining({ method: "PUT" })
    );
    expect(result.name).toBe("Updated");
  });

  it("deleteProduct sends DELETE", async () => {
    mockFetch.mockReturnValueOnce(emptyResponse());

    await deleteProduct("p1");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/products/p1"),
      expect.objectContaining({ method: "DELETE" })
    );
  });
});

describe("Favorites API", () => {
  it("favoriteProduct sends POST", async () => {
    const fav = { id: "f1", userName: "User", createdAt: "2026-01-01", product: { id: "p1" } };
    mockFetch.mockReturnValueOnce(jsonResponse(fav));

    const result = await favoriteProduct("p1");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/favorites"),
      expect.objectContaining({ method: "POST" })
    );
    expect(result.id).toBe("f1");
  });

  it("deleteFavorite sends DELETE", async () => {
    mockFetch.mockReturnValueOnce(emptyResponse());

    await deleteFavorite("f1");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/favorites/f1"),
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("getFavoriteForProduct requests the favorite of one product", async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ id: "f1", productId: "p 1" }));

    const result = await getFavoriteForProduct("p 1");

    expect(result).toEqual({ id: "f1", productId: "p 1" });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/favorites/product/p%201"),
      expect.anything()
    );
  });

  it("getFavoriteForProduct returns null when the product is not a favorite", async () => {
    mockFetch.mockReturnValueOnce(jsonResponse(null));

    await expect(getFavoriteForProduct("p1")).resolves.toBeNull();
  });

  it("lookupFavorites posts the product ids of the page", async () => {
    mockFetch.mockReturnValueOnce(jsonResponse([{ id: "f1", productId: "p1" }]));

    const result = await lookupFavorites(["p1", "p2"]);

    expect(result).toEqual([{ id: "f1", productId: "p1" }]);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/favorites/lookup"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ productIds: ["p1", "p2"] })
      })
    );
  });

  it("listFavorites returns array", async () => {
    mockFetch.mockReturnValueOnce(jsonResponse([]));

    const result = await listFavorites();

    expect(result).toEqual([]);
  });
});

describe("Alerts API", () => {
  it("createAlert sends POST", async () => {
    const alert = { id: "a1", targetPrice: 100, email: "x@y.com", isActive: true };
    mockFetch.mockReturnValueOnce(jsonResponse(alert));

    const result = await createAlert("p1", 100, "x@y.com");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/alerts"),
      expect.objectContaining({ method: "POST" })
    );
    expect(result.targetPrice).toBe(100);
  });

  it("updateAlert sends PUT", async () => {
    const alert = { id: "a1", targetPrice: 80, email: "x@y.com", isActive: true };
    mockFetch.mockReturnValueOnce(jsonResponse(alert));

    const result = await updateAlert("a1", { targetPrice: 80 });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/alerts/a1"),
      expect.objectContaining({ method: "PUT" })
    );
    expect(result.targetPrice).toBe(80);
  });

  it("deleteAlert sends DELETE", async () => {
    mockFetch.mockReturnValueOnce(emptyResponse());

    await deleteAlert("a1");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/alerts/a1"),
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("listAlerts returns array", async () => {
    mockFetch.mockReturnValueOnce(jsonResponse([{ id: "a1" }]));

    const result = await listAlerts();

    expect(result).toHaveLength(1);
  });
});

describe("Stores API", () => {
  it("listStores returns array", async () => {
    mockFetch.mockReturnValueOnce(jsonResponse([{ id: "s1", name: "Store 1" }]));

    const result = await listStores();

    expect(result).toHaveLength(1);
  });

  it("createStore sends POST", async () => {
    const store = { id: "s1", name: "New Store" };
    mockFetch.mockReturnValueOnce(jsonResponse(store));

    const result = await createStore({
      name: "New Store",
      website: "https://s.com",
      contactEmail: "s@s.com"
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/stores"),
      expect.objectContaining({ method: "POST" })
    );
    expect(result.name).toBe("New Store");
  });

  it("updateStore sends PUT", async () => {
    const store = { id: "s1", name: "Updated" };
    mockFetch.mockReturnValueOnce(jsonResponse(store));

    const result = await updateStore("s1", { name: "Updated" });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/stores/s1"),
      expect.objectContaining({ method: "PUT" })
    );
    expect(result.name).toBe("Updated");
  });

  it("deleteStore sends DELETE", async () => {
    mockFetch.mockReturnValueOnce(emptyResponse());

    await deleteStore("s1");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/stores/s1"),
      expect.objectContaining({ method: "DELETE" })
    );
  });
});

describe("Categories API", () => {
  it("listCategories returns array", async () => {
    mockFetch.mockReturnValueOnce(jsonResponse([{ id: "c1", name: "Cat" }]));

    const result = await listCategories();

    expect(result).toHaveLength(1);
  });

  it("createCategory sends POST", async () => {
    const cat = { id: "c1", name: "Electronics" };
    mockFetch.mockReturnValueOnce(jsonResponse(cat));

    const result = await createCategory({ name: "Electronics", description: "Tech" });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/categories"),
      expect.objectContaining({ method: "POST" })
    );
    expect(result.name).toBe("Electronics");
  });

  it("updateCategory sends PUT", async () => {
    const cat = { id: "c1", name: "Updated" };
    mockFetch.mockReturnValueOnce(jsonResponse(cat));

    const result = await updateCategory("c1", { name: "Updated" });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/categories/c1"),
      expect.objectContaining({ method: "PUT" })
    );
    expect(result.name).toBe("Updated");
  });

  it("deleteCategory sends DELETE", async () => {
    mockFetch.mockReturnValueOnce(emptyResponse());

    await deleteCategory("c1");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/categories/c1"),
      expect.objectContaining({ method: "DELETE" })
    );
  });
});

describe("Price History API", () => {
  it("listPriceHistory returns array", async () => {
    mockFetch.mockReturnValueOnce(jsonResponse([{ id: "ph1", productName: "Item" }]));

    const result = await listPriceHistory();

    expect(result).toHaveLength(1);
  });

  it("createPriceHistory sends POST", async () => {
    const record = { id: "ph1", productName: "Item", oldPrice: 100, newPrice: 90 };
    mockFetch.mockReturnValueOnce(jsonResponse(record));

    const result = await createPriceHistory({ productName: "Item", oldPrice: 100, newPrice: 90 });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/price-history"),
      expect.objectContaining({ method: "POST" })
    );
    expect(result.productName).toBe("Item");
  });

  it("updatePriceHistory sends PUT", async () => {
    const record = { id: "ph1", productName: "Updated" };
    mockFetch.mockReturnValueOnce(jsonResponse(record));

    const result = await updatePriceHistory("ph1", { productName: "Updated" });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/price-history/ph1"),
      expect.objectContaining({ method: "PUT" })
    );
    expect(result.productName).toBe("Updated");
  });

  it("deletePriceHistory sends DELETE", async () => {
    mockFetch.mockReturnValueOnce(emptyResponse());

    await deletePriceHistory("ph1");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/price-history/ph1"),
      expect.objectContaining({ method: "DELETE" })
    );
  });
});
