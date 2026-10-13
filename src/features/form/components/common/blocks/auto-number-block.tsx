import { useEffect } from "react";
import { ChevronDown, Hash } from "lucide-react";
import {
  FormBlockInstance,
  FormBlockType,
  FormCategoryType,
  HandleBlurFunc,
  ObjectBlockType,
} from "@/features/form/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useBuilderStore } from "@/features/form/context/builder-form-provider";
import { usePrefillFieldValue } from "@/features/form/context/form-prefill-context";
import { AUTO_NUMBER_MAX_DIGITS, formatAutoNumber } from "@/features/form-records/lib/auto-number";

// Bloco "Número automático" (spec 0075, RF-13): número sequencial dado pelo
// servidor ao criar a ficha (O.S., pedido, protocolo). Aqui é só leitura.

const blockCategory: FormCategoryType = "Field";
const blockType: FormBlockType = "AutoNumber";

type AttributesType = {
  label: string;
  helperText: string;
  prefix: string;
  digits: number;
  startAt: number;
  useAsResponseLabel: boolean;
};

type Instance = FormBlockInstance & { attributes: AttributesType };

export const AutoNumberBlock: ObjectBlockType = {
  blockType,
  blockCategory,
  createInstance: (id) => ({
    id,
    blockType,
    attributes: {
      label: "Número",
      helperText: "",
      prefix: "",
      digits: 5,
      startAt: 1,
      useAsResponseLabel: true,
    } satisfies AttributesType,
  }),
  blockBtnElement: { icon: Hash, label: "Número automático" },
  canvasComponent: CanvasView,
  formComponent: FormView,
  propertiesComponent: PropertiesView,
};

function NumberBox({ label, helperText, numberText, isPending }: { label: string; helperText: string; numberText: string; isPending: boolean }) {
  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/40 px-3 py-2">
        <span className="min-w-0 break-words text-base">{label?.trim() || "Número"}</span>
        <span className={`shrink-0 tabular-nums ${isPending ? "text-sm text-muted-foreground" : "text-base font-semibold"}`}>{numberText}</span>
      </div>
      {helperText && <p className="whitespace-normal break-words text-[0.8rem] text-muted-foreground">{helperText}</p>}
    </div>
  );
}

function CanvasView({ blockInstance }: { blockInstance: FormBlockInstance }) {
  const { label, helperText } = (blockInstance as Instance).attributes;
  return <NumberBox label={label} helperText={helperText} numberText={`ex.: ${formatAutoNumber(1, blockInstance.attributes)}`} isPending />;
}

function FormView({ blockInstance, handleBlur }: { blockInstance: FormBlockInstance; handleBlur?: HandleBlurFunc }) {
  const { label, helperText } = (blockInstance as Instance).attributes;
  const saved = usePrefillFieldValue(blockInstance.id);
  const savedNumber = saved?.value?.trim() ?? "";

  // O número salvo volta no envio para a ficha não perder o campo; o servidor confere.
  useEffect(() => {
    if (saved && savedNumber) handleBlur?.(blockInstance.id, saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedNumber]);

  return <NumberBox label={label} helperText={helperText} numberText={savedNumber || "gerado ao salvar"} isPending={!savedNumber} />;
}

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
  const attributes = block.attributes;

  const commit = (partial: Partial<AttributesType>) => {
    if (!parentId) return;
    updateChildBlock(parentId, block.id, { ...block, attributes: { ...attributes, ...partial } });
  };
  const toPositiveInteger = (text: string, fallback: number) => {
    const parsed = Number.parseInt(text, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };

  return (
    <div className="w-full pb-4">
      <div className="mb-[10px] flex h-auto w-full flex-row items-center justify-between gap-1 rounded-md bg-foreground/10 p-1 px-2">
        <span className="text-sm font-medium tracking-wider text-muted-foreground">Número automático {positionIndex}</span>
        <ChevronDown className="h-4 w-4" />
      </div>
      <div className="w-full space-y-3 px-4">
        <div className="space-y-1">
          <Label className="text-[13px] font-normal">Título</Label>
          <Input value={attributes.label} onChange={(event) => commit({ label: event.target.value })} />
        </div>
        <div className="space-y-1">
          <Label className="text-[13px] font-normal">Prefixo (opcional)</Label>
          <Input value={attributes.prefix ?? ""} maxLength={12} placeholder="Ex.: OS-" onChange={(event) => commit({ prefix: event.target.value })} />
        </div>
        <div className="flex gap-2">
          <div className="flex-1 space-y-1">
            <Label className="text-[13px] font-normal">Começar em</Label>
            <Input
              inputMode="numeric"
              value={String(attributes.startAt ?? 1)}
              onChange={(event) => commit({ startAt: toPositiveInteger(event.target.value, 1) })}
            />
          </div>
          <div className="flex-1 space-y-1">
            <Label className="text-[13px] font-normal">Nº de dígitos</Label>
            <Input
              inputMode="numeric"
              value={String(attributes.digits ?? 5)}
              onChange={(event) => commit({ digits: Math.min(AUTO_NUMBER_MAX_DIGITS, toPositiveInteger(event.target.value, 5)) })}
            />
          </div>
        </div>
        <p className="text-[11px] leading-tight text-muted-foreground">
          Próximo número de exemplo: {formatAutoNumber(1, attributes)}. O número é dado quando a ficha é salva pela primeira
          vez e não muda depois. Fichas apagadas não devolvem o número.
        </p>
        <div className="flex items-center justify-between gap-2">
          <Label className="text-[13px] font-normal">Usar como título da ficha</Label>
          <Switch checked={attributes.useAsResponseLabel !== false} onCheckedChange={(useAsResponseLabel) => commit({ useAsResponseLabel })} />
        </div>
        <div className="space-y-1">
          <Label className="text-[13px] font-normal">Nota</Label>
          <Input value={attributes.helperText} onChange={(event) => commit({ helperText: event.target.value })} />
        </div>
      </div>
    </div>
  );
}
