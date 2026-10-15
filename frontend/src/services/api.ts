export type Product = {
  id: string;
  externalId: string;
  name: string;
  price: number;
  originalPrice?: number;
  priceChange?: number;
  imageUrl?: string;
  productUrl?: string;
  storeName?: string;
  category?: string;
};

export type ProductCardView = {
  id: string;
  name: string;
  image: string;
  currentPrice: number;
  originalPrice?: number;
  store: string;
  priceChange?: number;
};

export type ProductSearchResponse = {
  products: Product[];
  source: "serpapi" | "mock";
  page: number;
  limit: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  totalResults?: number;
  totalPages?: number;
  message?: string;
};

export type Favorite = {
  id: string;
  userName: string;
  createdAt: string;
  product: Product;
};

export type FavoriteLookup = {
  id: string;
  productId: string;
};

export type PriceAlert = {
  id: string;
  targetPrice: number;
  email: string;
  isActive: boolean;
  createdAt: string;
  product: Product;
};

export type StoreRecord = {
  id: string;
  name: string;
  website: string;
  contactEmail: string;
  userId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type StoreInput = {
  name: string;
  website: string;
  contactEmail: string;
  isActive?: boolean;
};

export type CategoryRecord = {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CategoryInput = {
  name: string;
  description: string;
  isActive?: boolean;
};

export type PriceHistoryRecord = {
  id: string;
  productName: string;
  oldPrice: number;
  newPrice: number;
  capturedAt: string;
};

export type ProductPriceHistoryRecord = {
  id: string;
  oldPrice: number;
  newPrice: number;
  capturedAt: string;
};

export type ComparableOffer = {
  externalId: string;
  name: string;
  storeName?: string;
  price: number;
  productUrl?: string;
  imageUrl?: string;
};

export type PriceHistoryInput = {
  productName: string;
  oldPrice: number;
  newPrice: number;
  capturedAt?: string;
};

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3333";

let authToken: string | null = localStorage.getItem("pw_token");

export function setAuthToken(token: string | null) {
  authToken = token;
  if (token) localStorage.setItem("pw_token", token);
  else localStorage.removeItem("pw_token");
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const response = await fetch(`${API_URL}${path}`, {
    headers,
    ...options
  });

  if (!response.ok) {
    let message = "Falha na comunicação com a API.";
    const data = await response.json().catch(() => null);
    message = data?.message ?? message;
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function registerUser(name: string | undefined, email: string, password: string) {
  return request<{
    token: string;
    user: { id: string; email: string; name?: string; role: string };
    isFirstAdmin?: boolean;
  }>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password })
  });
}

