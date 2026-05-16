"use client";

import { useRef, useState } from "react";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useBuilderStore } from "../../context/builder-form-provider";
import type { FormSettings } from "@/generated/prisma/client";
import {
  useQueryStatus,
  useQueryTrackings,
} from "@/features/trackings/hooks/use-trackings";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Uploader } from "@/components/file-uploader/uploader";
import { useConstructUrl } from "@/hooks/use-construct-url";
import {
  DEFAULT_PROGRESS_MASCOTS,
  resolveProgressMascots,
  type ProgressMascot,
} from "@/features/form/lib/progress-mascots";
import { InfoIcon, UploadIcon, XIcon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AppTemplateToggle } from "@/features/admin/components/app-template-toggle";
import { useQueryListForms } from "@/features/form/hooks/use-form";
import { useQueryTags } from "@/features/tags/hooks/use-tags";
import {
  resolveNextButtonAction,
  type NextButtonAction,
  type NextButtonActionType,
} from "@/features/form/lib/next-button-action";
import { SendMessageDialog } from "./send-whatsapp-message";
import { VariablePicker } from "@/features/executions/components/send-message/variable-picker";
import { useVariableAutocomplete } from "@/features/executions/components/send-message/use-variable-autocomplete";

export function FormSettings() {
  const { formData, updateSettings } = useBuilderStore();
  const formId = formData?.id;
  const [chatDialogOpen, setChatDialogOpen] = useState(false);
  const { trackings } = useQueryTrackings();
  const { status } = useQueryStatus({
    trackingId: formData?.settings?.trackingId || "",
  });

  const settings = formData?.settings;
  if (!settings) return null;

  const whatsappChats = ((settings as any).whatsappChats ?? []) as {
    chatId: string;
    chatName: string;
  }[];

  const whatsappMessage = ((settings as any).whatsappMessage ?? "") as string;

  const trackingName = trackings?.find(
    (t) => t.id === settings.trackingId,
  )?.name;

  const statusName = status?.find((s) => s.id === settings.statusId)?.name;

  const handleUploadBackground = (key: string) => {
    if (!key) {
      updateSettings({ backgroundImage: null });
      return;
    }

    const fullUrl = `https://${process.env.NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL}/${key}`;
    updateSettings({ backgroundImage: fullUrl });
  };

  // Helper to extract key from full URL if needed (for Uploader value)
  const extractKeyFromUrl = (url: string | null) => {
    if (!url) return "";
    const parts = url.split("/");
    return parts[parts.length - 1];
  };

  const onSelectSendMessage = (chatId: string, chatName: string) => {
    const already = whatsappChats.some((e) => e.chatId === chatId);
    if (already) return;
    updateSettings({
      whatsappChats: [...whatsappChats, { chatId, chatName }],
    } as any);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* ─── Direcionamento ─────────────────────────────── */}
      <section>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3">
          Direcionamento
        </h3>
        <div className="flex flex-col gap-3">
          <Field>
            <FieldLabel>Tracking</FieldLabel>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                  {trackingName || "Selecionar"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="start">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Trackings</DropdownMenuLabel>
                  {trackings?.map((tracking) => (
                    <DropdownMenuItem
                      onClick={() =>
                        updateSettings({ trackingId: tracking.id })
                      }
                      key={tracking.id}
                    >
                      {tracking.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </Field>

          <Field>
            <FieldLabel>Status</FieldLabel>
            <DropdownMenu>
              <DropdownMenuTrigger disabled={!settings.trackingId} asChild>
                <Button variant="outline" className="w-full justify-start">
                  {statusName || "Selecionar"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="start">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Status</DropdownMenuLabel>
                  {status?.map((s) => (
                    <DropdownMenuItem
                      onClick={() => updateSettings({ statusId: s.id })}
                      key={s.id}
                    >
                      {s.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </Field>
        </div>
      </section>

      <Separator />

      {/* ─── Campos do Lead ─────────────────────────────── */}
      <section>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3">
          Campos do Lead
        </h3>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">Exigir identificação</span>
            <Switch
              checked={settings.needLogin}
              onCheckedChange={(checked) =>
                updateSettings({ needLogin: checked })
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Mostrar Nome</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Mostrar E-mail</span>
            <Switch
              checked={settings.showEmail}
              onCheckedChange={(checked) =>
                updateSettings({ showEmail: checked })
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Mostrar Telefone</span>
            <Switch
              checked={settings.showPhone}
              onCheckedChange={(checked) =>
                updateSettings({ showPhone: checked })
              }
            />
          </div>
        </div>
      </section>

      <Separator />

      {/* ─── Aparência ──────────────────────────────────── */}
      <section>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3">
          Aparência
        </h3>
        <div className="flex flex-col gap-3">
          <Field>
            <FieldLabel>Cor primária</FieldLabel>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={settings.primaryColor}
                onChange={(e) =>
                  updateSettings({ primaryColor: e.target.value })
                }
                className="w-8 h-8 rounded cursor-pointer border-0"
              />
              <Input
                value={settings.primaryColor}
                onChange={(e) =>
                  updateSettings({ primaryColor: e.target.value })
                }
                className="flex-1"
              />
            </div>
          </Field>
          <Field>
            <FieldLabel className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                Cor de fundo
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <InfoIcon className="size-4 cursor-pointer text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        A cor de fundo influencia diretamente a cor das letras
                        para garantir legibilidade.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </span>
              <Switch
                checked={!!settings.backgroundColor}
                onCheckedChange={(enabled) =>
                  updateSettings({
                    backgroundColor: enabled ? "#f0ebf8" : "",
                  })
                }
                aria-label="Ativar/desativar cor de fundo"
              />
            </FieldLabel>
            {settings.backgroundColor ? (
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings.backgroundColor}
                  onChange={(e) =>
                    updateSettings({ backgroundColor: e.target.value })
                  }
                  className="w-8 h-8 rounded cursor-pointer border-0"
                />
                <Input
                  value={settings.backgroundColor}
                  onChange={(e) =>
                    updateSettings({ backgroundColor: e.target.value })
                  }
                  className="flex-1"
                />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                Sem cor de fundo — herda o tema do navegador (claro/escuro).
              </p>
            )}
          </Field>
          <Field>
            <FieldLabel>Imagem de fundo</FieldLabel>
            <div className="flex items-center gap-2 w-full">
              <Uploader
                value={extractKeyFromUrl(settings.backgroundImage)}
                onConfirm={handleUploadBackground}
                fileTypeAccepted="image"
              />
            </div>
          </Field>
        </div>
      </section>

      <Separator />

      {/* ─── Navegação entre grupos ──────────────────────── */}
      {(() => {
        const stepMode = ((settings as unknown as { stepMode?: string })
          .stepMode ?? "off") as "off" | "auto" | "manual";
        const nextLabel =
          (settings as unknown as { nextButtonLabel?: string })
            .nextButtonLabel ?? "Próximo";
        return (
          <>
            <section>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                Navegação entre grupos
              </h3>
              <div className="flex flex-col gap-3">
                <Field>
                  <FieldLabel className="flex items-center justify-between gap-2">
                    <span>Modo passo-a-passo</span>
                    <Switch
                      checked={stepMode !== "off"}
                      onCheckedChange={(enabled) =>
                        updateSettings({
                          stepMode: enabled ? "auto" : "off",
                        } as Record<string, unknown>)
                      }
                    />
                  </FieldLabel>
                  <p className="text-xs text-muted-foreground">
                    {stepMode === "off"
                      ? "Todos os grupos aparecem juntos na página."
                      : "Mostra um grupo por vez, em sequência."}
                  </p>
                </Field>

                {stepMode !== "off" && (
                  <>
                    <Field>
                      <FieldLabel>Avanço para o próximo grupo</FieldLabel>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            updateSettings({
                              stepMode: "auto",
                            } as Record<string, unknown>)
                          }
                          className={`text-xs px-3 py-2 rounded border ${
                            stepMode === "auto"
                              ? "border-primary bg-primary/10 text-foreground"
                              : "border-border hover:bg-accent"
                          }`}
                        >
                          Automático
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateSettings({
                              stepMode: "manual",
                            } as Record<string, unknown>)
                          }
                          className={`text-xs px-3 py-2 rounded border ${
                            stepMode === "manual"
                              ? "border-primary bg-primary/10 text-foreground"
                              : "border-border hover:bg-accent"
                          }`}
                        >
                          Botão "Próximo"
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {stepMode === "auto"
                          ? "Quando todos os campos do grupo estiverem preenchidos, o próximo aparece sozinho."
                          : "O usuário precisa clicar num botão pra ver o próximo grupo."}
                      </p>
                    </Field>

                    {stepMode === "manual" && (
                      <>
                        <Field>
                          <FieldLabel>Texto do botão</FieldLabel>
                          <Input
                            value={nextLabel}
                            placeholder="Próximo"
                            onChange={(e) =>
                              updateSettings({
                                nextButtonLabel: e.target.value,
                              } as Record<string, unknown>)
                            }
                          />
                        </Field>

                        <NextButtonActionSection
                          settings={settings}
                          updateSettings={updateSettings}
                        />
                      </>
                    )}
                  </>
                )}
              </div>
            </section>

            <Separator />
          </>
        );
      })()}

      {/* ─── Mascote da barra de progresso ───────────────── */}
      <ProgressMascotsSection
        settings={settings}
        updateSettings={updateSettings}
      />

      <Separator />

      {/* ─── Mensagens ──────────────────────────────────── */}
      <section>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3">
          Mensagens
        </h3>
        <Field>
          <FieldLabel>Mensagem de finalização</FieldLabel>
          <Textarea
            value={settings.finishMessage}
            onChange={(e) => updateSettings({ finishMessage: e.target.value })}
            placeholder="Obrigado por seu cadastro!"
            rows={3}
          />
        </Field>
      </section>

      <Separator />

      {/* ─── Integrações ────────────────────────────────── */}
      <section>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3">
          Integrações
        </h3>
        <div className="flex flex-col gap-3">
          <Field>
            <FieldLabel>URL de redirecionamento</FieldLabel>
            <Input
              value={settings.redirectUrl || ""}
              onChange={(e) =>
                updateSettings({
                  redirectUrl: e.target.value || null,
                })
              }
              placeholder="https://seusite.com/obrigado"
            />
          </Field>
          <Field>
            <FieldLabel>ID do Facebook Pixel</FieldLabel>
            <Input
              value={settings.idPixel || ""}
              onChange={(e) =>
                updateSettings({
                  idPixel: e.target.value || null,
                })
              }
              placeholder="123456789"
            />
          </Field>
          <Field>
            <FieldLabel>ID do Google Tag Manager</FieldLabel>
            <Input
              value={settings.idTagManager || ""}
              onChange={(e) =>
                updateSettings({
                  idTagManager: e.target.value || null,
                })
              }
              placeholder="GTM-XXXXXXX"
            />
          </Field>
        </div>
      </section>

      <Separator />

      {/* ─── WhatsApp ────────────────────────────────── */}
      <section>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3">
          WhatsApp
        </h3>
        <div className="flex flex-col gap-2">
          <FieldLabel>Chats de destino</FieldLabel>

          {whatsappChats.map((entry, idx) => (
            <div
              key={entry.chatId}
              className="flex items-center gap-2 rounded border px-3 py-2"
            >
              <span className="text-sm flex-1 truncate">{entry.chatName}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  const next = whatsappChats.filter((_, i) => i !== idx);
                  updateSettings({ whatsappChats: next } as any);
                }}
              >
                <XIcon className="size-4" />
              </Button>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            className="w-full justify-start"
            disabled={!settings.trackingId}
            onClick={() => setChatDialogOpen(true)}
          >
            {settings.trackingId
              ? "Adicionar chat"
              : "Selecione um tracking primeiro"}
          </Button>
        </div>

        <Field className="mt-3">
          <FieldLabel>Mensagem personalizada</FieldLabel>
          <p className="text-xs text-muted-foreground mb-1.5">
            Digite <code className="text-xs bg-muted px-1 rounded">/</code> para
            inserir variáveis (nome, e-mail, telefone…). Deixe vazio para usar a
            mensagem padrão.
          </p>
          <WhatsappMessageTextarea
            value={whatsappMessage}
            onChange={(val) =>
              updateSettings({ whatsappMessage: val || null } as any)
            }
          />
        </Field>
      </section>
      <SendMessageDialog
        trackingId={settings.trackingId ?? ""}
        open={chatDialogOpen}
        onOpenChange={setChatDialogOpen}
        selectedChatIds={whatsappChats.map((e) => e.chatId)}
        onSelect={onSelectSendMessage}
      />
      {/* ─── Padrão NASA ────────────────────────────────── */}
      {formId && (
        <>
          <Separator />
          <section>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">
              Moderação
            </h3>
            <AppTemplateToggle
              appId={formId}
              appType="form"
              isTemplate={formData?.isTemplate ?? false}
            />
          </section>
        </>
      )}
    </div>
  );
}

function ProgressMascotsSection({
  settings,
  updateSettings,
}: {
  settings: unknown;
  updateSettings: (updates: Partial<FormSettings>) => void;
}) {
  const raw = (settings as { progressMascots?: unknown } | null)
    ?.progressMascots;
  const mascots = resolveProgressMascots(raw);

  function commit(next: ProgressMascot[]) {
    updateSettings({
      progressMascots:
        next as unknown as Partial<FormSettings>["progressMascots"],
    });
  }

  function update(idx: number, patch: Partial<ProgressMascot>) {
    const next = mascots.map((m, i) => (i === idx ? { ...m, ...patch } : m));
    commit(next);
  }

  function resetAll() {
    commit(DEFAULT_PROGRESS_MASCOTS);
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-muted-foreground">
          Mascote da barra de progresso
        </h3>
        <button
          type="button"
          onClick={resetAll}
          className="text-[11px] text-muted-foreground hover:text-foreground underline"
        >
          restaurar padrão
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground mb-3">
        Personalize o ícone que caminha sobre a barra conforme o usuário
        preenche o formulário (modo passo-a-passo). Use emoji ou faça upload de
        uma imagem (PNG/SVG).
      </p>

      <div className="flex flex-col gap-3">
        {mascots.map((m, idx) => (
          <MascotRow
            key={idx}
            index={idx}
            mascot={m}
            onChange={(patch) => update(idx, patch)}
          />
        ))}
      </div>
    </section>
  );
}

function MascotRow({
  mascot,
  onChange,
}: {
  index: number;
  mascot: ProgressMascot;
  onChange: (patch: Partial<ProgressMascot>) => void;
}) {
  const imgSrc = useConstructUrl(mascot.imageUrl || "");
  const range =
    mascot.min === mascot.max
      ? `${mascot.min}%`
      : `${mascot.min}–${mascot.max}%`;

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded border bg-foreground/2">
      {/* Preview */}
      <div className="size-8 shrink-0 rounded border bg-background flex items-center justify-center overflow-hidden">
        {mascot.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgSrc}
            alt={mascot.label}
            className="w-full h-full object-contain"
          />
        ) : (
          <span className="text-lg leading-none">{mascot.emoji || "•"}</span>
        )}
      </div>

      {/* Range badge */}
      <span className="text-[10px] font-mono px-1 py-0.5 rounded bg-foreground/10 shrink-0 tabular-nums">
        {range}
      </span>

      {/* Emoji ou input rótulo (compacto) */}
      <Input
        value={mascot.emoji ?? ""}
        onChange={(e) => onChange({ emoji: e.target.value, imageUrl: "" })}
        placeholder="🌱"
        className="h-7 w-12 text-base text-center px-1 shrink-0"
        disabled={!!mascot.imageUrl}
        title="Emoji"
      />
      <Input
        value={mascot.label}
        onChange={(e) => onChange({ label: e.target.value })}
        placeholder="Rótulo"
        className="h-7 text-xs flex-1 min-w-0"
      />

      {/* Upload mini */}
      <MiniImageUploadButton
        currentUrl={mascot.imageUrl}
        onUpload={(key) => onChange({ imageUrl: key, emoji: "" })}
        onClear={() => onChange({ imageUrl: "" })}
      />
    </div>
  );
}

/**
 * Botão compacto de upload de imagem. Usa o mesmo backend de presigned URL
 * (`/api/s3/upload`) que o Uploader principal, mas ocupa só 28px de altura.
 */
function MiniImageUploadButton({
  currentUrl,
  onUpload,
  onClear,
}: {
  currentUrl?: string;
  onUpload: (key: string) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    if (!file) return;
    setUploading(true);
    try {
      const res = await fetch("/api/s3/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          size: file.size,
          isImage: true,
        }),
      });
      if (!res.ok) throw new Error("upload presign failed");
      const { presignedUrl, key } = await res.json();
      const put = await fetch(presignedUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!put.ok) throw new Error("upload put failed");
      onUpload(key);
    } catch {
      // silencioso — usuário tenta de novo
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-1 shrink-0">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="size-7 flex items-center justify-center rounded border bg-background hover:bg-accent transition-colors disabled:opacity-50"
        title={currentUrl ? "Trocar imagem" : "Enviar imagem"}
      >
        {uploading ? (
          <span className="size-3 rounded-full border-2 border-foreground/30 border-t-foreground animate-spin" />
        ) : (
          <UploadIcon className="size-3.5" />
        )}
      </button>
      {currentUrl && (
        <button
          type="button"
          onClick={onClear}
          className="size-7 flex items-center justify-center rounded border bg-background hover:bg-destructive hover:text-destructive-foreground transition-colors"
          title="Remover imagem"
        >
          <XIcon className="size-3.5" />
        </button>
      )}
    </div>
  );
}

/**
 * Configuração da ação do botão "Próximo" no último grupo:
 * 1. Próximo bloco (default — comportamento atual)
 * 2. Formulário (abre outro form com dados do lead)
 * 3. Link externo (redireciona com dados do lead na query)
 * 4. Adicionar tag (aplica tag ao lead criado)
 *
 * Todas as opções repassam dados do lead via query string (leadId, leadToken,
 * email, name, phone), exceto "next_block" e "add_tag" que mantêm o fluxo
 * padrão de finalização do formulário.
 */
function NextButtonActionSection({
  settings,
  updateSettings,
}: {
  settings: unknown;
  updateSettings: (updates: Partial<FormSettings>) => void;
}) {
  const raw = (settings as { nextButtonAction?: unknown } | null)
    ?.nextButtonAction;
  const action = resolveNextButtonAction(raw);
  const trackingId =
    (settings as { trackingId?: string | null } | null)?.trackingId ?? "";

  function commit(patch: Partial<NextButtonAction>) {
    const next: NextButtonAction = { ...action, ...patch };
    updateSettings({
      nextButtonAction:
        next as unknown as Partial<FormSettings>["nextButtonAction"],
    });
  }

  const TYPE_LABELS: Array<{
    type: NextButtonActionType;
    label: string;
    hint: string;
  }> = [
    {
      type: "next_block",
      label: "Próximo bloco",
      hint: "Avança para o próximo grupo do formulário (padrão).",
    },
    {
      type: "form",
      label: "Formulário",
      hint: "Abre outro formulário levando os dados do lead.",
    },
    {
      type: "external_link",
      label: "Link externo",
      hint: "Redireciona pra uma URL externa com os dados do lead.",
    },
    {
      type: "add_tag",
      label: "Adicionar tag",
      hint: "Aplica uma tag ao lead criado e finaliza o formulário.",
    },
  ];

  return (
    <Field>
      <FieldLabel className="flex items-center gap-2">
        <span>Ação ao clicar em "Próximo" (último passo)</span>
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
              >
                <InfoIcon className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              Define o que acontece quando o usuário termina o último grupo.
              Todas as opções carregam os dados do lead (id, token, email, nome,
              telefone) na query string ou no payload da ação.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </FieldLabel>

      <div className="grid grid-cols-2 gap-2">
        {TYPE_LABELS.map((opt) => (
          <button
            key={opt.type}
            type="button"
            onClick={() => commit({ type: opt.type })}
            className={`text-xs px-3 py-2 rounded border text-left ${
              action.type === opt.type
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border hover:bg-accent"
            }`}
          >
            <div className="font-medium">{opt.label}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
              {opt.hint}
            </div>
          </button>
        ))}
      </div>

      {/* Sub-opções por tipo */}
      {action.type === "form" && (
        <NextButtonFormPicker
          value={action.formId ?? null}
          onChange={(formId) => commit({ formId })}
        />
      )}

      {action.type === "external_link" && (
        <Field>
          <FieldLabel>URL de destino</FieldLabel>
          <Input
            value={action.externalUrl ?? ""}
            onChange={(e) => commit({ externalUrl: e.target.value || null })}
            placeholder="https://destino.com.br/proxima-etapa"
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            Os parâmetros <code>leadId</code>, <code>leadToken</code>,{" "}
            <code>email</code>, <code>name</code> e <code>phone</code> serão
            anexados automaticamente.
          </p>
        </Field>
      )}

      {action.type === "add_tag" && (
        <NextButtonTagPicker
          trackingId={trackingId}
          value={action.tagId ?? null}
          onChange={(tagId) => commit({ tagId })}
        />
      )}

      {action.type !== "next_block" && (
        <Field>
          <FieldLabel className="flex items-center justify-between gap-2">
            <span className="text-xs">Repassar dados do lead</span>
            <Switch
              checked={action.passLeadData !== false}
              onCheckedChange={(enabled) => commit({ passLeadData: enabled })}
            />
          </FieldLabel>
          <p className="text-[11px] text-muted-foreground">
            Quando ligado, os dados do lead criado vão pra próxima etapa
            (formulário ou URL externa).
          </p>
        </Field>
      )}
    </Field>
  );
}

function NextButtonFormPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const { forms, isLoading } = useQueryListForms();
  const currentForm = forms.find((f) => f.id === value);

  return (
    <Field>
      <FieldLabel>Formulário a abrir</FieldLabel>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-start text-left font-normal"
          >
            {isLoading
              ? "Carregando..."
              : currentForm?.name || "Selecionar formulário"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-72 max-h-72 overflow-auto"
          align="start"
        >
          <DropdownMenuGroup>
            <DropdownMenuLabel>Formulários disponíveis</DropdownMenuLabel>
            {forms.length === 0 && (
              <div className="px-2 py-2 text-xs text-muted-foreground">
                Nenhum formulário criado.
              </div>
            )}
            {forms.map((f) => (
              <DropdownMenuItem
                key={f.id}
                onClick={() => onChange(f.id)}
                className={value === f.id ? "bg-accent" : ""}
              >
                {f.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {currentForm && (
        <p className="text-[11px] text-muted-foreground mt-1">
          Ao concluir, o usuário será redirecionado para{" "}
          <code>/submit-form/{currentForm.id}</code>.
        </p>
      )}
    </Field>
  );
}

function NextButtonTagPicker({
  trackingId,
  value,
  onChange,
}: {
  trackingId: string;
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const { tags, isLoadingTags } = useQueryTags({
    trackingId: trackingId || "ALL",
  });
  const currentTag = tags.find((t) => t.id === value);

  return (
    <Field>
      <FieldLabel>Tag a aplicar</FieldLabel>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-start text-left font-normal"
          >
            {isLoadingTags
              ? "Carregando..."
              : currentTag?.name || "Selecionar tag"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-72 max-h-72 overflow-auto"
          align="start"
        >
          <DropdownMenuGroup>
            <DropdownMenuLabel>Tags do tracking</DropdownMenuLabel>
            {tags.length === 0 && (
              <div className="px-2 py-2 text-xs text-muted-foreground">
                Nenhuma tag disponível. Crie tags no tracking selecionado.
              </div>
            )}
            {tags.map((t) => (
              <DropdownMenuItem
                key={t.id}
                onClick={() => onChange(t.id)}
                className={value === t.id ? "bg-accent" : ""}
              >
                <span
                  className="inline-block size-2 rounded-full mr-2"
                  style={{
                    background: (t as { color?: string }).color || "#888",
                  }}
                />
                {t.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {!trackingId && (
        <p className="text-[11px] text-amber-500 mt-1">
          Selecione um tracking acima pra ver as tags disponíveis.
        </p>
      )}
    </Field>
  );
}

/**
 * Textarea com suporte a variáveis via "/" — mesmo padrão do ReminderCreateTab.
 */
function WhatsappMessageTextarea({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const {
    open,
    setOpen,
    search,
    setSearch,
    inputRef,
    handleKeyDown,
    handleSelect,
    handleValueChange,
  } = useVariableAutocomplete(value, onChange);

  return (
    <div className="relative">
      <Textarea
        ref={inputRef as any}
        value={value}
        onChange={handleValueChange}
        onKeyDown={handleKeyDown}
        placeholder={
          "📋 *Novo formulário recebido!*\n\n*Nome:* {{nome}}\n*Telefone:* {{phone}}\n*E-mail:* {{email}}"
        }
        rows={5}
        className="resize-none"
      />
      <div className="absolute top-0 left-0">
        <VariablePicker
          open={open}
          onOpenChange={setOpen}
          search={search}
          onSearchChange={setSearch}
          onSelect={handleSelect}
          triggerRef={inputRef}
        />
      </div>
    </div>
  );
}
