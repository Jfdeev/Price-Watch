import { Prisma } from "@prisma/client";
import { prisma } from "../src/prisma/client";
import { toNormalizedProductUrlColumn } from "../src/services/productUrl";

export async function backfillNormalizedProductUrls(batchSize = 1_000): Promise<number> {
  let updated = 0;
  let cursor: string | undefined;

  for (;;) {
    const rows = await prisma.product.findMany({
      select: { id: true, productUrl: true, normalizedProductUrl: true },
      orderBy: { id: "asc" },
      take: batchSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
    });
    if (rows.length === 0) {
      return updated;
    }
    cursor = rows[rows.length - 1].id;

    const changes = rows
      .map((row) => ({
        id: row.id,
        value: toNormalizedProductUrlColumn(row.productUrl),
        current: row.normalizedProductUrl
      }))
      .filter((row) => row.value !== row.current);

    if (changes.length > 0) {
      await prisma.$executeRaw(Prisma.sql`
        UPDATE "Product" AS p
        SET "normalizedProductUrl" = u.value
        FROM unnest(${changes.map((row) => row.id)}::text[], ${changes.map((row) => row.value)}::text[]) AS u(id, value)
        WHERE p."id" = u.id
      `);
      updated += changes.length;
    }
  }
}
