/**
 * Registra uma nova revisão das políticas do Órbita quando o inventário
 * (apps, cookies, fornecedores) muda. Roda no build; nunca derruba o build.
 *
 *   pnpm legal:sync
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ORBITA_COOKIES } from "../../src/features/legal/lib/orbita-cookies";
import {
  computeInventoryFingerprint,
  listAllSubprocessorNames,
  listPublishedApps,
} from "../../src/features/legal/lib/orbita-data-inventory";
import type { OrbitaLegalRevision } from "../../src/features/legal/lib/orbita-legal-revisions";

const REVISIONS_PATH = resolve(__dirname, "../../src/features/legal/lib/orbita-legal-revisions.json");

function syncOrbitaLegalRevisions() {
  const revisions = JSON.parse(readFileSync(REVISIONS_PATH, "utf8")) as OrbitaLegalRevision[];
  const fingerprint = computeInventoryFingerprint();

  if (revisions.at(-1)?.fingerprint === fingerprint) {
    console.log(`[legal:sync] políticas em dia (${fingerprint}).`);
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const newRevision: OrbitaLegalRevision = {
    date: today,
    fingerprint,
    apps: listPublishedApps().map((app) => app.name),
    cookies: ORBITA_COOKIES.map((cookie) => cookie.name),
    subprocessors: listAllSubprocessorNames(),
  };
  const isSameDayAsLatest = revisions.at(-1)?.date === today;
  const nextRevisions = isSameDayAsLatest && revisions.length > 1
    ? [...revisions.slice(0, -1), newRevision]
    : [...revisions, newRevision];

  writeFileSync(REVISIONS_PATH, `${JSON.stringify(nextRevisions, null, 2)}\n`);
  console.log(`[legal:sync] nova revisão ${fingerprint} registrada em ${today}.`);
}

try {
  syncOrbitaLegalRevisions();
} catch (error) {
  console.warn("[legal:sync] não foi possível sincronizar as políticas:", error);
}
