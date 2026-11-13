"use client";

import type { ReactNode } from "react";
import { formatCurrency } from "@/features/payment/lib/format";
import { cn } from "@/lib/utils";
import type { RoomIndicators } from "../hooks/use-orbita-station";
import type { RoomKindKey } from "../layout/room-kinds";
import { WAIT_LEVEL_CLASS, formatWait, waitLevel, waitSecondsSince } from "../lib/wait-time";

const SOURCE_LABELS: Record<string, string> = {
  DEFAULT: "Cadastro manual",
  WHATSAPP: "WhatsApp",
  FORM: "Formulário",
  AGENDA: "Agenda",
  INSTAGRAM: "Instagram",
  INSTAGRAM_COMMENT: "Comentário no Instagram",
  FACEBOOK: "Facebook",
  TIKTOK: "TikTok",
  LINKEDIN: "LinkedIn",
  GMAIL: "Gmail",
  GOOGLE_MAPS: "Google Maps",
  IN_CHAT: "Página de WhatsApp",
  ASTRO_CHAT: "Chat do site",
  NERP_CATALOG: "Catálogo online",
  LINNKER: "Linnker",
  ERP: "ERP",
  OTHER: "Outros",
};
const CHANNEL_LABELS: Record<string, string> = { WHATSAPP: "WhatsApp", INSTAGRAM: "Instagram", FACEBOOK: "Facebook" };
const APPOINTMENT_STATUS: Record<string, string> = { PENDING: "A confirmar", CONFIRMED: "Confirmado", NO_SHOW: "Não compareceu", DONE: "Realizado" };

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
export const channelLabel = (channel: string) => CHANNEL_LABELS[channel] ?? channel;

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-white/70">{label}</span>
      <b className="tabular-nums">{value}</b>
    </div>
  );
}

function Block({ title, source, children }: { title: string; source: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <p className="text-xs uppercase tracking-wider text-white/60">{title}</p>
      {children}
      <p className="text-[11px] leading-snug text-white/45">{source}</p>
    </section>
  );
}

const NO_FUNNEL = <p className="text-sm text-white/60">Você não participa de nenhum funil desta empresa.</p>;

