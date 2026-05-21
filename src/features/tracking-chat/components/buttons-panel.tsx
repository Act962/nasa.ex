"use client";

import { useState } from "react";
import {
  LayoutListIcon,
  XIcon,
  PlusIcon,
  Trash2Icon,
  SendIcon,
  MousePointerClickIcon,
  ChevronDownIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useMutationButtonsMessage } from "../hooks/use-messages";
import { useQueryInstances } from "@/features/tracking-settings/hooks/use-integration";
import { useAiButtonPresets } from "@/features/tracking-settings/hooks/use-ai-button-presets";

interface ButtonsPanelProps {
  onClose: () => void;
  conversationId: string;
  trackingId: string;
  lead: { phone: string | null };
}

type Tab = "buttons" | "list";

interface ButtonItem {
  text: string;
  id: string;
}
interface ListRow {
  id: string;
  title: string;
  description: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function newButton(idx: number): ButtonItem {
  return { text: "", id: `btn_${idx}_${Date.now()}` };
}
function newRow(idx: number): ListRow {
  return { id: `row_${idx}_${Date.now()}`, title: "", description: "" };
}

function parsePresetButtons(raw: unknown): ButtonItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (b): b is Record<string, unknown> => typeof b === "object" && b !== null,
    )
    .map((b, idx) => ({
      text: typeof b.text === "string" ? b.text : "",
      id: typeof b.id === "string" && b.id ? b.id : `btn_${idx}_${Date.now()}`,
    }));
}

// ── Main ─────────────────────────────────────────────────────────────────────

