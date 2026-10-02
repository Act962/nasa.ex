"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  BellRing,
  Bot,
  CalendarClock,
  Megaphone,
  Monitor,
  Smartphone,
  SquarePen,
  Star,
  Target,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { orpc } from "@/lib/orpc";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { Switch } from "@/components/ui/switch";

interface NotificationMeta {
  label: string;
  icon: LucideIcon;
  description: string;
  group: string;
}

const NOTIFICATION_META: Record<string, NotificationMeta> = {
  NEW_LEAD: { label: "Novo lead", icon: Target, description: "Quando um novo lead chegar no Tracking ou no Chat", group: "Tracking e Chat" },
  CARD_EDIT: { label: "Edição de tarefa", icon: SquarePen, description: "Tarefas em que você é responsável ou participa foram editadas", group: "Tarefas" },
  APPOINTMENT_REMINDER: { label: "Lembrete de agendamento", icon: CalendarClock, description: "Agendamentos que estão chegando", group: "Agenda" },
  INSIGHTS_MOVEMENT: { label: "Movimentação de Insights", icon: BarChart3, description: "Novidades nos painéis de Insights", group: "Insights" },
  AI_TOKEN_ALERT: { label: "Consumo de IA", icon: Bot, description: "Uso alto de IA nas conexões da empresa", group: "Satélites" },
  STARS_ALERT: { label: "Saldo de Stars", icon: Star, description: "Saldo de Stars baixo na empresa", group: "Financeiro" },
  PLAN_EXPIRY: { label: "Vencimento do plano", icon: TriangleAlert, description: "Plano da empresa perto de vencer", group: "Financeiro" },
  ADMIN_MESSAGE: { label: "Recados da ÓRBITA", icon: Megaphone, description: "Comunicados enviados pela equipe da plataforma", group: "Sistema" },
  CUSTOM: { label: "Lembretes personalizados", icon: BellRing, description: "Lembretes e alertas que você mesmo criou", group: "Sistema" },
};

const NOTIFICATION_GROUPS = ["Tracking e Chat", "Tarefas", "Agenda", "Insights", "Satélites", "Financeiro", "Sistema"];

interface NotificationPreference {
  notifType: string;
  inApp: boolean;
  whatsApp: boolean;
}

/**
 * A mesma lista atende às duas telas: em Configurações, o canal da plataforma;
 * na aba WhatsApp do App ASTRO, o canal do WhatsApp (spec 0029).
 */
export type NotificationChannel = "inApp" | "whatsApp";

const CHANNEL_META: Record<NotificationChannel, { label: string; icon: LucideIcon }> = {
  inApp: { label: "Na plataforma", icon: Monitor },
  whatsApp: { label: "WhatsApp", icon: Smartphone },
};

export function NotificationPreferencesPanel({
  organizationId,
  channels = ["inApp", "whatsApp"],
}: {
  organizationId: string;
  channels?: NotificationChannel[];
}) {
  const queryClient = useQueryClient();
  const [savingNotifType, setSavingNotifType] = useState<string | null>(null);
  const hasManyChannels = channels.length > 1;

  const { data: preferences = [], isLoading } = useQuery({
    queryKey: ["notif-prefs", organizationId],
    queryFn: () => orpc.userNotifications.getPreferences.call({ organizationId }),
  });

  const preferenceByType: Record<string, NotificationPreference> = {};
  for (const preference of preferences) preferenceByType[preference.notifType] = preference;

  const setPreferenceMutation = useMutation({
    mutationFn: (payload: NotificationPreference) =>
      orpc.userNotifications.setPreference.call({ organizationId, ...payload }),
    onMutate: (payload) => setSavingNotifType(payload.notifType),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notif-prefs", organizationId] }),
    onSettled: () => setSavingNotifType(null),
  });

  function toggleChannel(notifType: string, channel: NotificationChannel) {
    const current = preferenceByType[notifType] ?? { notifType, inApp: true, whatsApp: false };
    setPreferenceMutation.mutate({
      notifType,
      inApp: current.inApp,
      whatsApp: current.whatsApp,
      [channel]: !current[channel],
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 text-muted-foreground">
        <OrbitaSpinner className="size-4" />
        <span className="text-sm">Carregando preferências...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {hasManyChannels && (
        <div className="flex items-center gap-6 pb-1 text-xs text-muted-foreground">
          {channels.map((channel) => {
            const ChannelIcon = CHANNEL_META[channel].icon;
            return (
              <div key={channel} className="flex items-center gap-1.5">
                <ChannelIcon className="size-3.5" /> {CHANNEL_META[channel].label}
              </div>
            );
          })}
        </div>
      )}

      {NOTIFICATION_GROUPS.map((group) => {
        const groupTypes = Object.entries(NOTIFICATION_META).filter(([, meta]) => meta.group === group);
        return (
          <div key={group}>
            <p className="mb-2 px-1 text-xs font-semibold text-muted-foreground">{group}</p>
            <div className="divide-y divide-line overflow-hidden rounded-[20px] border border-line bg-card">
              {groupTypes.map(([notifType, meta]) => {
                const preference = preferenceByType[notifType] ?? { inApp: true, whatsApp: false };
                const isSavingThis = savingNotifType === notifType;
                const TypeIcon = meta.icon;
                return (
                  <div key={notifType} className="flex items-center gap-3 p-3.5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-knob">
                      <TypeIcon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{meta.label}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{meta.description}</p>
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      {isSavingThis && <OrbitaSpinner className="size-3.5" />}
                      {channels.map((channel) => {
                        const ChannelIcon = CHANNEL_META[channel].icon;
                        return (
                          <label
                            key={channel}
                            className="flex min-h-9 flex-col items-center justify-center gap-1"
                            title={
                              channel === "whatsApp"
                                ? "Precisa de um WhatsApp conectado com o seu número"
                                : undefined
                            }
                          >
                            {hasManyChannels && (
                              <ChannelIcon className="size-3 text-muted-foreground" />
                            )}
                            <Switch
                              checked={preference[channel]}
                              onCheckedChange={() => toggleChannel(notifType, channel)}
                              disabled={isSavingThis}
                              aria-label={`${meta.label} — ${CHANNEL_META[channel].label}`}
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {channels.includes("whatsApp") && (
        <p className="text-xs text-muted-foreground">
          * O envio pelo WhatsApp precisa de um número conectado na empresa e do seu número
          cadastrado no perfil.
        </p>
      )}
    </div>
  );
}
