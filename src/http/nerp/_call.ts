import { nerpFetch } from "./client";
import type { NerpOrgConfig } from "./types";

export type NerpProcedurePath = `${string}.${string}`;

function procedureToPath(procedure: NerpProcedurePath): string {
  const [domain, name] = procedure.split(".") as [string, string];
  return `/api/rpc/${domain}/${name}`;
}

export async function callNerpProcedure<TOut, TIn = unknown>(
  cfg: NerpOrgConfig,
  procedure: NerpProcedurePath,
  input?: TIn,
): Promise<TOut> {
  return nerpFetch<TOut>({
    cfg,
    method: "POST",
    path: procedureToPath(procedure),
    body: input ?? {},
  });
}
