"use client";

/**
 * Dropdown que lista as sections do layout atual com `anchorId` definido.
 * Substitui o input livre `#id-da-section` que o user precisava digitar
 * manualmente.
 *
 * Comportamento:
 *   - Lista cada section com nome amigável (`getElementDisplayName`) +
 *     ícone + valor da âncora (`#planos`, `#faq`, …).
 *   - Filtra fora elements que NÃO têm `anchorId` — esses primeiro
 *     precisam ter âncora definida no próprio properties-panel.
 *   - Sempre traz um item "↑ Topo da página" (`#top`) e "Custom…"
 *     pra digitar manualmente (URL externa ou âncora de outra page).
 *   - Quando o user escolhe uma section, salva `href = "#<anchorId>"`.
 *
 * Pra evitar prop drilling, lê o layout direto do store. Funciona
 * dentro de qualquer properties-panel sem precisar receber props extras.
 */
import { useState } from "react";
import {
  Link2, ChevronDown, AlertCircle, Pencil,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  usePagesBuilderStore,
  getActiveLayerElements,
} from "../../context/pages-builder-store";
import {
  getElementDisplayName,
  getElementIcon,
} from "../../lib/layer-utils";
import type { ElementBase, ElementType } from "../../types";

interface Props {
  /** Valor atual (ex: "#planos" ou ""). */
  value: string;
  /** Recebe o novo href (com ou sem `#`). */
  onChange: (next: string) => void;
  /** Permite digitar URL externa também. Default true. */
  allowCustom?: boolean;
  placeholder?: string;
  /** Auto-foco no modo custom quando o usuário decide digitar. */
  autoFocusOnCustom?: boolean;
}

interface AnchorOption {
  anchorId: string;
  label: string;
  iconType: ElementType;
}

function useLayoutAnchors(): AnchorOption[] {
  const layout = usePagesBuilderStore((s) => s.layout);
  const activeLayer = usePagesBuilderStore((s) => s.activeLayer);
  const elements = getActiveLayerElements(layout, activeLayer);
  return elements
    .filter((el) => {
      const anchor = (el.anchorId as string | undefined) ?? "";
      return anchor.trim().length > 0;
    })
    .map((el) => ({
      anchorId: (el.anchorId as string).trim(),
      label: getElementDisplayName(el),
      iconType: el.type as ElementType,
    }));
}

/**
 * Decide o modo do picker baseado no valor atual:
 *   - vazio ou "#xxx" que MATCHA uma anchor existente → modo "select"
 *   - qualquer outra coisa → modo "custom" (input livre)
 */
function inferMode(value: string, anchors: AnchorOption[]): "select" | "custom" {
  if (!value) return "select";
  if (!value.startsWith("#")) return "custom";
  const anchorId = value.slice(1);
  const matches = anchors.some((a) => a.anchorId === anchorId);
  return matches ? "select" : "custom";
}

export function AnchorPicker({
  value,
  onChange,
  allowCustom = true,
  placeholder = "Escolha uma section…",
  autoFocusOnCustom,
}: Props) {
  const anchors = useLayoutAnchors();
  const inferred = inferMode(value, anchors);
  const [mode, setMode] = useState<"select" | "custom">(inferred);

  const noAnchors = anchors.length === 0;

  if (mode === "custom") {
    return (
      <div className="flex flex-col gap-1">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="text-xs font-mono"
          autoFocus={autoFocusOnCustom}
        />
        {allowCustom && (
          <button
            type="button"
            onClick={() => setMode("select")}
            className="text-[10px] text-indigo-600 hover:underline flex items-center gap-1 self-start"
          >
            <ChevronDown className="size-3" /> Escolher da lista de camadas
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="relative">
        <select
          value={value && value.startsWith("#") ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-full rounded border bg-background text-[11px] pl-7 pr-2"
        >
          <option value="">{noAnchors ? "Nenhuma camada com âncora…" : placeholder}</option>
          <option value="#top">↑ Topo da página</option>
          {anchors.length > 0 && (
            <optgroup label="Camadas com âncora">
              {anchors.map((anchor) => (
                <option key={anchor.anchorId} value={`#${anchor.anchorId}`}>
                  {anchor.label} (#{anchor.anchorId})
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <Link2 className="size-3.5 text-muted-foreground absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>

      {noAnchors && (
        <p className="text-[10px] text-amber-700 flex items-start gap-1 leading-snug">
          <AlertCircle className="size-3 shrink-0 mt-0.5" />
          Nenhuma section tem âncora ainda. Selecione uma section no canvas e
          defina &quot;ID da âncora&quot; no painel direito pra ela aparecer aqui.
        </p>
      )}

      {allowCustom && (
        <button
          type="button"
          onClick={() => setMode("custom")}
          className="text-[10px] text-indigo-600 hover:underline flex items-center gap-1 self-start"
        >
          <Pencil className="size-3" /> Digitar URL/âncora manualmente
        </button>
      )}
    </div>
  );
}

/**
 * Variante "label + picker" pra usar diretamente nos editors sem
 * precisar lembrar de envolver tudo num `<div>`.
 */
export function AnchorPickerField(
  props: Props & { label: string; hint?: string },
) {
  const { label, hint, ...rest } = props;
  return (
    <div className="mt-1.5">
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <AnchorPicker {...rest} />
      {hint && (
        <p className="text-[10px] text-muted-foreground/80 mt-0.5 leading-snug">
          {hint}
        </p>
      )}
    </div>
  );
}

/** Re-export pra uso fora do properties-panel se necessário. */
export { useLayoutAnchors };
export type { AnchorOption };

/** Útil pra mostrar ícone da section selecionada (não usado no
 *  picker, mas exposto pra outros editors). */
export function getAnchorIcon(type: ElementType) {
  return getElementIcon(type);
}

/** Pega o display name de um element (proxy do layer-utils). */
export function describeElement(el: ElementBase) {
  return getElementDisplayName(el);
}
