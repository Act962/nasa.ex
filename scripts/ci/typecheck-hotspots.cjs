// Resume o trace do `tsc --generateTrace`: arquivos, pastas e expressões mais caros da checagem.
// Uso: node scripts/ci/typecheck-hotspots.cjs <pasta-do-trace>
const fs = require("node:fs");
const path = require("node:path");

const traceDir = process.argv[2] ?? "trace";
const events = JSON.parse(fs.readFileSync(path.join(traceDir, "trace.json"), "utf8"));
const toPosix = (filePath) => filePath.split(path.sep).join("/");
const projectRoot = toPosix(process.cwd()).toLowerCase() + "/";
const EXPRESSION_THRESHOLD_MS = 1000;

const toRelative = (filePath) => {
  const normalized = toPosix(filePath ?? "");
  return normalized.toLowerCase().startsWith(projectRoot) ? normalized.slice(projectRoot.length) : normalized;
};
const toFolder = (filePath) => {
  const parts = filePath.split("/");
  if (filePath.startsWith("src/app/router/")) return parts.slice(0, 4).join("/");
  if (filePath.startsWith("src/")) return parts.slice(0, 3).join("/");
  return parts.slice(0, 2).join("/");
};

const openEvents = [];
const msByFile = new Map();
const slowExpressions = [];

for (const event of events) {
  if (event.ph === "B") {
    openEvents.push(event);
    continue;
  }
  if (event.ph !== "E") continue;
  const opened = openEvents.pop();
  const durationMs = (event.ts - opened.ts) / 1000;
  if (opened.name === "checkSourceFile") {
    msByFile.set(toRelative(opened.args.path), durationMs);
  } else if (opened.name.startsWith("check") && durationMs >= EXPRESSION_THRESHOLD_MS && opened.args?.path) {
    const source = fs.existsSync(opened.args.path) ? fs.readFileSync(opened.args.path, "utf8") : "";
    const line = source.slice(0, opened.args.pos).split("\n").length;
    slowExpressions.push({ durationMs, location: `${toRelative(opened.args.path)}:${line}` });
  }
}

const msByFolder = new Map();
for (const [filePath, durationMs] of msByFile) {
  const folder = toFolder(filePath);
  msByFolder.set(folder, (msByFolder.get(folder) ?? 0) + durationMs);
}

const formatTop = (entries, count) =>
  [...entries]
    .sort((left, right) => right[1] - left[1])
    .slice(0, count)
    .map(([name, durationMs]) => `| ${(durationMs / 1000).toFixed(1)} s | \`${name}\` |`)
    .join("\n");

const totalSeconds = [...msByFile.values()].reduce((sum, durationMs) => sum + durationMs, 0) / 1000;
const uniqueExpressions = new Map();
for (const expression of slowExpressions) {
  const current = uniqueExpressions.get(expression.location) ?? 0;
  uniqueExpressions.set(expression.location, Math.max(current, expression.durationMs));
}

console.log(`### Checagem: ${totalSeconds.toFixed(0)} s em ${msByFile.size} arquivos\n`);
console.log("#### Arquivos mais caros\n| Tempo | Arquivo |\n| --- | --- |\n" + formatTop(msByFile, 25));
console.log("\n#### Pastas mais caras\n| Tempo | Pasta |\n| --- | --- |\n" + formatTop(msByFolder, 20));
console.log(`\n#### Expressões acima de ${EXPRESSION_THRESHOLD_MS / 1000} s\n| Tempo | Local |\n| --- | --- |\n` + formatTop(uniqueExpressions, 25));