export function ButtonsPanel({
  onClose,
  conversationId,
  trackingId,
  lead,
}: ButtonsPanelProps) {
  const [tab, setTab] = useState<Tab>("buttons");
  const [text, setText] = useState("");
  const [footer, setFooter] = useState("");

  // Buttons
  const [buttons, setButtons] = useState<ButtonItem[]>([newButton(0)]);

  // List
  const [listButtonLabel, setListButtonLabel] = useState("Ver opções");
  const [rows, setRows] = useState<ListRow[]>([newRow(0), newRow(1)]);

  const instance = useQueryInstances(trackingId);
  const mutation = useMutationButtonsMessage({ conversationId });
  const { presets } = useAiButtonPresets(trackingId);
  const activePresets = presets.filter((p) => p.isActive);
  const [selectedPresetId, setSelectedPresetId] = useState<string>("");

  const isDisabled = !instance.instance;
  const canSend = text.trim().length > 0 && !isDisabled;

  const handleLoadPreset = (presetId: string) => {
    const preset = activePresets.find((p) => p.id === presetId);
    if (!preset) return;

    const parsed = parsePresetButtons(preset.buttons);
    const truncated = parsed.slice(0, 3);

    setText((preset.bodyText ?? "").slice(0, 1024));
    setFooter((preset.footerText ?? "").slice(0, 60));
    setButtons(
      truncated.length > 0
        ? truncated.map((b) => ({ ...b, text: b.text.slice(0, 20) }))
        : [newButton(0)],
    );
    setSelectedPresetId(presetId);

    if (parsed.length > truncated.length) {
      toast.warning(
        `Preset tinha ${parsed.length} botões — truncado para 3 (limite da Uazapi).`,
      );
    }
  };

  const handleSendButtons = () => {
    if (!canSend || !lead.phone) return;
    const validButtons = buttons.filter((b) => b.text.trim());
    if (validButtons.length === 0) return;

    mutation.mutate(
      {
        type: "buttons",
        conversationId,
        leadPhone: lead.phone,
        token: instance.instance!.apiKey,
        baseUrl: instance.instance!.baseUrl,
        text: text.trim(),
        footer: footer.trim() || undefined,
        buttons: validButtons.map((b) => ({
          text: b.text.trim().slice(0, 20),
          id: b.id,
        })),
      },
      { onSuccess: onClose },
    );
  };

  const handleSendList = () => {
    if (!canSend || !lead.phone) return;
    const validRows = rows.filter((r) => r.title.trim());
    if (validRows.length === 0) return;

    mutation.mutate(
      {
        type: "list",
        conversationId,
        leadPhone: lead.phone,
        token: instance.instance!.apiKey,
        baseUrl: instance.instance!.baseUrl,
        text: text.trim(),
        footer: footer.trim() || undefined,
        button: listButtonLabel.trim().slice(0, 20) || "Ver opções",
        sections: [
          {
            rows: validRows.map((r) => ({
              id: r.id,
              title: r.title.trim().slice(0, 24),
              description: r.description.trim().slice(0, 72) || undefined,
            })),
          },
        ],
      },
      { onSuccess: onClose },
    );
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div
        className="
          fixed z-50
          w-[90vw] max-w-lg
          bg-background border border-border shadow-2xl flex flex-col overflow-hidden
          bottom-0 left-1/2 -translate-x-1/2 rounded-t-2xl
          lg:bottom-auto lg:top-1/2 lg:-translate-y-1/2 lg:rounded-2xl
        "
        style={{ maxHeight: "85vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b shrink-0">
          <div className="flex items-center gap-2">
            <LayoutListIcon className="size-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Mensagem interativa</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <XIcon className="size-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b shrink-0">
          <button
            onClick={() => setTab("buttons")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors",
              tab === "buttons"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <MousePointerClickIcon className="size-3.5" />
            Botões{" "}
            <span className="text-muted-foreground font-normal">(máx 3)</span>
          </button>
          <button
            onClick={() => setTab("list")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors",
              tab === "list"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <ChevronDownIcon className="size-3.5" />
            Lista{" "}
            <span className="text-muted-foreground font-normal">(máx 10)</span>
          </button>
        </div>

        {/* Corpo */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Preset (só na aba Botões) */}
          {tab === "buttons" && activePresets.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Carregar preset
              </label>
              <Select
                value={selectedPresetId}
                onValueChange={handleLoadPreset}
              >
                <SelectTrigger className="text-sm h-9 w-full">
                  <SelectValue placeholder="Selecione um preset salvo…" />
                </SelectTrigger>
                <SelectContent>
                  {activePresets.map((preset) => (
                    <SelectItem key={preset.id} value={preset.id}>
                      {preset.name || "Sem nome"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Os campos abaixo são preenchidos e você pode editar antes de
                enviar.
              </p>
            </div>
          )}

          {/* Mensagem */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Mensagem *
            </label>
            <Textarea
              placeholder="Digite a mensagem que aparece acima dos botões…"
              className="resize-none text-sm min-h-[80px]"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={tab === "buttons" ? 1024 : 4096}
            />
            <p className="text-[11px] text-muted-foreground text-right">
              {text.length}/{tab === "buttons" ? 1024 : 4096}
            </p>
          </div>

          {/* Rodapé */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Rodapé <span className="font-normal">(opcional)</span>
            </label>
            <Input
              placeholder="Ex: Responda uma das opções"
              className="text-sm h-9"
              value={footer}
              onChange={(e) => setFooter(e.target.value.slice(0, 60))}
            />
          </div>

          {/* ── Botões ── */}
          {tab === "buttons" && (
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Botões
              </label>
              {buttons.map((btn, i) => (
                <div key={btn.id} className="flex gap-2 items-center">
                  <div className="flex-1 relative">
                    <Input
                      placeholder={`Botão ${i + 1} (máx 20 chars)`}
                      className="text-sm h-9 pr-14"
                      value={btn.text}
                      onChange={(e) =>
                        setButtons((prev) =>
                          prev.map((b, idx) =>
                            idx === i
                              ? { ...b, text: e.target.value.slice(0, 20) }
                              : b,
                          ),
                        )
                      }
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                      {btn.text.length}/20
                    </span>
                  </div>
                  {buttons.length > 1 && (
                    <button
                      onClick={() =>
                        setButtons((prev) => prev.filter((_, idx) => idx !== i))
                      }
                      className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2Icon className="size-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {buttons.length < 3 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1.5 w-full"
                  onClick={() =>
                    setButtons((prev) => [...prev, newButton(prev.length)])
                  }
                >
                  <PlusIcon className="size-3.5" />
                  Adicionar botão
                </Button>
              )}
            </div>
          )}

          {/* ── Lista ── */}
          {tab === "list" && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Texto do botão de lista *
                </label>
                <Input
                  placeholder="Ex: Ver opções (máx 20 chars)"
                  className="text-sm h-9"
                  value={listButtonLabel}
                  onChange={(e) =>
                    setListButtonLabel(e.target.value.slice(0, 20))
                  }
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Itens da lista
                </label>
                {rows.map((row, i) => (
                  <div key={row.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground font-medium">
                        Item {i + 1}
                      </span>
                      {rows.length > 1 && (
                        <button
                          onClick={() =>
                            setRows((prev) =>
                              prev.filter((_, idx) => idx !== i),
                            )
                          }
                          className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2Icon className="size-3" />
                        </button>
                      )}
                    </div>
                    <Input
                      placeholder="Título (máx 24 chars) *"
                      className="text-xs h-8"
                      value={row.title}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((r, idx) =>
                            idx === i
                              ? { ...r, title: e.target.value.slice(0, 24) }
                              : r,
                          ),
                        )
                      }
                    />
                    <Input
                      placeholder="Descrição (opcional, máx 72 chars)"
                      className="text-xs h-8"
                      value={row.description}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((r, idx) =>
                            idx === i
                              ? {
                                  ...r,
                                  description: e.target.value.slice(0, 72),
                                }
                              : r,
                          ),
                        )
                      }
                    />
                  </div>
                ))}
                {rows.length < 10 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1.5 w-full"
                    onClick={() =>
                      setRows((prev) => [...prev, newRow(prev.length)])
                    }
                  >
                    <PlusIcon className="size-3.5" />
                    Adicionar item
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t shrink-0">
          {isDisabled && (
            <p className="text-xs text-destructive mb-2">
              Instância WhatsApp não conectada.
            </p>
          )}
          <Button
            className="w-full gap-2"
            disabled={
              !canSend ||
              mutation.isPending ||
              (tab === "buttons" &&
                buttons.filter((b) => b.text.trim()).length === 0) ||
              (tab === "list" &&
                rows.filter((r) => r.title.trim()).length === 0)
            }
            onClick={tab === "buttons" ? handleSendButtons : handleSendList}
          >
            <SendIcon className="size-4" />
            {mutation.isPending ? "Enviando…" : "Enviar mensagem interativa"}
          </Button>
        </div>
      </div>
    </>
  );
}
