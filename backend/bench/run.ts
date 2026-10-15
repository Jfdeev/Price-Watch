import { databaseUrlFor } from "./support/databaseUrl";

process.env.DATABASE_URL = databaseUrlFor("pricewatch_bench");
process.env.PRISMA_QUERY_EVENTS = "1";

async function main() {
  const { runSuites } = await import("./suites");
  await runSuites(process.argv.slice(2));
}

void main();
