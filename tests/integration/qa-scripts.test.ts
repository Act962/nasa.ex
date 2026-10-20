// Roda os scripts de QA das specs (`scripts/*-qa-check.ts`) contra o banco de
// teste. Eles nasceram como conferência manual, quando não havia runner; aqui
// passam a falhar o CI. Cada script cria os próprios dados e sai com código
// diferente de zero se alguma asserção falhar.

import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SCRIPTS_DIRECTORY = path.join(process.cwd(), "scripts");
const SCRIPT_TIMEOUT_MS = 180_000;

const qaScripts = readdirSync(SCRIPTS_DIRECTORY)
  .filter((fileName) => fileName.endsWith("-qa-check.ts"))
  .sort();

// Só o que os scripts exigem para importar seus módulos; nenhum valor real.
const scriptEnvironment = {
  ...process.env,
  NEXT_PUBLIC_PUSHER_APP_KEY: "teste",
  NEXT_PUBLIC_PUSHER_CLUSTER: "mt1",
  PUSHER_APP_ID: "teste",
  PUSHER_SECRET: "teste",
};

function lastLines(output: string, lineCount: number): string {
  return output.trim().split("\n").slice(-lineCount).join("\n");
}

describe("scripts de QA das specs", () => {
  it("existe ao menos um script para rodar", () => {
    expect(qaScripts.length).toBeGreaterThan(0);
  });

  it.each(qaScripts)(
    "%s",
    (scriptName) => {
      const result = spawnSync(
        `pnpm exec tsx --conditions=react-server scripts/${scriptName}`,
        { env: scriptEnvironment, encoding: "utf8", shell: true, timeout: SCRIPT_TIMEOUT_MS },
      );

      const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
      expect(result.status, lastLines(output, 25)).toBe(0);
    },
    SCRIPT_TIMEOUT_MS + 10_000,
  );
});
