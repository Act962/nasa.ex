"use client";

import { useEffect, useState } from "react";
import {
  ChevronDown,
  Plus,
  QrCode as QrCodeIcon,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { QRCodeSVG } from "qrcode.react";
import {
  FormBlockInstance,
  FormBlockType,
  FormCategoryType,
  ObjectBlockType,
} from "@/features/form/types";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useBuilderStore } from "@/features/form/context/builder-form-provider";
import { useFormLeadContext } from "@/features/form/context/form-lead-context";
import { FormSettings } from "@/generated/prisma/client";
import type { FormSettingsTyped } from "@/features/form/types";
import { getContrastColor } from "@/utils/get-contrast-color";

/**
 * QrCodeMulti — bloco que mostra um QR Code "vivo" com dropdown pra
 * trocar entre múltiplos QRs configurados no builder. Cada item tem:
 *   - title: texto exibido acima do QR
 *   - source: "url" | "client-link" | "form-edit-link"
 *   - url: usado quando source = "url"
 *
 * As fontes de link automáticas (`client-link` / `form-edit-link`)
 * resolvem em runtime usando o `FormLeadContext` da página atual:
 *   - client-link → `${origin}/lead/<publicToken>`
 *   - form-edit-link → `${origin}/formulario/novo/<formId>/<leadId>`
 *
 * Quando o contexto não está disponível (ex: form público sem lead
 * vinculado ainda), os QRs automáticos mostram um placeholder.
 *
 * Categoria: Layout (decorativo). Não conta na barra de progresso e
 * não captura input.
 */

// Categoria "Field" pra aparecer no painel "Fields" do builder, mas
// adicionado ao deny-list de `isFillableBlock` — é decorativo, não
// captura input nem entra no cálculo de progresso.
const blockCategory: FormCategoryType = "Field";
const blockType: FormBlockType = "QrCodeMulti";

type QrSource = "url" | "client-link" | "form-edit-link";

type QrItem = {
  id: string;
  title: string;
  source: QrSource;
  url?: string;
};

type AttributesType = {
  helperText: string;
  size: number;
  items: QrItem[];
};

const propertiesValidateSchema = z.object({
  helperText: z.string().trim().max(255).optional(),
  size: z.number().int().min(96).max(360).default(180).optional(),
});
type PropertiesType = z.input<typeof propertiesValidateSchema>;

export const QrCodeMultiBlock: ObjectBlockType = {
  blockType,
  blockCategory,
  createInstance: (id) => ({
    id,
    blockType,
    attributes: {
      helperText: "",
      size: 180,
      items: [
        {
          id: `qr-${uuidv4()}`,
          title: "Acompanhamento do cliente",
          source: "client-link",
        },
      ],
    } satisfies AttributesType,
  }),
  blockBtnElement: { icon: QrCodeIcon, label: "QR Code" },
  canvasComponent: QrCodeMultiView,
  formComponent: QrCodeMultiView,
  propertiesComponent: PropertiesView,
};

type Instance = FormBlockInstance & { attributes: AttributesType };

// ─── Resolução de URL por source ────────────────────────────────────────
function resolveUrl(
  item: QrItem,
  ctx: ReturnType<typeof useFormLeadContext>,
): { url: string | null; reason?: string } {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  if (item.source === "url") {
    if (!item.url || item.url.trim().length === 0) {
      return { url: null, reason: "URL não configurada" };
    }
    return { url: item.url };
  }
  if (item.source === "client-link") {
    if (!ctx.leadPublicToken) {
      return {
        url: null,
        reason: "Disponível após gerar o link do cliente do lead",
      };
    }
    return { url: `${origin}/lead/${ctx.leadPublicToken}` };
  }
  if (item.source === "form-edit-link") {
    if (!ctx.leadId || !ctx.formId) {
      return {
        url: null,
        reason: "Disponível em modo edição (lead + form definidos)",
      };
    }
    return {
      url: `${origin}/formulario/novo/${ctx.formId}/${ctx.leadId}`,
    };
  }
  return { url: null };
}

