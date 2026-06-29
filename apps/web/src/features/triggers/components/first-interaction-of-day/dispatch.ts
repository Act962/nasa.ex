import "server-only";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import prisma from "@/lib/prisma";
import { NodeType } from "@/generated/prisma/enums";
import { dispatchFirstInteractionOfDay } from "@/inngest/utils";

dayjs.extend(utc);
dayjs.extend(timezone);

const TIMEZONE = "America/Sao_Paulo";
const DEFAULT_START_HOUR = 8;
const DEFAULT_START_MINUTE = 0;

export type FirstInteractionOfDayConfig = {
  startHour: number;
  startMinute: number;
};

type CachedTriggerWorkflow = {
  id: string;
  startHour: number;
  startMinute: number;
};

/**
 * Cache em processo `trackingId → workflows com o gatilho ativo` (config já
 * parseada). A esmagadora maioria dos trackings NÃO tem esse gatilho, então o
 * cache elimina o `findMany` do hot path de inbound (item 2 da análise de
 * escala). TTL curto como backstop; invalidação explícita via
 * `invalidateReturningTriggerCache` cobre o caso de criar/ativar/deletar
 * workflow no mesmo processo. Em deploy multi-processo, o TTL garante
 * convergência (≤ TTL_MS) nos demais processos.
 */
const TRIGGER_CACHE_TTL_MS = 60_000;
const triggerWorkflowCache = new Map<
  string,
  { workflows: CachedTriggerWorkflow[]; expiresAt: number }
>();

/** Invalida o cache de um tracking — chamar ao salvar/ativar/deletar workflow. */
export function invalidateReturningTriggerCache(trackingId: string): void {
  triggerWorkflowCache.delete(trackingId);
}

async function getReturningTriggerWorkflows(
  trackingId: string,
): Promise<CachedTriggerWorkflow[]> {
  const cached = triggerWorkflowCache.get(trackingId);
  if (cached && cached.expiresAt > Date.now()) return cached.workflows;

  const rows = await prisma.workflow.findMany({
    where: {
      trackingId,
      isActive: true,
      nodes: { some: { type: NodeType.FIRST_INTERACTION_OF_DAY } },
    },
    select: {
      id: true,
      nodes: {
        where: { type: NodeType.FIRST_INTERACTION_OF_DAY },
        select: { data: true },
      },
    },
  });

  const workflows: CachedTriggerWorkflow[] = rows.map((workflow) => ({
    id: workflow.id,
    ...readConfig(workflow.nodes[0]?.data),
  }));

  triggerWorkflowCache.set(trackingId, {
    workflows,
    expiresAt: Date.now() + TRIGGER_CACHE_TTL_MS,
  });
  return workflows;
}

/**
 * Reivindica atomicamente o disparo do dia para (lead, workflow). Retorna
 * `true` só pra UM chamador por `dayKey` — mesmo sob mensagens concorrentes do
 * mesmo lead (item 3: elimina disparo-duplo). Padrão espelha o
 * `triggerFirstChatInteractionIfFirst`: o unique `(leadId, workflowId)` + a
 * troca condicional do `dayKey` serializam no Postgres.
 */
async function claimDailyTrigger(
  leadId: string,
  workflowId: string,
  dayKey: string,
): Promise<boolean> {
  // Linha já existe e é de OUTRO dia → vira pra hoje (claim vencedor).
  const flipped = await prisma.leadDailyTriggerClaim.updateMany({
    where: { leadId, workflowId, dayKey: { not: dayKey } },
    data: { dayKey },
  });
  if (flipped.count > 0) return true;

  // Sem linha ainda, ou já reivindicada hoje. Tenta criar; unique violation
  // (P2002) = já disparou hoje OU corrida concorrente perdida.
  try {
    await prisma.leadDailyTriggerClaim.create({
      data: { leadId, workflowId, dayKey },
    });
    return true;
  } catch (err) {
    const code =
      err instanceof Error && "code" in err
        ? (err as { code?: string }).code
        : undefined;
    if (code === "P2002") return false;
    throw err;
  }
}

/**
 * Lê a config (`startHour`/`startMinute`) salva pelo dialog em
 * `node.data.action`. Faz fallback pro default 08:00 quando ausente ou fora
 * de range — o gatilho funciona sem configuração explícita.
 */
