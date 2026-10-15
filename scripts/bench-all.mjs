import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backend = path.join(root, "backend");
const frontend = path.join(root, "frontend");
const require = createRequire(path.join(backend, "package.json"));
const { config } = require("dotenv");

function databaseUrlFor(databaseName) {
  const parsed = config({ path: path.join(backend, ".env") }).parsed ?? {};
  const base = process.env.DATABASE_URL ?? parsed.DATABASE_URL;
  if (!base) {
    throw new Error("DATABASE_URL não definida em backend/.env");
  }
  const url = new URL(base);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

function run(title, command, args, cwd, env = {}) {
  console.log(`\n== ${title}`);
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: true,
    env: { ...process.env, ...env }
  });
  if (result.status !== 0) {
    console.error(`Falhou: ${title}`);
    process.exit(result.status ?? 1);
  }
}

const python = process.env.PYTHON ?? "python";

for (const database of ["pricewatch_test", "pricewatch_bench"]) {
  run(`migrations em ${database}`, "npx", ["prisma", "migrate", "deploy"], backend, {
    DATABASE_URL: databaseUrlFor(database)
  });
}
run("testes de equivalência do back", "npm", ["run", "test:equivalence"], backend);
run("medições do back (F1–F6)", "npm", ["run", "bench"], backend);
run("medições do front (F7, F8)", "npm", ["run", "bench"], frontend);
run("gráficos", python, ["bench/plot.py"], root);
run("tabelas", python, ["bench/tables.py"], root, { PYTHONIOENCODING: "utf-8" });
