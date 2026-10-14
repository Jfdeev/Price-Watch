import { prisma } from "../src/prisma/client";
import { backfillNormalizedProductUrls } from "./backfillNormalizedProductUrl";

backfillNormalizedProductUrls()
  .then((updated) => {
    console.warn(`normalizedProductUrl preenchida em ${updated} produto(s).`);
  })
  .finally(() => prisma.$disconnect());
