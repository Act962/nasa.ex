"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BellRing,
  CheckCheck,
  Sparkles,
  Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import { useNotifications } from "@/components/sidebar/hooks/use-notifications";
import { buildGreeting, extractFirstName } from "@/features/astro/voice/greeting";
import { useAstroWidgetStore } from "@/features/astro/voice/use-astro-widget-store";
import type {
  AstroVoiceAction,
  AstroVoicePriority,
} from "@/features/astro/lib/astro-voice-catalog";
import { AstroWidgetApprovals } from "@/features/astro-commander/components/astro-widget-approvals";
import { openCreateCommand } from "@/features/astro-commander/lib/open-create-command";

/**
 * Aba Início do widget: o ASTRO como central da plataforma (spec 0029, RF-9).
 * Aprovações e alertas primeiro, porque são o que depende do usuário agora;
 * atalhos e "Criar comando" depois.
 */

const PRIORITY_ORDER: Record<AstroVoicePriority, number> = {
  urgent: 0,
  important: 1,
  info: 2,
};

const PRIORITY_DOT: Record<AstroVoicePriority, string> = {
  urgent: "bg-rose-500",
  important: "bg-amber-400",
  info: "bg-sky-400",
};

/** Atalhos da tela atual — o pedido vai pronto para a Conversa. */
function quickActionsFor(pathname: string): string[] {
  if (pathname.startsWith("/payment")) {
    return [
      "O que vence hoje e ainda não foi pago?",
      "Como está meu fluxo de caixa este mês?",
      "Quais clientes estão inadimplentes?",
    ];
  }
  if (pathname.startsWith("/tracking-chat")) {
    return [
      "Quais leads estão esperando resposta?",
      "Resuma as conversas de hoje",
      "Sugira respostas para os leads sem retorno",
    ];
  }
  if (pathname.startsWith("/tracking") || pathname.startsWith("/contatos")) {
    return [
      "Quais leads estão parados há mais tempo?",
      "Quantos leads entraram esta semana?",
      "Quais oportunidades eu devo priorizar hoje?",
    ];
  }
  if (pathname.startsWith("/agendas") || pathname.startsWith("/workspaces")) {
    return [
      "O que eu tenho pra fazer hoje?",
      "Quais tarefas da equipe vencem hoje?",
      "Quais compromissos tenho esta semana?",
    ];
  }
  return [
    "O que eu tenho pra fazer hoje?",
    "Quais leads precisam de atenção agora?",
    "Como está o financeiro do mês?",
  ];
}

type WidgetNotification = ReturnType<typeof useNotifications>["notifications"][number];

/** Agrupa avisos de fala idêntica, mantendo o mais recente como vitrine. */
function groupIdenticalAlerts(
  notifications: WidgetNotification[],
): Array<{ latest: WidgetNotification; notificationIds: string[] }> {
  const groups = new Map<string, { latest: WidgetNotification; notificationIds: string[] }>();
  for (const notification of notifications) {
    const groupKey = `${notification.astro.headline}|${notification.astro.speech}`;
    const group = groups.get(groupKey);
    if (!group) {
      groups.set(groupKey, { latest: notification, notificationIds: [notification.id] });
      continue;
    }
    group.notificationIds.push(notification.id);
    if (notification.createdAt > group.latest.createdAt) group.latest = notification;
  }
  return [...groups.values()];
}

const COMMAND_EXAMPLES = [
  "responder leads novos e enviar proposta caso precise",
  "todo dia às 8h conciliar extrato",
  "toda segunda às 9h me mandar o resumo das conversas sem resposta",
];

