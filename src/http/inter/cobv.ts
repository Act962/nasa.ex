import "server-only";
import { interRequest } from "./client";
import type { InterCallContext, InterCobv, InterCobvInput } from "./types";

// Cobrança PIX com vencimento (`cobv`). O `PUT` com o mesmo `txid` é repetível: é o que
// impede duas cobranças no Inter para a mesma conta a receber (RNF-5 da spec 0130).

function cobvPath(txid: string): string {
  return `/pix/v2/cobv/${encodeURIComponent(txid)}`;
}

function requireBody<T>(body: T | null, operation: string): T {
  if (!body) throw new Error(`O Inter não devolveu a cobrança ao ${operation}.`);
  return body;
}

/** Escopo `cobv.write`. */
export async function createInterCobv(
  context: InterCallContext,
  txid: string,
  input: InterCobvInput,
): Promise<InterCobv> {
  const body = await interRequest<InterCobv>(context, { method: "PUT", path: cobvPath(txid), body: input });
  return requireBody(body, "criar");
}

/** Escopo `cobv.write`. Revisa valor, vencimento ou devedor de uma cobrança `ATIVA`. */
export async function reviseInterCobv(
  context: InterCallContext,
  txid: string,
  changes: Partial<InterCobvInput>,
): Promise<InterCobv> {
  const body = await interRequest<InterCobv>(context, { method: "PATCH", path: cobvPath(txid), body: changes });
  return requireBody(body, "revisar");
}

/** Escopo `cobv.write`. Só vale para cobrança `ATIVA`; a paga não pode ser removida. */
export async function removeInterCobv(context: InterCallContext, txid: string): Promise<InterCobv> {
  const body = await interRequest<InterCobv>(context, {
    method: "PATCH",
    path: cobvPath(txid),
    body: { status: "REMOVIDA_PELO_USUARIO_RECEBEDOR" },
  });
  return requireBody(body, "remover");
}

/** Escopo `cobv.read`. */
export async function getInterCobv(context: InterCallContext, txid: string): Promise<InterCobv> {
  const body = await interRequest<InterCobv>(context, { method: "GET", path: cobvPath(txid) });
  return requireBody(body, "consultar");
}

/**
 * Só no sandbox: simula o pagamento da cobrança, para testar o aviso e a baixa sem
 * dinheiro de verdade. Exige `pix.write`, que o ÓRBITA nunca pede em produção (RF-2).
 */
export async function paySandboxInterCobv(
  context: InterCallContext,
  txid: string,
  amountReais: number,
): Promise<{ e2e: string }> {
  if (context.env !== "sandbox") throw new Error("Pagamento simulado só existe no sandbox do Inter.");
  const body = await interRequest<{ e2e: string }>(context, {
    method: "POST",
    path: `/pix/v2/cobv/pagar/${encodeURIComponent(txid)}`,
    body: { valor: amountReais },
  });
  return requireBody(body, "pagar no sandbox");
}
