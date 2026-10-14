import path from "node:path";
import { config } from "dotenv";

export function databaseUrlFor(databaseName: string): string {
  config({ path: path.join(__dirname, "..", "..", ".env") });
  const base = process.env.DATABASE_URL;
  if (!base) {
    throw new Error("DATABASE_URL não definida em backend/.env");
  }
  const url = new URL(base);
  url.pathname = `/${databaseName}`;
  return url.toString();
}
