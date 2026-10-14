import { prisma } from "../prisma/client";
import { getProductById, upsertProduct } from "./productService";
import { Prisma } from "@prisma/client";

export type CreateFavoriteInput = {
  productId: string;
  userId: string;
  userName?: string;
};

export async function createFavorite(input: CreateFavoriteInput) {
  const product = await getProductById(input.productId);

  if (!product) {
    throw new Error("Produto não encontrado.");
  }

  const savedProductId = await upsertProduct(product);

  const existingFavorite = await prisma.favorite.findFirst({
    where: {
      userId: input.userId,
      productId: savedProductId,
    },
    include: {
      product: true,
    },
  });

  if (existingFavorite) {
    return existingFavorite;
  }

  try {
    return await prisma.favorite.create({
      data: {
        productId: savedProductId,
        userId: input.userId,
        userName: input.userName ?? "Aluno PriceWatch",
      },
      include: {
        product: true,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const recoveredFavorite = await prisma.favorite.findFirst({
        where: {
          userId: input.userId,
          productId: savedProductId,
        },
        include: {
          product: true,
        },
      });

      if (recoveredFavorite) {
        return recoveredFavorite;
      }
    }

    throw error;
  }
}

export async function listFavorites(userId: string) {
  return prisma.favorite.findMany({
    orderBy: {
      createdAt: "desc",
    },
    where: {
      userId,
    },
    include: {
      product: true,
    },
  });
}

export async function findFavoriteForProduct(userId: string, productId: string) {
  return prisma.favorite.findUnique({
    where: {
      userId_productId: { userId, productId },
    },
    select: { id: true, productId: true },
  });
}

export async function findFavoritesForProducts(userId: string, productIds: string[]) {
  if (productIds.length === 0) {
    return [];
  }

  return prisma.favorite.findMany({
    where: {
      userId,
      productId: { in: productIds },
    },
    select: { id: true, productId: true },
  });
}

export async function deleteFavorite(id: string, userId: string) {
  const favorite = await prisma.favorite.findFirst({
    where: { id, userId },
    include: { product: true },
  });

  if (!favorite) {
    return null;
  }

  await prisma.favorite.delete({ where: { id } });

  return favorite;
}