// ─── View (canvas + form) ───────────────────────────────────────────────
function QrCodeMultiView({
  blockInstance,
  settings,
}: {
  blockInstance: FormBlockInstance;
  settings?: FormSettings | FormSettingsTyped | null;
}) {
  const block = blockInstance as Instance;
  const { items, helperText, size } = block.attributes;
  const ctx = useFormLeadContext();

  // Item ativo do dropdown — começa no primeiro.
  const [activeId, setActiveId] = useState<string>(items[0]?.id ?? "");
  // Sincroniza com mudanças de items (canvas: builder edita itens).
  useEffect(() => {
    if (!items.find((i) => i.id === activeId)) {
      setActiveId(items[0]?.id ?? "");
    }
  }, [items, activeId]);

  const active = items.find((i) => i.id === activeId) ?? items[0];
  const { url, reason } = active
    ? resolveUrl(active, ctx)
    : { url: null, reason: "Nenhum QR configurado" };

  // Cor do texto adaptativa ao fundo do form.
  const textColor = settings?.backgroundColor
    ? getContrastColor(settings.backgroundColor)
    : undefined;

  if (!active) {
    return (
      <div className="flex flex-col items-center gap-2 py-4">
        <p
          className="text-xs"
          style={{ color: textColor ? `${textColor}99` : undefined, opacity: 0.7 }}
        >
          Nenhum QR Code configurado
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 py-2 w-full">
      {/* Título acima do QR */}
      <h3
        className="text-sm font-semibold text-center break-words max-w-full px-2"
        style={{ color: textColor || undefined }}
      >
        {active.title || "QR Code"}
      </h3>

      {/* QR Code (centro) */}
      <div
        className="bg-white p-3 rounded-md border"
        style={{
          width: size + 24,
          height: size + 24,
          borderColor: textColor ? `${textColor}26` : undefined,
        }}
      >
        {url ? (
          <QRCodeSVG
            value={url}
            size={size}
            level="M"
            marginSize={0}
            style={{ width: size, height: size }}
          />
        ) : (
          <div
            className="flex flex-col items-center justify-center text-center px-2"
            style={{ width: size, height: size }}
          >
            <QrCodeIcon className="size-8 text-muted-foreground/40 mb-2" />
            <p className="text-[11px] text-muted-foreground leading-tight">
              {reason}
            </p>
          </div>
        )}
      </div>

      {/* Dropdown abaixo (só aparece com 2+ itens) — largura igual à do
          QR Code (size + 24, mesmo do box do QR acima) e altura compacta
          (h-7 text-xs) consistente com os campos do painel Propriedades. */}
      {items.length > 1 && (
        <div style={{ width: size + 24 }}>
          <Select value={activeId} onValueChange={setActiveId}>
            <SelectTrigger
              className="w-full h-7 text-xs bg-transparent!"
              style={{
                color: textColor || undefined,
                borderColor: textColor ? `${textColor}40` : undefined,
              }}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {items.map((it) => (
                <SelectItem key={it.id} value={it.id} className="text-xs">
                  {it.title || "Sem título"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Atalho "abrir link" abaixo (em modo form view, útil pra testar) */}
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] inline-flex items-center gap-1 hover:underline"
          style={{
            color: textColor ? `${textColor}99` : undefined,
            opacity: textColor ? undefined : 0.7,
          }}
        >
          <ExternalLink className="size-3" />
          Abrir link
        </a>
      )}

      {helperText && (
        <p
          className="text-[11px] text-center break-words whitespace-normal max-w-full px-2"
          style={{
            color: textColor ? `${textColor}99` : undefined,
            opacity: textColor ? undefined : 0.7,
          }}
        >
          {helperText}
        </p>
      )}
    </div>
  );
}

// ─── Properties (sidebar do builder) ────────────────────────────────────
function PropertiesView({
  positionIndex,
  parentId,
  blockInstance,
}: {
  positionIndex?: number;
  parentId?: string;
  blockInstance: FormBlockInstance;
}) {
  const block = blockInstance as Instance;
  const { updateChildBlock } = useBuilderStore();

  const form = useForm<PropertiesType>({
    resolver: zodResolver(propertiesValidateSchema),
    mode: "onBlur",
    defaultValues: {
      helperText: block.attributes.helperText,
      size: block.attributes.size,
    },
  });

  useEffect(
    () =>
      form.reset({
        helperText: block.attributes.helperText,
        size: block.attributes.size,
      }),
    [block.attributes, form],
  );

  function commit(partial: Partial<AttributesType>) {
    if (!parentId) return;
    updateChildBlock(parentId, block.id, {
      ...block,
      attributes: { ...block.attributes, ...partial },
    });
  }

  function addItem() {
    commit({
      items: [
        ...block.attributes.items,
        {
          id: `qr-${uuidv4()}`,
          title: `QR ${block.attributes.items.length + 1}`,
          source: "url",
          url: "",
        },
      ],
    });
  }
  function updateItem(idx: number, patch: Partial<QrItem>) {
    const next = block.attributes.items.map((it, i) =>
      i === idx ? { ...it, ...patch } : it,
    );
    commit({ items: next });
  }
  function removeItem(idx: number) {
    if (block.attributes.items.length <= 1) return;
    commit({ items: block.attributes.items.filter((_, i) => i !== idx) });
  }

  return (
    <div className="w-full pb-4">
      <div className="w-full flex flex-row items-center justify-between gap-1 bg-foreground/10 rounded-md h-auto p-1 px-2 mb-[10px]">
        <span className="text-sm font-medium text-muted-foreground tracking-wider">
          QR Codes {positionIndex}
        </span>
        <ChevronDown className="w-4 h-4" />
      </div>

      <Form {...form}>
        <form
          onSubmit={(e) => e.preventDefault()}
          className="w-full space-y-3 px-4"
        >
          <FormField
            control={form.control}
            name="helperText"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[13px] font-normal">
                  Nota (opcional)
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    onChange={(e) => {
                      field.onChange(e);
                      commit({ helperText: e.target.value });
                    }}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="size"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[13px] font-normal">
                  Tamanho do QR (px)
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={96}
                    max={360}
                    step={8}
                    value={field.value ?? 180}
                    onChange={(e) => {
                      const v = Math.max(
                        96,
                        Math.min(360, Number(e.target.value) || 180),
                      );
                      field.onChange(v);
                      commit({ size: v });
                    }}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </form>
      </Form>

      {/* Lista de itens (cada QR) */}
      <div className="px-4 mt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[13px] font-medium">Itens</span>
          <Button type="button" size="sm" variant="outline" onClick={addItem}>
            <Plus className="w-3.5 h-3.5" />
            QR Code
          </Button>
        </div>

        <div className="flex flex-col gap-3">
          {block.attributes.items.map((it, idx) => (
            <div
              key={it.id}
              className="rounded-md border border-foreground/10 bg-foreground/[0.02] p-2 space-y-2"
            >
              <div className="flex items-center gap-2">
                <Label className="text-[11px] text-muted-foreground shrink-0 w-12">
                  Título
                </Label>
                <Input
                  value={it.title}
                  onChange={(e) => updateItem(idx, { title: e.target.value })}
                  placeholder="Acompanhamento do cliente"
                  className="h-7 text-xs"
                />
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => removeItem(idx)}
                  disabled={block.attributes.items.length <= 1}
                  title="Remover QR"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Label className="text-[11px] text-muted-foreground shrink-0 w-12">
                  Origem
                </Label>
                <Select
                  value={it.source}
                  onValueChange={(v) =>
                    updateItem(idx, { source: v as QrSource })
                  }
                >
                  <SelectTrigger className="h-7 text-xs flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="url" className="text-xs">
                      URL personalizada
                    </SelectItem>
                    <SelectItem value="client-link" className="text-xs">
                      Link do cliente (/lead/&lt;token&gt;)
                    </SelectItem>
                    <SelectItem value="form-edit-link" className="text-xs">
                      Link de edição do formulário
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {it.source === "url" && (
                <div className="flex items-center gap-2">
                  <Label className="text-[11px] text-muted-foreground shrink-0 w-12">
                    URL
                  </Label>
                  <Input
                    value={it.url ?? ""}
                    onChange={(e) => updateItem(idx, { url: e.target.value })}
                    placeholder="https://exemplo.com/..."
                    className="h-7 text-xs"
                  />
                </div>
              )}

              {it.source !== "url" && (
                <p className="text-[11px] text-muted-foreground pl-14">
                  Resolvido automaticamente em runtime — exige o lead do
                  formulário estar definido (modo edição interno).
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
