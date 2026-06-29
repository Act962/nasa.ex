"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Bell, Smartphone, Monitor, Loader2 } from "lucide-react";
import { useState } from "react";

const NOTIF_META: Record<string, { label: string; icon: string; description: string; group: string }> = {
  NEW_LEAD:             { label: "Novo Lead",                icon: "🎯", description: "Quando um novo lead chegar no CRM ou Chat",             group: "CRM & Chat" },
  CARD_EDIT:            { label: "Edição de Card/Tarefa",    icon: "📝", description: "Cards onde você é responsável ou participante editados", group: "Tarefas" },
  APPOINTMENT_REMINDER: { label: "Lembrete de Agendamento",  icon: "📅", description: "Agendamentos próximos do vencimento",                   group: "Agenda" },
  INSIGHTS_MOVEMENT:    { label: "Movimentação de Insights", icon: "📊", description: "Novos eventos nos dashboards de insights",               group: "Insights" },
  AI_TOKEN_ALERT:       { label: "Alerta de Tokens IA",      icon: "🤖", description: "Consumo alto de tokens nas integrações com IA",          group: "Integrações" },
  STARS_ALERT:          { label: "Alerta de Stars",          icon: "⭐", description: "Saldo de Stars baixo na empresa",                       group: "Financeiro" },
  PLAN_EXPIRY:          { label: "Vencimento de Plano",      icon: "⚠️", description: "Plano da empresa próximo do vencimento",                 group: "Financeiro" },
  ADMIN_MESSAGE:        { label: "Mensagem do Admin",        icon: "📢", description: "Comunicados enviados pelos administradores",             group: "Sistema" },
  CUSTOM:               { label: "Alertas Personalizados",   icon: "🔔", description: "Lembretes e alertas configurados manualmente",           group: "Sistema" },
};

const GROUPS = ["CRM & Chat", "Tarefas", "Agenda", "Insights", "Integrações", "Financeiro", "Sistema"];

interface Pref { notifType: string; inApp: boolean; whatsApp: boolean }

export function NotificationPreferencesPanel({ organizationId }: { organizationId: string }) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState<string | null>(null);

  const { data: prefs = [], isLoading } = useQuery({
    queryKey: ["notif-prefs", organizationId],
    queryFn: () => orpc.userNotifications.getPreferences.call({ organizationId }),
  });

  const prefMap: Record<string, Pref> = {};
  for (const p of prefs) prefMap[p.notifType] = p;

  const mut = useMutation({
    mutationFn: (data: { notifType: string; inApp: boolean; whatsApp: boolean }) =>
      orpc.userNotifications.setPreference.call({ organizationId, ...data }),
    onMutate: (vars) => setSaving(vars.notifType),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notif-prefs", organizationId] }),
    onSettled: () => setSaving(null),
  });

  function toggle(notifType: string, field: "inApp" | "whatsApp") {
    const current = prefMap[notifType] ?? { notifType, inApp: true, whatsApp: false };
    mut.mutate({ notifType, inApp: current.inApp, whatsApp: current.whatsApp, [field]: !current[field] });
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-8">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Carregando preferências...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Legend */}
      <div className="flex items-center gap-6 text-xs text-muted-foreground pb-1 border-b">
        <div className="flex items-center gap-1.5">
          <Monitor className="w-3.5 h-3.5" /> Na plataforma
        </div>
        <div className="flex items-center gap-1.5">
          <Smartphone className="w-3.5 h-3.5" /> WhatsApp
        </div>
      </div>

      {GROUPS.map((group) => {
        const groupTypes = Object.entries(NOTIF_META).filter(([, m]) => m.group === group);
        return (
          <div key={group}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">{group}</p>
            <div className="space-y-2">
              {groupTypes.map(([type, meta]) => {
                const pref = prefMap[type] ?? { inApp: true, whatsApp: false };
                const isSavingThis = saving === type;
                return (
                  <div
                    key={type}
                    className="flex items-center justify-between p-3.5 rounded-xl border bg-card hover:bg-accent/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{meta.icon}</span>
                      <div>
                        <p className="text-sm font-medium">{meta.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{meta.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0 ml-4">
                      {isSavingThis && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}

                      {/* In-app toggle */}
                      <div className="flex flex-col items-center gap-1">
                        <Monitor className="w-3 h-3 text-muted-foreground" />
                        <button
                          onClick={() => toggle(type, "inApp")}
                          disabled={isSavingThis}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-60 ${
                            pref.inApp ? "bg-violet-600" : "bg-muted"
                          }`}
                        >
                          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                            pref.inApp ? "translate-x-4" : "translate-x-0.5"
                          }`} />
                        </button>
                      </div>

                      {/* WhatsApp toggle */}
                      <div className="flex flex-col items-center gap-1">
                        <Smartphone className="w-3 h-3 text-muted-foreground" />
                        <button
                          onClick={() => toggle(type, "whatsApp")}
                          disabled={isSavingThis}
                          title="Requer instância WhatsApp conectada com seu número"
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-60 ${
                            pref.whatsApp ? "bg-emerald-600" : "bg-muted"
                          }`}
                        >
                          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                            pref.whatsApp ? "translate-x-4" : "translate-x-0.5"
                          }`} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <p className="text-xs text-muted-foreground">
        * O envio via WhatsApp requer que sua empresa tenha uma instância conectada e que seu número esteja vinculado à plataforma.
      </p>
    </div>
  );
}