export async function loginUser(email: string, password: string) {
  return request<{
    token: string;
    user: { id: string; email: string; name?: string; role: string };
  }>("/auth/login/local", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
}

export async function getCurrentUser() {
  return request<{
    user: { id: string; email: string; name?: string; role: string };
  }>("/auth/me");
}

export async function updateCurrentUser(input: { name?: string; password?: string }) {
  return request<{
    user: { id: string; email: string; name?: string; role: string };
  }>("/auth/me", {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export async function deleteCurrentUser() {
  return request<void>("/auth/me", {
    method: "DELETE"
  });
}

export async function getUsers() {
  return request<{
    users: Array<{
      id: string;
      email: string;
      name?: string;
      role: string;
      createdAt: string;
    }>;
  }>("/users");
}

export async function updateUserRole(userId: string, role: "ADMIN" | "USER") {
  return request<{
    user: { id: string; email: string; name?: string; role: string };
  }>(`/users/${userId}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role })
  });
}

export async function searchProducts(
  query: string,
  options?: { page?: number; limit?: number; category?: string }
): Promise<ProductSearchResponse> {
  const searchParams = new URLSearchParams({ q: query });

  if (options?.page) {
    searchParams.set("page", String(options.page));
  }

  if (options?.limit) {
    searchParams.set("limit", String(options.limit));
  }

  if (options?.category && options.category.trim().length > 0) {
    searchParams.set("category", options.category.trim());
  }

  return await request<ProductSearchResponse>(`/products/search?${searchParams.toString()}`);
}

export async function getShowcaseProducts(options?: {
  page?: number;
  limit?: number;
}): Promise<ProductSearchResponse> {
  const searchParams = new URLSearchParams();

  if (options?.page) {
    searchParams.set("page", String(options.page));
  }

  if (options?.limit) {
    searchParams.set("limit", String(options.limit));
  }

  const suffix = searchParams.toString();
  const queryString = suffix ? `?${suffix}` : "";

  return await request<ProductSearchResponse>(`/products/showcase${queryString}`);
}

export function mapProductToCard(product: Product): ProductCardView {
  const price = Number(product.price ?? 0);
  const originalPrice =
    typeof product.originalPrice === "number" ? Number(product.originalPrice) : undefined;
  const priceChange =
    typeof product.priceChange === "number" ? Number(product.priceChange) : undefined;

  return {
    id: product.id,
    name: product.name ?? "Produto sem nome",
    image: product.imageUrl ?? "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=600",
    currentPrice: price,
    originalPrice,
    store: product.storeName ?? "Loja parceira",
    priceChange
  };
}

export async function getProduct(id: string): Promise<Product | undefined> {
  return await request<Product>(`/products/${id}`);
}

export type UpdateProductInput = {
  name?: string;
  price?: number;
  imageUrl?: string | null;
  productUrl?: string | null;
  storeName?: string | null;
  category?: string | null;
};

export type CreateProductInput = {
  name: string;
  price: number;
  imageUrl?: string | null;
  productUrl?: string | null;
  storeName?: string | null;
  category?: string | null;
};

export async function createProduct(input: CreateProductInput) {
  return request<Product>("/products", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function updateProduct(id: string, input: UpdateProductInput) {
  return request<Product>(`/products/${id}`, {
    method: "PUT",
    body: JSON.stringify(input)
  });
}

export async function listProductPriceHistory(productId: string) {
  return request<ProductPriceHistoryRecord[]>(`/products/${productId}/history`);
}

export async function listProductOffers(productId: string, limit = 5) {
  return request<ComparableOffer[]>(`/products/${productId}/offers?limit=${String(limit)}`);
}

export async function deleteProduct(id: string) {
  return request<void>(`/products/${id}`, {
    method: "DELETE"
  });
}

export async function favoriteProduct(productId: string) {
  return request<Favorite>("/favorites", {
    method: "POST",
    body: JSON.stringify({ productId, userName: "Aluno PriceWatch" })
  });
}

export async function deleteFavorite(favoriteId: string) {
  return request<void>(`/favorites/${favoriteId}`, {
    method: "DELETE"
  });
}

export async function listFavorites(): Promise<Favorite[]> {
  return await request<Favorite[]>("/favorites");
}

export async function getFavoriteForProduct(productId: string): Promise<FavoriteLookup | null> {
  return await request<FavoriteLookup | null>(
    `/favorites/product/${encodeURIComponent(productId)}`
  );
}

export async function lookupFavorites(productIds: string[]): Promise<FavoriteLookup[]> {
  return await request<FavoriteLookup[]>("/favorites/lookup", {
    method: "POST",
    body: JSON.stringify({ productIds })
  });
}

export async function createAlert(productId: string, targetPrice: number, email: string) {
  return request<PriceAlert>("/alerts", {
    method: "POST",
    body: JSON.stringify({ productId, targetPrice, email })
  });
}

export async function updateAlert(
  id: string,
  input: { targetPrice?: number; email?: string; isActive?: boolean }
) {
  return request<PriceAlert>(`/alerts/${id}`, {
    method: "PUT",
    body: JSON.stringify(input)
  });
}

export async function deleteAlert(id: string) {
  return request<void>(`/alerts/${id}`, {
    method: "DELETE"
  });
}

export async function listAlerts(): Promise<PriceAlert[]> {
  return await request<PriceAlert[]>("/alerts");
}

export async function listStores(): Promise<StoreRecord[]> {
  return await request<StoreRecord[]>("/stores");
}

export async function createStore(input: StoreInput) {
  return request<StoreRecord>("/stores", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function updateStore(id: string, input: Partial<StoreInput>) {
  return request<StoreRecord>(`/stores/${id}`, {
    method: "PUT",
    body: JSON.stringify(input)
  });
}

export async function deleteStore(id: string) {
  return request<void>(`/stores/${id}`, {
    method: "DELETE"
  });
}

export async function listCategories(): Promise<CategoryRecord[]> {
  return await request<CategoryRecord[]>("/categories");
}

export async function createCategory(input: CategoryInput) {
  return request<CategoryRecord>("/categories", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function updateCategory(id: string, input: Partial<CategoryInput>) {
  return request<CategoryRecord>(`/categories/${id}`, {
    method: "PUT",
    body: JSON.stringify(input)
  });
}

export async function deleteCategory(id: string) {
  return request<void>(`/categories/${id}`, {
    method: "DELETE"
  });
}

export async function listPriceHistory(): Promise<PriceHistoryRecord[]> {
  return await request<PriceHistoryRecord[]>("/price-history");
}

export async function createPriceHistory(input: PriceHistoryInput) {
  return request<PriceHistoryRecord>("/price-history", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function updatePriceHistory(id: string, input: Partial<PriceHistoryInput>) {
  return request<PriceHistoryRecord>(`/price-history/${id}`, {
    method: "PUT",
    body: JSON.stringify(input)
  });
}

export async function deletePriceHistory(id: string) {
  return request<void>(`/price-history/${id}`, {
    method: "DELETE"
  });
}
