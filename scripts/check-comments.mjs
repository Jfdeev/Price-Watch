import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "backend", "package.json"));
const { parse } = require("@typescript-eslint/typescript-estree");

const SCOPES = [
  "backend/src/",
  "backend/tests/",
  "backend/scripts/",
  "backend/bench/",
  "frontend/src/",
  "frontend/tests/",
  "frontend/bench/",
  "bench/",
  "scripts/"
];
const CONFIG_FILE = /^(backend|frontend)\/[^/]+\.config\.(ts|js|mjs|cjs)$/;
const SCRIPT_FILE = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const LINE_BREAK = new RegExp("\r?\n");
const DIRECTIVE = /^(eslint-disable(-next-line|-line)?|eslint-enable|@ts-(expect-error|ignore|nocheck|check))\b/;

function listFiles() {
  const output = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
    cwd: root,
    encoding: "utf8"
  });
  return output
    .split("\n")
    .filter(Boolean)
    .filter((file) => SCOPES.some((scope) => file.startsWith(scope)) || CONFIG_FILE.test(file))
    .filter((file) => !file.endsWith(".d.ts") || file.endsWith("vite-env.d.ts"));
}

function isAllowedDirective(comment) {
  const text = comment.value.trim();
  if (comment.type === "Line" && comment.value.startsWith("/ <reference")) {
    return true;
  }
  return DIRECTIVE.test(text) && !text.includes("--");
}

function scriptComments(file) {
  const source = readFileSync(path.join(root, file), "utf8");
  const ast = parse(source, { comment: true, loc: true, jsx: /\.(tsx|jsx)$/.test(file) });
  return ast.comments
    .filter((comment) => !isAllowedDirective(comment))
    .map((comment) => `${file}:${comment.loc.start.line}: ${comment.value.trim().slice(0, 80)}`);
}

function pythonComments(file) {
  const result = spawnSync(
    process.env.PYTHON ?? "python",
    ["-I", JSON.stringify(path.join(root, "scripts", "list_python_comments.py")), JSON.stringify(path.join(root, file))],
    { encoding: "utf8", shell: true }
  );
  if (result.status !== 0) {
    throw new Error(`python falhou em ${file}: ${result.stderr}`);
  }
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `${file}:${line}`);
}

function cssComments(file) {
  const lines = readFileSync(path.join(root, file), "utf8").split(LINE_BREAK);
  return lines.flatMap((line, index) =>
    line.includes("/*") ? [`${file}:${index + 1}: ${line.trim().slice(0, 80)}`] : []
  );
}

const findings = listFiles().flatMap((file) => {
  if (SCRIPT_FILE.test(file)) {
    return scriptComments(file);
  }
  if (file.endsWith(".css")) {
    return cssComments(file);
  }
  if (file.endsWith(".py")) {
    return pythonComments(file);
  }
  return [];
});

if (findings.length > 0) {
  console.error(findings.join("\n"));
  console.error(`\n${findings.length} comentário(s) encontrado(s).`);
  process.exit(1);
}

console.log("Nenhum comentário encontrado (apenas diretivas de ferramenta).");
