import type { Request, Response } from "express";
import {
  createFavorite,
  deleteFavorite,
  findFavoriteForProduct,
  findFavoritesForProducts,
  listFavorites,
} from "../services/favoriteService";

const MAX_LOOKUP_PRODUCT_IDS = 100;

function isProductIdList(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= MAX_LOOKUP_PRODUCT_IDS &&
    value.every((item) => typeof item === "string" && item.length > 0)
  );
}

export async function createFavoriteController(
  request: Request,
  response: Response,
) {
  try {
    const userId = (request as any).user?.id as string | undefined;
    if (!userId) {
      return response.status(401).json({ message: "Unauthorized" });
    }

    const favorite = await createFavorite({
      productId: request.body.productId,
      userId,
      userName: request.body.userName,
    });

    return response.status(201).json(favorite);
  } catch (error) {
    return response.status(400).json({
      message:
        error instanceof Error ? error.message : "Erro ao favoritar produto.",
    });
  }
}

export async function listFavoritesController(
  request: Request,
  response: Response,
) {
  const userId = (request as any).user?.id as string | undefined;
  if (!userId) {
    return response.status(401).json({ message: "Unauthorized" });
  }

  const favorites = await listFavorites(userId);
  return response.json(favorites);
}

export async function deleteFavoriteController(
  request: Request,
  response: Response,
) {
  const userId = (request as any).user?.id as string | undefined;
  if (!userId) {
    return response.status(401).json({ message: "Unauthorized" });
  }

  const favorite = await deleteFavorite(request.params.id, userId);

  if (!favorite) {
    return response.status(404).json({ message: "Favorito não encontrado." });
  }

  return response.status(204).send();
}

export async function getFavoriteForProductController(
  request: Request,
  response: Response,
) {
  const userId = (request as any).user?.id as string | undefined;
  if (!userId) {
    return response.status(401).json({ message: "Unauthorized" });
  }

  const favorite = await findFavoriteForProduct(userId, request.params.productId);
  return response.json(favorite);
}

export async function lookupFavoritesController(
  request: Request,
  response: Response,
) {
  const userId = (request as any).user?.id as string | undefined;
  if (!userId) {
    return response.status(401).json({ message: "Unauthorized" });
  }

  const productIds = request.body?.productIds;
  if (!isProductIdList(productIds)) {
    return response.status(400).json({ message: "Lista de produtos inválida." });
  }

  const favorites = await findFavoritesForProducts(userId, productIds);
  return response.json(favorites);
}
