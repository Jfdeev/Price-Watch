import { Prisma, PrismaClient } from "@prisma/client";

export function buildLogOptions(): Prisma.LogDefinition[] {
  if (process.env.PRISMA_QUERY_EVENTS === "1") {
    return [{ emit: "event", level: "query" }];
  }
  return [];
}

export const prisma = new PrismaClient({ log: buildLogOptions() });
