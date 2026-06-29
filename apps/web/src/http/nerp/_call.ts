import { nerpFetch } from "./client";
import type { NerpOrgConfig } from "./types";

export type NerpProcedurePath = `${string}.${string}`;

function procedureToPath(procedure: NerpProcedurePath): string {
  const [domain, name] = procedure.split(".") as [string, string];
  return `/api/rpc/${domain}/${name}`;
}

type RpcEnvelope<T> = { json: T; meta?: unknown };

export type CallNerpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type CallNerpOptions = {
  method?: CallNerpMethod;
};

// oRPC's RPCHandler honra o método configurado em `.route({ method })` no nerp.
// O protocolo Standard RPC embrulha input/output em `{ json, meta? }`. Para
// GET, o payload vai como query `?data=<envelope>`; para o resto, no body.
//
// Procedures declaradas com `.input(z.void())` (ex.: `org.get`) rejeitam
// `{}`: nesse caso o cliente NÃO pode mandar `data`/body — o servidor lê
// input como `undefined`, único valor que `z.void()` aceita.
export async function callNerpProcedure<TOut, TIn = unknown>(
  cfg: NerpOrgConfig,
  procedure: NerpProcedurePath,
  input?: TIn,
  options?: CallNerpOptions,
): Promise<TOut> {
  const method = options?.method ?? "POST";
  const path = procedureToPath(procedure);
  const hasInput = input !== undefined;

  if (method === "GET") {
    const url = hasInput
      ? `${path}?${new URLSearchParams({
          data: JSON.stringify({ json: input }),
        }).toString()}`
      : path;
    const raw = await nerpFetch<RpcEnvelope<TOut>>({
      cfg,
      method: "GET",
      path: url,
    });
    return raw.json;
  }

  const raw = await nerpFetch<RpcEnvelope<TOut>>({
    cfg,
    method,
    path,
    body: hasInput ? { json: input } : undefined,
  });
  return raw.json;
}