function readConfig(data: unknown): FirstInteractionOfDayConfig {
  const action =
    data && typeof data === "object" && "action" in data
      ? (data as { action?: unknown }).action
      : data;

  const raw =
    action && typeof action === "object"
      ? (action as { startHour?: unknown; startMinute?: unknown })
      : {};

  const startHour =
    typeof raw.startHour === "number" &&
    raw.startHour >= 0 &&
    raw.startHour <= 23
      ? raw.startHour
      : DEFAULT_START_HOUR;

  const startMinute =
    typeof raw.startMinute === "number" &&
    raw.startMinute >= 0 &&
    raw.startMinute <= 59
      ? raw.startMinute
      : DEFAULT_START_MINUTE;

  return { startHour, startMinute };
}

/**
 * Chave do "dia lógico" no fuso America/Sao_Paulo. O dia vira na hora
 * configurada (`startHour:startMinute`) em vez da meia-noite: se o horário
 * local SP for ANTERIOR ao corte, a interação conta como o dia anterior.
 *
 * Ex (corte 08:00): mensagem 07:00 → dia anterior; 09:00 → dia atual.
 * Retorna "YYYY-MM-DD".
 */
export function saoPauloLogicalDayKey(
  date: Date,
  startHour: number,
  startMinute: number,
): string {
  const local = dayjs(date).tz(TIMEZONE);
  const minutesOfDay = local.hour() * 60 + local.minute();
  const cutoffMinutes = startHour * 60 + startMinute;
  const logical =
    minutesOfDay < cutoffMinutes ? local.subtract(1, "day") : local;
  return logical.format("YYYY-MM-DD");
}

/**
 * Gate de detecção do gatilho FIRST_INTERACTION_OF_DAY. Chamado pelo pipeline
 * inbound (`firePostInboundAutomations`) em toda mensagem do lead (fromMe=false).
 *
 * Dispara quando o "dia lógico" da mensagem atual é posterior ao da última
 * interação anterior do lead — ou seja, é a primeira interação dele no dia
 * (após o horário de corte). Lead recém-criado (sem `previousLastInboundAt`)
 * NÃO dispara: esse caso é coberto pelo gatilho NEW_LEAD.
 *
 * Best-effort do ponto de vista do caller (o pipeline já embrulha em try/catch).
 */
export async function dispatchFirstInteractionOfDayIfReturning(params: {
  leadId: string;
  trackingId: string;
  previousLastInboundAt: Date | null;
  interactionAt: Date;
}): Promise<void> {
  if (!params.previousLastInboundAt) return;

  // Cache em processo — pula o findMany para a maioria dos trackings (sem o
  // gatilho) no hot path de inbound.
  const workflows = await getReturningTriggerWorkflows(params.trackingId);
  if (workflows.length === 0) return;

  // Compara o dia lógico ANTES de carregar o lead / tocar o banco: a maioria
  // das mensagens inbound NÃO é a primeira do dia (lead numa conversa ativa
  // manda várias), então só seguimos quando algum workflow realmente casa.
  const matching = workflows
    .map((workflow) => {
      const previousKey = saoPauloLogicalDayKey(
        params.previousLastInboundAt!,
        workflow.startHour,
        workflow.startMinute,
      );
      const currentKey = saoPauloLogicalDayKey(
        params.interactionAt,
        workflow.startHour,
        workflow.startMinute,
      );
      return { workflowId: workflow.id, currentKey, isFirstOfDay: currentKey > previousKey };
    })
    .filter((workflow) => workflow.isFirstOfDay);

  if (matching.length === 0) return;

  const lead = await prisma.lead.findUnique({
    where: { id: params.leadId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      statusId: true,
      trackingId: true,
      responsibleId: true,
      isActive: true,
    },
  });

  if (!lead) return;

  // `leadContext` (validado pelo executor) exige `phone` string. Lead.phone é
  // nullable no schema — coalesce pra "" evita NonRetriableError marcando o run
  // como FAILED caso um lead sem telefone chegue aqui.
  const dispatchLead = { ...lead, phone: lead.phone ?? "" };

  await Promise.all(
    matching.map(async (workflow) => {
      // Claim atômico: garante 1 disparo por dia mesmo com mensagens
      // concorrentes do mesmo lead.
      const claimed = await claimDailyTrigger(
        lead.id,
        workflow.workflowId,
        workflow.currentKey,
      );
      if (claimed) {
        await dispatchFirstInteractionOfDay({
          workflowId: workflow.workflowId,
          lead: dispatchLead,
        });
      }
    }),
  );
}
