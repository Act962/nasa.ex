"use client";

import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/components/sidebar/hooks/use-notifications";
import type { AstroVoiceAction } from "@/features/astro/lib/astro-voice-catalog";
import {
  PRIORITY_DOT,
  PRIORITY_ORDER,
  groupIdenticalAlerts,
} from "@/features/astro/components/widget/astro-widget-home";

const MAX_ALERT_GROUPS = 12;

/** Avisos do ASTRO no "+" da Início: os mesmos do painel, com as ações indo para a conversa da página. */
export function useHomeAlerts() {
  const { notifications, markRead, markAllRead } = useNotifications();
  const alertGroups = groupIdenticalAlerts(
    notifications.filter((notification) => !notification.isRead),
  )
    .sort(
      (left, right) =>
        PRIORITY_ORDER[left.latest.astro.priority] - PRIORITY_ORDER[right.latest.astro.priority],
    )
    .slice(0, MAX_ALERT_GROUPS);

  const markGroupRead = (notificationIds: string[]) => {
    for (const notificationId of notificationIds) markRead(notificationId);
  };

  return { alertGroups, markGroupRead, markAllRead };
}

interface HomeAlertsListProps {
  onPrompt: (prompt: string) => void;
  onAfterAction?: () => void;
}

export function HomeAlertsList({ onPrompt, onAfterAction }: HomeAlertsListProps) {
  const router = useRouter();
  const { alertGroups, markGroupRead, markAllRead } = useHomeAlerts();

  const runAction = (notificationIds: string[], action: AstroVoiceAction) => {
    markGroupRead(notificationIds);
    onAfterAction?.();
    if (action.kind === "prompt") {
      onPrompt(action.prompt);
      return;
    }
    router.push(action.href);
  };

  if (alertGroups.length === 0) {
    return (
      <p className="rounded-2xl bg-background px-3 py-6 text-center text-sm text-muted-foreground">
        Nenhum aviso novo. Quando algo importante acontecer, eu te aviso aqui.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => markAllRead()}
          className="flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"
        >
          <CheckCheck className="size-3.5" />
          Marcar tudo como lido
        </button>
      </div>
      {alertGroups.map(({ latest: notification, notificationIds }) => (
        <article key={notification.id} className="rounded-2xl bg-background p-3">
          <div className="flex items-start gap-2">
            <span
              className={cn("mt-1.5 size-2 shrink-0 rounded-full", PRIORITY_DOT[notification.astro.priority])}
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {notification.astro.headline}
                {notificationIds.length > 1 && (
                  <span className="ml-1.5 rounded-full bg-knob px-1.5 py-px text-[10px] font-medium text-muted-foreground">
                    {notificationIds.length}×
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
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
                  "rounded-full px-3 py-1 text-xs transition",
                  action.kind === "prompt"
                    ? "bg-info/20 text-info hover:bg-info/30"
                    : "bg-knob text-foreground hover:bg-accent",
                )}
              >
                {action.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => markGroupRead(notificationIds)}
              className="rounded-full px-3 py-1 text-xs text-muted-foreground transition hover:text-foreground"
            >
              Dispensar
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
