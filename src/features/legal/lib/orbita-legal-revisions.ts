import revisionHistory from "./orbita-legal-revisions.json";

/**
 * Histórico gerado por `pnpm legal:sync` (roda também no build). Cada entrada
 * é um retrato do inventário no dia em que ele mudou.
 */

export interface OrbitaLegalRevision {
  date: string;
  fingerprint: string;
  apps: string[];
  cookies: string[];
  subprocessors: string[];
}

export interface OrbitaLegalChange {
  date: string;
  added: string[];
  removed: string[];
}

export const ORBITA_LEGAL_REVISIONS = revisionHistory as OrbitaLegalRevision[];

const LONG_DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function formatRevisionDate(isoDate: string): string {
  return LONG_DATE_FORMATTER.format(new Date(`${isoDate}T00:00:00Z`));
}

export function getLatestRevisionDate(): string {
  const latestRevision = ORBITA_LEGAL_REVISIONS.at(-1);
  return latestRevision ? formatRevisionDate(latestRevision.date) : "";
}

function describeItems(label: string, items: string[]) {
  return items.map((item) => `${label} ${item}`);
}

export function listLegalChanges(): OrbitaLegalChange[] {
  return ORBITA_LEGAL_REVISIONS.slice(1)
    .map((revision, index) => {
      const previous = ORBITA_LEGAL_REVISIONS[index];
      const diff = (current: string[], before: string[]) => ({
        added: current.filter((item) => !before.includes(item)),
        removed: before.filter((item) => !current.includes(item)),
      });
      const appsDiff = diff(revision.apps, previous.apps);
      const cookiesDiff = diff(revision.cookies, previous.cookies);
      const subprocessorsDiff = diff(revision.subprocessors, previous.subprocessors);
      return {
        date: formatRevisionDate(revision.date),
        added: [
          ...describeItems("app", appsDiff.added),
          ...describeItems("cookie", cookiesDiff.added),
          ...describeItems("fornecedor", subprocessorsDiff.added),
        ],
        removed: [
          ...describeItems("app", appsDiff.removed),
          ...describeItems("cookie", cookiesDiff.removed),
          ...describeItems("fornecedor", subprocessorsDiff.removed),
        ],
      };
    })
    .reverse();
}
