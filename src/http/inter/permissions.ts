import "server-only";
import { InterApiError, interRequest, requestInterToken } from "./client";
import { INTER_BOLETO_SCOPES, INTER_CHARGE_SCOPES } from "./scopes";
import type { InterAppCredentials, InterCallContext } from "./types";

// Confere o que a integração do Inter pode fazer (spec 0133). O token repete qualquer escopo
// pedido, mesmo sem a integração ter (conferido em produção em 2026-11-03), então a prova é
// chamar a API: leitura inofensiva, e escrita com corpo vazio, que o Inter recusa sem criar
// nada. 401/403 = sem a permissão; 2xx/400/404 = passou da checagem de acesso.

type ProbeOutcome = "granted" | "missing" | "unknown";

interface ScopeProbe {
  scope: string;
  call: (context: InterCallContext) => Promise<unknown>;
}

const PROBE_WINDOW_MS = 60_000;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildChargeProbes(pixKey: string): ScopeProbe[] {
  const webhookPath = `/pix/v2/webhook/${encodeURIComponent(pixKey.replace(/^\+/, ""))}`;
  const window = () => ({ inicio: new Date(Date.now() - PROBE_WINDOW_MS).toISOString(), fim: new Date().toISOString() });
  return [
    { scope: "cobv.read", call: (context) => interRequest(context, { method: "GET", path: "/pix/v2/cobv", query: window() }) },
    { scope: "cobv.write", call: (context) => interRequest(context, { method: "PUT", path: "/pix/v2/cobv/orbpermissionprobe00000000000", body: {} }) },
    { scope: "pix.read", call: (context) => interRequest(context, { method: "GET", path: "/pix/v2/pix", query: window() }) },
    { scope: "webhook.read", call: (context) => interRequest(context, { method: "GET", path: webhookPath }) },
    { scope: "webhook.write", call: (context) => interRequest(context, { method: "PUT", path: webhookPath, body: {} }) },
  ];
}

const BOLETO_PROBES: ScopeProbe[] = [
  {
    scope: "boleto-cobranca.read",
    call: (context) =>
      interRequest(context, { method: "GET", path: "/cobranca/v3/cobrancas/sumario", query: { dataInicial: todayIso(), dataFinal: todayIso() } }),
  },
  { scope: "boleto-cobranca.write", call: (context) => interRequest(context, { method: "POST", path: "/cobranca/v3/cobrancas", body: {} }) },
];

/** Só corpo vazio: o banco recusa antes de qualquer movimento. */
const MONEY_MOVING_PROBES: ScopeProbe[] = [
  { scope: "pagamento-pix.write", call: (context) => interRequest(context, { method: "POST", path: "/banking/v2/pix", body: {} }) },
  { scope: "pagamento-boleto.write", call: (context) => interRequest(context, { method: "POST", path: "/banking/v2/pagamento", body: {} }) },
];

async function runProbe(context: InterCallContext, probe: ScopeProbe): Promise<ProbeOutcome> {
  try {
    await probe.call(context);
    return "granted";
  } catch (error) {
    if (!(error instanceof InterApiError)) return "unknown";
    if (error.status === 401 || error.status === 403) return "missing";
    if (error.status === 400 || error.status === 404 || error.status === 422) return "granted";
    return "unknown";
  }
}

async function requestProbeToken(credentials: InterAppCredentials, scopes: readonly string[]): Promise<string | null> {
  try {
    return (await requestInterToken(credentials, scopes)).access_token;
  } catch (error) {
    if (error instanceof InterApiError && [400, 401, 403].includes(error.status)) return null;
    throw error;
  }
}

async function probeScopes(
  credentials: InterAppCredentials,
  callContext: Omit<InterCallContext, "accessToken">,
  probes: ScopeProbe[],
): Promise<Map<string, ProbeOutcome>> {
  const outcomes = new Map<string, ProbeOutcome>();
  const accessToken = await requestProbeToken(credentials, probes.map((probe) => probe.scope));
  for (const probe of probes) {
    outcomes.set(probe.scope, accessToken ? await runProbe({ ...callContext, accessToken }, probe) : "missing");
  }
  return outcomes;
}

export interface InterPermissionReport {
  granted: string[];
  missingForPix: string[];
  missingForBoleto: string[];
  moneyMoving: string[];
}

/** Dois tokens (o Inter aceita cinco por minuto) e nove chamadas, nenhuma com efeito. */
export async function checkInterPermissions(
  credentials: InterAppCredentials,
  options: { pixKey: string; accountNumber: string | null },
): Promise<InterPermissionReport> {
  const callContext = {
    env: credentials.env,
    certificatePem: credentials.certificatePem,
    privateKeyPem: credentials.privateKeyPem,
    accountNumber: options.accountNumber,
  };
  const chargeOutcomes = await probeScopes(credentials, callContext, [...buildChargeProbes(options.pixKey), ...BOLETO_PROBES]);
  const moneyOutcomes = await probeScopes(credentials, callContext, MONEY_MOVING_PROBES);

  // Resultado incerto (banco fora, limite) não bloqueia: só "missing" conta como faltando.
  const isMissing = (scope: string) => chargeOutcomes.get(scope) === "missing";
  return {
    granted: [...chargeOutcomes].filter(([, outcome]) => outcome !== "missing").map(([scope]) => scope),
    missingForPix: INTER_CHARGE_SCOPES.filter(isMissing),
    missingForBoleto: INTER_BOLETO_SCOPES.filter(isMissing),
    moneyMoving: [...moneyOutcomes].filter(([, outcome]) => outcome === "granted").map(([scope]) => scope),
  };
}
