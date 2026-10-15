import { prisma } from "../../src/prisma/client";
import { normalizeProductUrl } from "../../src/services/productUrl";

export async function legacyDeletedProductUrls(): Promise<Set<string>> {
  const deletedProducts = await prisma.product.findMany({
    where: {
      isDeleted: true
    },
    select: {
      productUrl: true,
      name: true,
      storeName: true
    }
  });

  const deletedUrls = new Set(
    deletedProducts
      .map((product) => normalizeProductUrl(product.productUrl))
      .filter((value) => value.length > 0)
  );

  return deletedUrls;
}
