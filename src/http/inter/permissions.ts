import "server-only";
import { InterApiError, interRequest, requestInterToken } from "./client";
import { INTER_BOLETO_SCOPES, INTER_CHARGE_SCOPES } from "./scopes";
import type { InterAppCredentials, InterCallContext, InterTokenResponse } from "./types";

// Confere o que a integração do Inter pode fazer (spec 0133). O token repete qualquer escopo
// pedido, mesmo sem a integração ter (conferido em produção em 2026-11-03), então a prova é
// chamar a API: leitura inofensiva, e escrita com corpo vazio, que o Inter recusa sem criar
// nada. 401/403 = sem a permissão; 2xx/400 = passou da checagem de acesso.

type ProbeOutcome = "granted" | "missing" | "unknown";

interface ScopeProbe {
  scope: string;
  call: (context: InterCallContext) => Promise<unknown>;
  /** Só na leitura do webhook 404 quer dizer "tem acesso, mas não há webhook". Na escrita, é rota errada. */
  isNotFoundGranted?: boolean;
}

const PROBE_WINDOW_MS = 60_000;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildPixProbes(pixKey: string): ScopeProbe[] {
  const webhookPath = `/pix/v2/webhook/${encodeURIComponent(pixKey.replace(/^\+/, ""))}`;
  const window = () => ({ inicio: new Date(Date.now() - PROBE_WINDOW_MS).toISOString(), fim: new Date().toISOString() });
  return [
    { scope: "cobv.read", call: (context) => interRequest(context, { method: "GET", path: "/pix/v2/cobv", query: window() }) },
    { scope: "cobv.write", call: (context) => interRequest(context, { method: "PUT", path: "/pix/v2/cobv/orbpermissionprobe00000000000", body: {} }) },
    { scope: "pix.read", call: (context) => interRequest(context, { method: "GET", path: "/pix/v2/pix", query: window() }) },
    { scope: "webhook.read", call: (context) => interRequest(context, { method: "GET", path: webhookPath }), isNotFoundGranted: true },
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
    if (error.status === 400 || error.status === 422) return "granted";
    if (error.status === 404) return probe.isNotFoundGranted ? "granted" : "unknown";
    return "unknown";
  }
}

/** Token pedido só para conferir: o banco pode recusar emiti-lo se a integração não tiver o escopo. */
async function requestProbeToken(credentials: InterAppCredentials, scopes: readonly string[]): Promise<InterTokenResponse | null> {
  try {
    return await requestInterToken(credentials, scopes);
  } catch (error) {
    if (error instanceof InterApiError && [400, 401, 403].includes(error.status)) return null;
    throw error;
  }
}

async function runProbes(
  callContext: Omit<InterCallContext, "accessToken">,
  token: InterTokenResponse | null,
  probes: ScopeProbe[],
): Promise<Map<string, ProbeOutcome>> {
  const outcomes = new Map<string, ProbeOutcome>();
  for (const probe of probes) {
    outcomes.set(probe.scope, token ? await runProbe({ ...callContext, accessToken: token.access_token }, probe) : "missing");
  }
  return outcomes;
}

export interface InterPermissionReport {
  granted: string[];
  missingForPix: string[];
  missingForBoleto: string[];
  moneyMoving: string[];
  /** Token de trabalho já emitido: com as permissões do boleto quando elas existem. */
  workingToken: InterTokenResponse;
}

/**
 * Três tokens (o Inter aceita cinco por minuto) e nove chamadas, nenhuma com efeito. PIX e
 * boleto em tokens separados: um banco que recuse o escopo do boleto não derruba o do PIX.
 * O token do PIX não é engolido: credencial errada aparece com a mensagem do banco.
 */
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
  const pixToken = await requestInterToken(credentials, INTER_CHARGE_SCOPES);
  const pixOutcomes = await runProbes(callContext, pixToken, buildPixProbes(options.pixKey));
  const boletoToken = await requestProbeToken(credentials, [...INTER_CHARGE_SCOPES, ...INTER_BOLETO_SCOPES]);
  const boletoOutcomes = await runProbes(callContext, boletoToken, BOLETO_PROBES);
  const moneyToken = await requestProbeToken(credentials, MONEY_MOVING_PROBES.map((probe) => probe.scope));
  const moneyOutcomes = await runProbes(callContext, moneyToken, MONEY_MOVING_PROBES);

  // Resultado incerto (banco fora, limite, rota) não bloqueia: só "missing" conta como faltando.
  const chargeOutcomes = new Map([...pixOutcomes, ...boletoOutcomes]);
  const isMissing = (scope: string) => chargeOutcomes.get(scope) === "missing";
  const missingForBoleto = INTER_BOLETO_SCOPES.filter(isMissing);
  return {
    granted: [...chargeOutcomes].filter(([, outcome]) => outcome !== "missing").map(([scope]) => scope),
    missingForPix: INTER_CHARGE_SCOPES.filter(isMissing),
    missingForBoleto,
    moneyMoving: [...moneyOutcomes].filter(([, outcome]) => outcome === "granted").map(([scope]) => scope),
    workingToken: missingForBoleto.length === 0 && boletoToken ? boletoToken : pixToken,
  };
}
