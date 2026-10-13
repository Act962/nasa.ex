"use client";

import { playIncomingChatBeep } from "@/features/tracking-chat/lib/notification-sound";
import { LEAD_AWAITING_HUMAN_EVENT } from "@/features/alerts/lib/lead-awaiting-human-event";
import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { pusherClient } from "@/lib/pusher";
import { authClient } from "@/lib/auth-client";
import { orpc, client } from "@/lib/orpc";
import { AlertTriangle, Info, AlertCircle } from "lucide-react";
import { AlertCriticalPopup } from "./alert-critical-popup";
import { useAlertStore } from "../store/use-alert-store";
import {
  ASTRO_ACTIVITY_EVENT,
  ASTRO_ACTIVITY_PUSHER_EVENT,
  ASTRO_ALERT_EVENT,
  type AstroActivityDetail,
} from "@/features/astro/lib/astro-alert-event";
import {
  isSeverity,
  isDisplaySurface,
  type DisplaySurface,
  type Severity,
} from "../lib/severity";

/**
 * AlertProvider — listener client global do sistema de alertas.
 *
 * Responsabilidades:
 *  1. Subscreve canal Pusher do user + da org ativa.
 *  2. No mount, busca alertas críticos pendentes (caso user fechou aba sem ack)
 *     e empilha no store pra reabrir popup.
 *  3. Quando chega `alert:new` via Pusher, roteia:
 *      - bell   → invalida query do NotificationBell (atualiza badge passivamente)
 *      - toast  → Sonner persistente com cor por severity
 *      - popup  → empurra no useAlertStore pra abrir AlertCriticalPopup
 *  4. Quando chega `alert:acked` (multi-tab sync), fecha popup local sem ack-dupe.
 *
 * Padrão Pusher copiado do SpacePointProvider.
 */
