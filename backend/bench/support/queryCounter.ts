import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../../src/prisma/client";

type QueryEventClient = PrismaClient<Prisma.PrismaClientOptions, "query">;

let total = 0;
let attached = false;

export function attachQueryCounter(): void {
  if (process.env.PRISMA_QUERY_EVENTS !== "1") {
    throw new Error("Defina PRISMA_QUERY_EVENTS=1 para contar consultas.");
  }
  if (!attached) {
    (prisma as unknown as QueryEventClient).$on("query", () => {
      total += 1;
    });
    attached = true;
  }
}

const EVENT_FLUSH_MS = 25;

function flushPendingEvents(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, EVENT_FLUSH_MS));
}

export async function countQueries<T>(
  run: () => Promise<T>
): Promise<{ result: T; queries: number }> {
  await flushPendingEvents();
  const start = total;
  const result = await run();
  await flushPendingEvents();
  return { result, queries: total - start };
}