/** Resumo real do módulo da sala (spec 0121, RF-2 a RF-8). Bloco `null` = sem permissão: não mostra nada. */
export function RoomIndicatorsSection({
  kind,
  indicators,
  now,
  onPickLead,
}: {
  kind: RoomKindKey;
  indicators: RoomIndicators;
  now: number;
  onPickLead: (leadId: string) => void;
}) {
  if (kind === "chat" && indicators.chat) {
    const { chat } = indicators;
    if (!chat.hasTrackings) return NO_FUNNEL;
    return (
      <Block title="Fila" source="Aguardando = a última mensagem é do cliente, chegou nas últimas 12 h e ainda não teve resposta.">
        <Row label="Aguardando resposta" value={chat.waitingCount} />
        {chat.oldestWaitingSince && <Row label="Maior espera" value={formatWait(waitSecondsSince(chat.oldestWaitingSince, now))} />}
        {chat.leads.length > 0 && (
          <ul className="space-y-1">
            {chat.leads.map((lead) => {
              const seconds = waitSecondsSince(lead.waitingSince, now);
              return (
                <li key={lead.id}>
                  <button type="button" onClick={() => onPickLead(lead.id)} className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1 text-left text-sm hover:bg-white/10">
                    <span className="truncate">
                      {lead.name} <span className="text-white/50">· {channelLabel(lead.channel)}</span>
                    </span>
                    <span className={cn("shrink-0 rounded-full px-2 text-xs font-semibold tabular-nums", WAIT_LEVEL_CLASS[waitLevel(seconds)])}>{formatWait(seconds)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Block>
    );
  }
  if (kind === "terminal" && indicators.arrivals) {
    const { arrivals } = indicators;
    if (!arrivals.hasTrackings) return NO_FUNNEL;
    return (
      <Block title="Chegadas de hoje" source="Leads criados hoje nos funis em que você participa.">
        <Row label="Leads novos" value={arrivals.createdToday} />
        {arrivals.topSources.map((group) => (
          <Row key={group.source} label={SOURCE_LABELS[group.source] ?? group.source} value={group.count} />
        ))}
      </Block>
    );
  }
  if (kind === "workspace" && indicators.tasks) {
    const { tasks } = indicators;
    return (
      <Block title="Suas tarefas" source="Tarefas em que você é responsável, não concluídas.">
        <Row label="Atrasadas" value={tasks.overdueCount} />
        <Row label="Vencem hoje" value={tasks.dueTodayCount} />
        {tasks.overdue.length > 0 && (
          <ul className="space-y-0.5 text-sm">
            {tasks.overdue.map((task) => (
              <li key={task.id} className="truncate text-white/80">
                {task.title}
              </li>
            ))}
          </ul>
        )}
      </Block>
    );
  }
  if (kind === "finance" && indicators.finance) {
    const { finance } = indicators;
    return (
      <Block title="Recebíveis" source="Contas a receber da empresa, pelo valor que ainda falta receber.">
        <Row label="Vencidos" value={`${finance.overdueCount} · ${formatCurrency(finance.overdueCents)}`} />
        <Row label="A receber hoje" value={formatCurrency(finance.dueTodayCents)} />
      </Block>
    );
  }
  if ((kind === "agenda" || kind === "meeting") && indicators.agenda) {
    const { agenda } = indicators;
    if (!agenda.hasTrackings) return NO_FUNNEL;
    return (
      <Block title="Próximos compromissos de hoje" source="Agendas dos funis em que você participa, sem os cancelados.">
        {agenda.upcoming.length === 0 ? (
          <p className="text-sm text-white/60">Nada mais marcado para hoje.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {agenda.upcoming.map((appointment) => (
              <li key={appointment.id} className="flex justify-between gap-2">
                <span className="truncate">
                  <b className="tabular-nums">{timeOf(appointment.startsAt)}</b> · {appointment.title}
                </span>
                <span className="shrink-0 text-white/60">{APPOINTMENT_STATUS[appointment.status] ?? appointment.status}</span>
              </li>
            ))}
          </ul>
        )}
      </Block>
    );
  }
  if (kind === "sales" && indicators.sales) {
    const { sales } = indicators;
    return (
      <Block title="Forge" source="Propostas em rascunho, enviadas ou vistas; contratos esperando assinatura.">
        <Row label="Propostas em aberto" value={sales.openProposals} />
        <Row label="Em rascunho" value={sales.draftProposals} />
        <Row label="Contratos para assinar" value={sales.contractsToSign} />
      </Block>
    );
  }
  return null;
}

export interface AttentionItem {
  key: string;
  title: string;
  detail: string;
  roomKind: RoomKindKey;
  isUrgent: boolean;
}

/** O que está pendente, a partir dos mesmos indicadores das salas (spec 0121, RF-9). */
export function attentionItems(indicators: RoomIndicators | undefined, now: number): AttentionItem[] {
  if (!indicators) return [];
  const items: AttentionItem[] = [];
  const { chat, tasks, finance, sales } = indicators;
  if (chat && chat.waitingCount > 0) {
    const oldest = chat.oldestWaitingSince ? waitSecondsSince(chat.oldestWaitingSince, now) : 0;
    items.push({
      key: "chat",
      title: `${chat.waitingCount} ${chat.waitingCount === 1 ? "lead aguardando" : "leads aguardando"} resposta`,
      detail: `Maior espera: ${formatWait(oldest)}`,
      roomKind: "chat",
      isUrgent: waitLevel(oldest) === "bad",
    });
  }
  if (tasks && tasks.overdueCount > 0) {
    items.push({ key: "tasks", title: `${tasks.overdueCount} ${tasks.overdueCount === 1 ? "tarefa sua atrasada" : "tarefas suas atrasadas"}`, detail: "Workspace", roomKind: "workspace", isUrgent: true });
  }
  if (finance && finance.overdueCount > 0) {
    items.push({ key: "finance", title: `${finance.overdueCount} ${finance.overdueCount === 1 ? "recebível vencido" : "recebíveis vencidos"}`, detail: formatCurrency(finance.overdueCents), roomKind: "finance", isUrgent: true });
  }
  if (sales && sales.contractsToSign > 0) {
    items.push({ key: "contracts", title: `${sales.contractsToSign} ${sales.contractsToSign === 1 ? "contrato aguarda" : "contratos aguardam"} assinatura`, detail: "Forge", roomKind: "sales", isUrgent: false });
  }
  if (sales && sales.draftProposals > 0) {
    items.push({ key: "drafts", title: `${sales.draftProposals} ${sales.draftProposals === 1 ? "proposta" : "propostas"} em rascunho`, detail: "Forge", roomKind: "sales", isUrgent: false });
  }
  return items;
}