export function AlertProvider({ children }: { children?: React.ReactNode }) {
  const { data: session } = authClient.useSession();
  const { data: orgs } = authClient.useListOrganizations();
  // Os handlers do Pusher são registrados uma vez; o ref entrega a lista atual.
  const orgsRef = useRef(orgs);
  orgsRef.current = orgs;
  const { data: activeOrg } = authClient.useActiveOrganization();
  const queryClient = useQueryClient();
  const store = useAlertStore();

  const userId = session?.user?.id ?? null;
  const orgIds = useMemo(
    () => (orgs ?? []).map((o) => o.id),
    [orgs],
  );
  const activeOrgId = activeOrg?.id ?? orgIds[0] ?? null;

  // Bootstrap: reabre críticos pendentes
  const bootstrappedRef = useRef(false);
  useEffect(() => {
    if (!userId || bootstrappedRef.current) return;
    bootstrappedRef.current = true;
    client.alerts.pendingCriticals({})
      .then((res) => {
        for (const item of res.items) {
          store.pushCritical({
            id: item.id,
            title: item.title,
            body: item.body,
            actionUrl: item.actionUrl,
            organizationName: item.organizationName,
            requiresAck: item.requiresAck,
          });
        }
      })
      .catch(() => {
        // Best-effort — se a procedure ainda não existe (migração pendente),
        // não quebra o app.
      });
  }, [userId, store]);

  // Pusher: canal do usuário
  useEffect(() => {
    if (!userId) return;
    const ch = pusherClient.subscribe(`private-user-${userId}`);

    ch.bind("alert:new", (data: AlertNewPayload) => handleIncoming(data));
    // O que o ASTRO está fazendo (comando executando) vai direto para o balão.
    ch.bind(ASTRO_ACTIVITY_PUSHER_EVENT, (data: AstroActivityDetail) => {
      window.dispatchEvent(new CustomEvent(ASTRO_ACTIVITY_EVENT, { detail: data }));
    });
    ch.bind("alert:acked", (data: { notificationId: string }) => {
      // Fecha popup local se for o mesmo
      const active = useAlertStore.getState().activeCritical;
      if (active?.id === data.notificationId) {
        useAlertStore.getState().acknowledge();
      }
    });

    return () => {
      ch.unbind_all();
      pusherClient.unsubscribe(`private-user-${userId}`);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Pusher: canal da org ativa (pra broadcasts whole_org)
  useEffect(() => {
    if (!activeOrgId) return;
    const ch = pusherClient.subscribe(`private-org-${activeOrgId}`);
    ch.bind("alert:new", (data: AlertNewPayload) => handleIncoming(data));
    return () => {
      ch.unbind_all();
      pusherClient.unsubscribe(`private-org-${activeOrgId}`);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrgId]);

  function handleIncoming(data: AlertNewPayload) {
    const severity: Severity = isSeverity(data.severity) ? data.severity : "info";
    const displaySurface: DisplaySurface = isDisplaySurface(data.displaySurface)
      ? data.displaySurface
      : "bell";

    // Sempre invalida o bell (badge atualiza em qualquer caso). O hook do sino
    // usa a chave legada `["user-notifications"]`: sem invalidar as duas, o
    // badge só mudava no polling de 30s (spec 0029, RNF-4).
    queryClient.invalidateQueries(
      orpc.userNotifications.list.queryOptions({ input: {} }),
    );
    queryClient.invalidateQueries({ queryKey: ["user-notifications"] });

    // Cliente esperando uma pessoa: o mesmo sinal sonoro de mensagem nova no chat.
    if (data.eventType === LEAD_AWAITING_HUMAN_EVENT) playIncomingChatBeep();

    // Repassa ao ASTRO (orb e widget) sem abrir uma segunda assinatura Pusher.
    window.dispatchEvent(new CustomEvent(ASTRO_ALERT_EVENT, { detail: data }));

    if (displaySurface === "popup") {
      // Para popups, precisamos do ID — Pusher payload tem `notificationId`
      // se o engine incluiu. Quando ausente (fallback), gera ID local.
      const id =
        (data as { notificationId?: string }).notificationId ??
        `local-${Date.now()}`;
      store.pushCritical({
        id,
        title: data.title,
        body: data.body,
        actionUrl: data.actionUrl ?? null,
        organizationName: (orgsRef.current ?? []).find((organization) => organization.id === data.organizationId)?.name ?? null,
        requiresAck: data.requiresAck ?? severity === "critical",
      });
      return;
    }

    if (displaySurface === "toast") {
      // Duração auto-hide por severity. Ficar "para sempre" travava a UI do
      // user; agora some sozinho mas dá tempo de ler.
      //   info     → 5s
      //   warning  → 8s
      //   critical → 12s (caso raro: critical configurado como toast)
      const duration =
        severity === "critical" ? 12_000 : severity === "warning" ? 8_000 : 5_000;

      const icon =
        severity === "critical" ? (
          <AlertCircle className="size-4 text-destructive" />
        ) : severity === "warning" ? (
          <AlertTriangle className="size-4 text-warning" />
        ) : (
          <Info className="size-4 text-info" />
        );

      toast(data.title, {
        description: data.body,
        duration,
        icon,
        action: data.actionUrl
          ? {
              label: "Abrir",
              onClick: () => window.open(data.actionUrl!, "_blank"),
            }
          : undefined,
      });
      return;
    }

    // bell — só invalidação acima
  }

  const handleAck = async (id: string) => {
    try {
      // IDs gerados localmente (fallback) não têm registro server-side
      if (id.startsWith("local-")) {
        store.acknowledge();
        return;
      }
      await client.alerts.acknowledge({ notificationId: id });
    } catch (err) {
      console.error("[alerts] acknowledge falhou:", err);
    } finally {
      store.acknowledge();
    }
  };

  return (
    <>
      {children}
      <AlertCriticalPopup
        payload={store.activeCritical}
        onAcknowledge={handleAck}
      />
    </>
  );
}

interface AlertNewPayload {
  severity: string;
  displaySurface: string;
  requiresAck?: boolean;
  title: string;
  body: string;
  actionUrl?: string | null;
  eventType?: string;
  notificationId?: string;
  organizationId?: string | null;
}
