import { readFileSync } from "node:fs";
import path from "node:path";
import { F0_CASES } from "./cases/f0-sanidade";
import { F1_CASES } from "./cases/f1-consultas";
import { F2_CASES } from "./cases/f2-analises";
import { F3_CHAT_FORM_CASES } from "./cases/f3-chat-forms";
import { F3_FINANCE_CASES } from "./cases/f3-finance";
import { F3_FORGE_CASES } from "./cases/f3-forge";
import { F3_OTHER_VERB_CASES } from "./cases/f3-other-verbs";
import { F3_TRACKING_CASES } from "./cases/f3-tracking";
import { F3_WORKSPACE_CASES } from "./cases/f3-workspace";
import { F4_CASES } from "./cases/f4-busca-e-data";
import { F5_CASES } from "./cases/f5-compostos";
import { F6_CASES } from "./cases/f6-confirmacao";
import { F7_CASES } from "./cases/f7-seguranca";
import { F8_SITE_CASES } from "./cases/f8-site";
import { F8_BOT_COMMAND_CASES } from "./cases/f8-bot-commands";
import { F9_CASES } from "./cases/f9-alertas";
import { F10_CASES } from "./cases/f10-custo";
import type { QaCase, QaPhase } from "./cases/types";

// As fases e os ids vêm do documento, não de uma lista daqui: caso novo no
// documento nasce pendente e trava o portão até ser automatizado.

const BATTERY_DOC_PATH = path.resolve(process.cwd(), "docs/astro-bateria-de-testes.md");
const PHASE_HEADING = /^### (F\d+) — (.+)$/;
const CASE_ROW = /^\|\s*(F\d+-[A-Z0-9-]+)\s*\|/;

const AUTOMATED_CASES: QaCase[] = [...F0_CASES, ...F1_CASES, ...F2_CASES, ...F3_TRACKING_CASES, ...F3_FORGE_CASES, ...F3_FINANCE_CASES, ...F3_WORKSPACE_CASES, ...F3_CHAT_FORM_CASES, ...F3_OTHER_VERB_CASES, ...F4_CASES, ...F5_CASES, ...F6_CASES, ...F7_CASES, ...F8_SITE_CASES, ...F8_BOT_COMMAND_CASES, ...F9_CASES, ...F10_CASES];

/** A regressão final repete estas fases inteiras (documento, F11). */
const REGRESSION_PHASE_IDS = ["F0", "F1", "F5"];

interface DocumentedPhase {
  id: string;
  title: string;
  caseIds: string[];
}

function readDocumentedPhases(): DocumentedPhase[] {
  const phases: DocumentedPhase[] = [];
  for (const line of readFileSync(BATTERY_DOC_PATH, "utf8").split("\n")) {
    const heading = line.match(PHASE_HEADING);
    if (heading) {
      phases.push({ id: heading[1], title: heading[2], caseIds: [] });
      continue;
    }
    const row = line.match(CASE_ROW);
    const currentPhase = phases.at(-1);
    if (row && currentPhase && row[1].startsWith(`${currentPhase.id}-`)) {
      currentPhase.caseIds.push(row[1]);
    }
  }
  return phases;
}

export function loadPhases(): QaPhase[] {
  const automatedById = new Map(AUTOMATED_CASES.map((qaCase) => [qaCase.id, qaCase]));
  const phases = readDocumentedPhases().map((documented) => ({
    id: documented.id,
    title: documented.title,
    cases: documented.caseIds.flatMap((caseId) => automatedById.get(caseId) ?? []),
    pendingCaseIds: documented.caseIds.filter((caseId) => !automatedById.has(caseId)),
  }));

  const regression = phases.find((phase) => phase.id === "F11");
  if (regression) {
    const repeated = phases.filter((phase) => REGRESSION_PHASE_IDS.includes(phase.id));
    regression.cases = repeated.flatMap((phase) => phase.cases);
    regression.pendingCaseIds = repeated.flatMap((phase) => phase.pendingCaseIds);
  }
  return phases;
}