export function AstroWidgetHome({ pathname }: { pathname: string }) {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const [greeting] = useState(() =>
    buildGreeting(extractFirstName(session?.user?.name)),
  );
  const openWidget = useAstroWidgetStore((state) => state.open);
  const closeWidget = useAstroWidgetStore((state) => state.close);
  const { notifications, markRead, markAllRead } = useNotifications();

  // Avisos com a mesma fala viram um cartão só (ex.: três alertas de Stars),
  // mas todos são marcados como lidos juntos.
  const alertGroups = groupIdenticalAlerts(
    notifications.filter((notification) => !notification.isRead),
  )
    .sort(
      (left, right) =>
        PRIORITY_ORDER[left.latest.astro.priority] -
        PRIORITY_ORDER[right.latest.astro.priority],
    )
    .slice(0, 8);

  function markGroupRead(notificationIds: string[]) {
    for (const notificationId of notificationIds) markRead(notificationId);
  }

  function runAction(notificationIds: string[], action: AstroVoiceAction) {
    markGroupRead(notificationIds);
    if (action.kind === "prompt") {
      openWidget({ text: action.prompt, fromVoice: false });
      return;
    }
    closeWidget();
    router.push(action.href);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="space-y-1 px-4 pb-3 pt-4">
        <p className="text-[15px] font-semibold text-white">{greeting}</p>
        <p className="text-[12px] text-white/45">
          {alertGroups.length > 0
            ? `Tenho ${alertGroups.length} ${alertGroups.length === 1 ? "aviso" : "avisos"} pra você.`
            : "Tudo em dia por aqui. Me chama se precisar."}
        </p>
      </div>

      <AstroWidgetApprovals defaultExpanded />

      <section className="space-y-2 px-3 py-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/40">
            <BellRing className="size-3.5" />
            Avisos agora
          </h3>
          {alertGroups.length > 0 && (
            <button
              type="button"
              onClick={() => markAllRead()}
              className="flex items-center gap-1 text-[11px] text-white/40 transition hover:text-white/70"
            >
              <CheckCheck className="size-3" />
              Marcar tudo como lido
            </button>
          )}
        </div>

        {alertGroups.length === 0 ? (
          <p className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-4 text-center text-[12px] text-white/40">
            Nenhum aviso novo. Quando algo importante acontecer, eu te aviso aqui.
          </p>
        ) : (
          alertGroups.map(({ latest: notification, notificationIds }) => (
            <article
              key={notification.id}
              className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3"
            >
              <div className="flex items-start gap-2">
                <span
                  className={cn(
                    "mt-1.5 size-2 shrink-0 rounded-full",
                    PRIORITY_DOT[notification.astro.priority],
                  )}
                />
                <div className="min-w-0">
                  <p className="text-[12.5px] font-semibold text-white">
                    {notification.astro.headline}
                    {notificationIds.length > 1 && (
                      <span className="ml-1.5 rounded-full bg-white/10 px-1.5 py-px text-[10px] font-medium text-white/60">
                        {notificationIds.length}×
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-white/70">
                    {notification.astro.speech}
                  </p>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5 pl-4">
                {notification.astro.actions.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    onClick={() => runAction(notificationIds, action)}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] transition",
                      action.kind === "prompt"
                        ? "bg-violet-500/20 text-violet-200 hover:bg-violet-500/30"
                        : "bg-white/[0.07] text-white/70 hover:bg-white/[0.12]",
                    )}
                  >
                    {action.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => markGroupRead(notificationIds)}
                  className="rounded-full px-2.5 py-1 text-[11px] text-white/35 transition hover:text-white/60"
                >
                  Dispensar
                </button>
              </div>
            </article>
          ))
        )}
      </section>

      <section className="space-y-1.5 px-3 pb-3">
        <h3 className="flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-white/40">
          <Sparkles className="size-3.5" />
          Atalhos
        </h3>
        {quickActionsFor(pathname).map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => openWidget({ text: prompt, fromVoice: false })}
            className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-left text-[12.5px] text-white/75 transition hover:bg-white/[0.06]"
          >
            {prompt}
            <ArrowRight className="size-3.5 shrink-0 text-white/30" />
          </button>
        ))}
      </section>

      <div className="mt-auto px-3 pb-4">
        <button
          type="button"
          onClick={() => openCreateCommand({ examples: COMMAND_EXAMPLES })}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-3 py-2.5 text-[13px] font-medium text-white transition hover:bg-violet-500"
        >
          <Wand2 className="size-4" />
          Criar comando
        </button>
      </div>
    </div>
  );
}
