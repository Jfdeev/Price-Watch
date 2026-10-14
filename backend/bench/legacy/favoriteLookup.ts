import { listFavorites } from "../../src/services/favoriteService";

export async function legacyFavoriteForProduct(userId: string, productId: string) {
  const favorites = await listFavorites(userId);
  const match = favorites.find((favorite) => favorite.product.id === productId);
  return match ? { id: match.id, productId: match.product.id } : null;
}

export async function legacyFavoritesByProduct(userId: string, productIds: string[]) {
  const favorites = await listFavorites(userId);
  const favoritesByProduct = new Map(favorites.map((item) => [item.product.id, item.id]));
  return productIds
    .filter((productId) => favoritesByProduct.has(productId))
    .map((productId) => ({ id: favoritesByProduct.get(productId) as string, productId }));
}
