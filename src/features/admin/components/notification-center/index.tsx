"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { orpc } from "@/lib/orpc";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Bell,
  Send,
  Users,
  Building2,
  User,
  Plus,
  Copy,
  Zap,
  Search,
  Loader2,
} from "lucide-react";
import { useDebouncedValue } from "@/hooks/use-debounced";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  NOTIFICATION_TEMPLATES,
  interpolateTemplate,
  type NotificationTemplate,
} from "../../lib/notification-templates";
import { DeleteNotification } from "./delete-notification";

interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  targetType: string;
  targetId: string | null;
  createdBy: string;
  createdAt: string;
  readCount: number;
}

interface Org {
  id: string;
  name: string;
}

const TYPE_COLORS: Record<string, string> = {
  info: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  warning: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  error: "bg-red-500/10 text-red-400 border-red-500/20",
};

const TARGET_ICON: Record<string, React.ElementType> = {
  all: Users,
  org: Building2,
  user: User,
};

export function NotificationCenterV2({
  notifications,
}: {
  notifications: Notification[];
}) {
  const router = useRouter();

  // Modal states
  const [showFormModal, setShowFormModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] =
    useState<NotificationTemplate | null>(null);

  // Form state
  const [form, setForm] = useState({
    title: "",
    body: "",
    type: "info" as "info" | "warning" | "success" | "error",
    targetType: "all" as "all" | "org" | "user",
    targetId: "",
    severity: "info" as "info" | "warning" | "critical",
    urgentPopup: false,
  });

  // Template form state
  const [templateForm, setTemplateForm] = useState({
    templateId: "",
    variables: {} as Record<string, string>,
  });

  const [sent, setSent] = useState(false);

  // Organization search state
  const [searchOrg, setSearchOrg] = useState("");
  const debouncedSearchOrg = useDebouncedValue(searchOrg, 500);

  const { data: orgsData, isLoading: isLoadingOrgs } = useQuery(
    orpc.admin.listOrganizationsForSelection.queryOptions({
      input: {
        search: debouncedSearchOrg,
        limit: 100,
      },
    }),
  );

  const mut = useMutation({
    mutationFn: () =>
      orpc.admin.sendNotification.call({
        title: form.title,
        body: form.body,
        type: form.type,
        targetType: form.targetType,
        targetId: form.targetId || null,
        severity: form.severity,
        // Quando "urgentPopup" está ligado, força displaySurface=popup + requiresAck
        // independente da severity (Master pode promover um info pra popup
        // se realmente precisar parar todos pra ler).
        displaySurface: form.urgentPopup ? "popup" : undefined,
        requiresAck: form.urgentPopup || form.severity === "critical",
      }),
    onSuccess: () => {
      setSent(true);
      resetForm();
      setTimeout(() => {
        setSent(false);
        setShowFormModal(false);
        router.refresh();
      }, 1500);
    },
  });

  const resetForm = () => {
    setForm({
      title: "",
      body: "",
      type: "info",
      targetType: "all",
      targetId: "",
      severity: "info",
      urgentPopup: false,
    });
  };

  const handleTemplateSelect = (template: NotificationTemplate) => {
    setSelectedTemplate(template);
    setTemplateForm({
      templateId: template.id,
      variables:
        template.variables?.reduce((acc, v) => ({ ...acc, [v]: "" }), {}) || {},
    });
  };

  const handleApplyTemplate = () => {
    if (selectedTemplate) {
      const interpolated = interpolateTemplate(
        selectedTemplate,
        templateForm.variables,
      );
      setForm({
        title: interpolated.title,
        body: interpolated.body,
        type: selectedTemplate.type,
        targetType: "all",
        targetId: "",
        severity: "info",
        urgentPopup: false,
      });
      setShowTemplateModal(false);
      setShowFormModal(true);
    }
  };

  return (
    <div className="space-y-5">
      {/* Buttons */}
      <div className="flex gap-3 justify-end">
        <button
          onClick={() => setShowTemplateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm rounded-lg transition-colors"
        >
          <Zap className="w-4 h-4" />
          Usar Template
        </button>
        <button
          onClick={() => {
            resetForm();
            setShowFormModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm rounded-lg transition-colors"
        >
          <Send className="w-4 h-4" />
          Nova Notificação
        </button>
      </div>

      {/* Template Modal */}
      <Modal
        isOpen={showTemplateModal}
        onClose={() => {
          setShowTemplateModal(false);
          setSelectedTemplate(null);
        }}
        title="Selecionar Template"
        size="lg"
      >
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {NOTIFICATION_TEMPLATES.map((template) => (
            <button
              key={template.id}
              onClick={() => handleTemplateSelect(template)}
              className={`w-full text-left p-3 rounded-lg border transition-colors ${
                selectedTemplate?.id === template.id
                  ? "bg-violet-600/20 border-violet-500"
                  : "bg-zinc-800 border-zinc-700 hover:border-zinc-600"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="font-semibold text-white text-sm">
                    {template.name}
                  </p>
                  <p className="text-xs text-zinc-400 mt-1">{template.title}</p>
                  <p className="text-xs text-zinc-500 mt-1 line-clamp-2">
                    {template.body}
                  </p>
                </div>
                <span
                  className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${
                    {
                      info: "bg-blue-500/20 text-blue-300",
                      warning: "bg-yellow-500/20 text-yellow-300",
                      success: "bg-emerald-500/20 text-emerald-300",
                      error: "bg-red-500/20 text-red-300",
                    }[template.type]
                  }`}
                >
                  {template.type}
                </span>
              </div>
            </button>
          ))}
        </div>
      </Modal>

      {/* Template Variables Modal */}
      {selectedTemplate && (
        <Modal
          isOpen={showTemplateModal && selectedTemplate !== null}
          onClose={() => {
            setShowTemplateModal(false);
            setSelectedTemplate(null);
          }}
          title={`Configurar: ${selectedTemplate.name}`}
          size="md"
          footer={
            <>
              <button
                onClick={() => {
                  setShowTemplateModal(false);
                  setSelectedTemplate(null);
                }}
                className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleApplyTemplate}
                disabled={
                  selectedTemplate.variables &&
                  selectedTemplate.variables.some(
                    (v) => !templateForm.variables[v],
                  )
                }
                className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                Aplicar Template
              </button>
            </>
          }
        >
          {selectedTemplate.variables &&
          selectedTemplate.variables.length > 0 ? (
            <div className="space-y-4">
              {selectedTemplate.variables.map((variable) => (
                <div key={variable}>
                  <label className="block text-xs text-zinc-400 mb-1.5 capitalize">
                    {variable} *
                  </label>
                  <input
                    type="text"
                    value={templateForm.variables[variable] || ""}
                    onChange={(e) =>
                      setTemplateForm((f) => ({
                        ...f,
                        variables: {
                          ...f.variables,
                          [variable]: e.target.value,
                        },
                      }))
                    }
                    placeholder={`Digite ${variable}...`}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500"
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-400">
              Este template não requer variáveis adicionais.
            </p>
          )}
        </Modal>
      )}

      {/* Form Modal */}
      <Modal
        isOpen={showFormModal}
        onClose={() => setShowFormModal(false)}
        title="Enviar Notificação"
        size="lg"
        footer={
          <>
            <button
              onClick={() => setShowFormModal(false)}
              className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => mut.mutate()}
              disabled={mut.isPending || !form.title || !form.body}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
            >
              <Send className="w-4 h-4" />
              {sent ? "Enviada! ✓" : mut.isPending ? "Enviando..." : "Enviar"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {mut.isError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
              Erro ao enviar notificação.
            </div>
          )}

          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">
              Título *
            </label>
            <input
              value={form.title}
              onChange={(e) =>
                setForm((f) => ({ ...f, title: e.target.value }))
              }
              maxLength={100}
              placeholder="Título da notificação"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500"
            />
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">
              Mensagem *
            </label>
            <textarea
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              maxLength={2000}
              rows={4}
              placeholder="Conteúdo da notificação..."
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">Tipo</label>
              <select
                value={form.type}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    type: e.target.value as typeof form.type,
                  }))
                }
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-violet-500"
              >
                <option value="info">Info</option>
                <option value="success">Sucesso</option>
                <option value="warning">Aviso</option>
                <option value="error">Erro</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">
                Destinatário
              </label>
              <select
                value={form.targetType}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    targetType: e.target.value as typeof form.targetType,
                    targetId: "",
                  }))
                }
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-violet-500"
              >
                <option value="all">Todos os usuários</option>
                <option value="org">Empresa específica</option>
                <option value="user">Usuário específico (ID)</option>
              </select>
            </div>
          </div>

          {/* ── Severidade (camada de alertas) ─────────────────────────── */}
          <div className="rounded-lg border border-zinc-700/80 bg-zinc-900/40 p-3 space-y-3">
            <p className="text-xs text-zinc-400 font-medium">
              Severidade do alerta
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  {
                    value: "info",
                    label: "Info",
                    sub: "Cai no sininho",
                    color: "blue",
                  },
                  {
                    value: "warning",
                    label: "Atenção",
                    sub: "Toast + sininho",
                    color: "amber",
                  },
                  {
                    value: "critical",
                    label: "Crítico",
                    sub: "Popup full-screen",
                    color: "red",
                  },
                ] as const
              ).map((opt) => {
                const isActive = form.severity === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      setForm((f) => ({ ...f, severity: opt.value }))
                    }
                    className={`text-left rounded-lg border px-3 py-2 transition-colors ${
                      isActive
                        ? opt.color === "blue"
                          ? "border-blue-500 bg-blue-500/15"
                          : opt.color === "amber"
                            ? "border-amber-500 bg-amber-500/15"
                            : "border-red-500 bg-red-500/15"
                        : "border-zinc-700 bg-zinc-800/50 hover:border-zinc-600"
                    }`}
                  >
                    <p className="text-sm font-semibold text-white">
                      {opt.label}
                    </p>
                    <p className="text-[10px] text-zinc-400 mt-0.5">{opt.sub}</p>
                  </button>
                );
              })}
            </div>

            <label className="flex items-start gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.urgentPopup}
                onChange={(e) =>
                  setForm((f) => ({ ...f, urgentPopup: e.target.checked }))
                }
                className="mt-0.5 accent-red-500"
              />
              <div>
                <p className="text-sm text-white font-medium">
                  Mostrar como popup urgente
                </p>
                <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">
                  Independente da severidade, força popup full-screen que
                  exige confirmação do usuário pra fechar. Use só em situações
                  realmente urgentes — interrompe o que o destinatário
                  estiver fazendo.
                </p>
              </div>
            </label>
          </div>

          {form.targetType === "org" && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5 font-medium">
                  Pesquisar Empresa
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    value={searchOrg}
                    onChange={(e) => setSearchOrg(e.target.value)}
                    placeholder="Nome da empresa..."
                    className="w-full pl-9 pr-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500"
                  />
                  {isLoadingOrgs && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="w-4 h-4 text-zinc-500 animate-spin" />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1.5 font-medium">
                  Selecionar Empresa *
                </label>
                <select
                  value={form.targetId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, targetId: e.target.value }))
                  }
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-violet-500"
                >
                  <option value="">
                    {isLoadingOrgs ? "Carregando..." : "Selecione..."}
                  </option>
                  {orgsData?.organizations.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                  {!isLoadingOrgs &&
                    orgsData?.organizations.length === 0 &&
                    searchOrg && (
                      <option disabled>Nenhuma empresa encontrada</option>
                    )}
                </select>
              </div>
            </div>
          )}

          {form.targetType === "user" && (
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">
                ID do usuário
              </label>
              <input
                value={form.targetId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, targetId: e.target.value }))
                }
                placeholder="ID do usuário"
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500"
              />
            </div>
          )}
        </div>
      </Modal>

      {/* Notifications List */}
      <div className="space-y-3">
        {notifications.length === 0 && (
          <div className="text-center py-12 text-zinc-500 text-sm">
            <Bell className="w-8 h-8 mx-auto mb-3 text-zinc-700" />
            Nenhuma notificação enviada ainda.
          </div>
        )}
        {notifications.map((n) => {
          const TargetIcon = TARGET_ICON[n.targetType] ?? Users;
          return (
            <div
              key={n.id}
              className={`border rounded-xl p-4 ${TYPE_COLORS[n.type] ?? TYPE_COLORS.info}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold uppercase tracking-wide opacity-80">
                      {n.type}
                    </span>
                    <span className="text-zinc-600">·</span>
                    <TargetIcon className="w-3 h-3 text-zinc-500" />
                    <span className="text-xs text-zinc-500">
                      {n.targetType === "all"
                        ? "Todos"
                        : n.targetType === "org"
                          ? "Empresa"
                          : "Usuário"}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-white">{n.title}</p>
                  <p className="text-xs text-zinc-300 mt-1 line-clamp-2">
                    {n.body}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <div className="flex flex-col items-end gap-2">
                    <p className="text-xs text-zinc-500">
                      {new Date(n.createdAt).toLocaleDateString("pt-BR")}
                    </p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-zinc-600">
                        {n.readCount} leitura(s)
                      </p>
                      <DeleteNotification notificationId={n.id} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
