import { useEffect, useState } from "react";
import { ChevronDown, Ruler } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBuilderStore } from "@/features/form/context/builder-form-provider";
import { usePrefillFieldValue } from "@/features/form/context/form-prefill-context";
import { useRecordFillValue } from "@/features/form-records/hooks/use-record-fill-store";
import { CURRENCY_UNIT_ID, CUSTOM_UNIT_ID, MEASURE_UNITS } from "@/features/form-records/lib/measure-units";
import {
  buildNumberMeasureValue,
  parseNumberMeasureMeta,
  resolveUnitSymbol,
} from "@/features/form-records/lib/number-measure-value";

// Campo "Número com medida" (spec 0075, RF-1): quantidade com unidade, ou
// valor em reais. O texto digitado vira número só ao sair do campo.

const blockCategory: FormCategoryType = "Field";
const blockType: FormBlockType = "NumberMeasure";

type AttributesType = {
  label: string;
  helperText: string;
  required: boolean;
  unitId: string;
  customUnit: string;
  placeHolder: string;
};

type Instance = FormBlockInstance & { attributes: AttributesType };

export const NumberMeasureBlock: ObjectBlockType = {
  blockType,
  blockCategory,
  createInstance: (id) => ({
    id,
    blockType,
    attributes: {
      label: "Quantidade",
      helperText: "",
      required: false,
      unitId: "un",
      customUnit: "",
      placeHolder: "0",
    } satisfies AttributesType,
  }),
  blockBtnElement: { icon: Ruler, label: "Número com medida" },
  canvasComponent: CanvasView,
  formComponent: FormView,
  propertiesComponent: PropertiesView,
};

function UnitAdornment({ unitId, customUnit }: { unitId: string; customUnit: string }) {
  const symbol = resolveUnitSymbol(unitId, customUnit);
  if (!symbol) return null;
  return <span className="shrink-0 text-sm text-muted-foreground">{symbol}</span>;
}

function CanvasView({ blockInstance }: { blockInstance: FormBlockInstance }) {
  const { label, required, helperText, unitId, customUnit, placeHolder } = (blockInstance as Instance).attributes;
  const isCurrency = unitId === CURRENCY_UNIT_ID;
  return (
    <div className="flex w-full flex-col gap-2">
      {label?.trim() && (
        <Label className="mb-2 whitespace-normal break-words text-base font-normal! leading-snug">
          {label}
          {required && <span className="text-destructive"> *</span>}
        </Label>
      )}
      <div className="pointer-events-none flex items-center gap-2">
        {isCurrency && <UnitAdornment unitId={unitId} customUnit={customUnit} />}
        <Input readOnly placeholder={placeHolder} className="min-w-0" />
        {!isCurrency && <UnitAdornment unitId={unitId} customUnit={customUnit} />}
      </div>
      {helperText && <p className="whitespace-normal break-words text-[0.8rem] text-muted-foreground">{helperText}</p>}
    </div>
  );
}

function FormView({
  blockInstance,
  handleBlur,
  isError: isSubmitError,
}: {
  blockInstance: FormBlockInstance;
  handleBlur?: HandleBlurFunc;
  isError?: boolean;
}) {
  const block = blockInstance as Instance;
  const { label, required, helperText, unitId, customUnit, placeHolder } = block.attributes;
  const isCurrency = unitId === CURRENCY_UNIT_ID;

  const savedAmount = parseNumberMeasureMeta(usePrefillFieldValue(block.id)?.meta)?.amount;
  const [text, setText] = useState(savedAmount === undefined ? "" : savedAmount.toLocaleString("pt-BR"));
  const [isInvalid, setIsInvalid] = useState(false);

  const commit = (rawText: string) => {
    const fieldValue = buildNumberMeasureValue({ rawText, unitId, customUnit });
    setIsInvalid(rawText.trim().length > 0 ? fieldValue.value === "" : required);
    handleBlur?.(block.id, fieldValue);
  };

  // Resposta salva entra no formulário mesmo sem o usuário tocar no campo.
  useEffect(() => {
    if (savedAmount !== undefined) commit(String(savedAmount).replace(".", ","));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dado trazido por uma "Busca no Órbita": vale enquanto o campo estiver vazio.
  const recordFillValue = useRecordFillValue((block.attributes as { fieldKey?: string }).fieldKey);
  useEffect(() => {
    if (recordFillValue === undefined || text.trim().length > 0) return;
    setText(recordFillValue);
    commit(recordFillValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordFillValue]);

  const hasError = isInvalid || isSubmitError;
  return (
    <div className="flex w-full flex-col gap-2">
      {label?.trim() && (
        <Label className={`mb-2 whitespace-normal break-words text-base font-normal! leading-snug ${hasError ? "text-destructive" : ""}`}>
          {label}
          {required && <span className="text-destructive"> *</span>}
        </Label>
      )}
      <div className="flex items-center gap-2">
        {isCurrency && <UnitAdornment unitId={unitId} customUnit={customUnit} />}
        <Input
          inputMode="decimal"
          value={text}
          placeholder={placeHolder}
          onChange={(event) => setText(event.target.value)}
          onBlur={(event) => commit(event.target.value)}
          className={`min-w-0 ${hasError ? "border-destructive!" : ""}`}
        />
        {!isCurrency && <UnitAdornment unitId={unitId} customUnit={customUnit} />}
      </div>
      {isInvalid && text.trim().length > 0 && <p className="text-[0.8rem] text-destructive">Digite só o número. Ex.: 12,5</p>}
      {helperText && <p className="whitespace-normal break-words text-[0.8rem] text-muted-foreground">{helperText}</p>}
    </div>
  );
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

  return (
    <div className="w-full pb-4">
      <div className="mb-[10px] flex h-auto w-full flex-row items-center justify-between gap-1 rounded-md bg-foreground/10 p-1 px-2">
        <span className="text-sm font-medium tracking-wider text-muted-foreground">Número com medida {positionIndex}</span>
        <ChevronDown className="h-4 w-4" />
      </div>
      <div className="w-full space-y-3 px-4">
        <div className="space-y-1">
          <Label className="text-[13px] font-normal">Título</Label>
          <Input value={attributes.label} onChange={(event) => commit({ label: event.target.value })} />
        </div>
        <div className="space-y-1">
          <Label className="text-[13px] font-normal">Medida</Label>
          <Select value={attributes.unitId} onValueChange={(unitId) => commit({ unitId })}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MEASURE_UNITS.map((unit) => (
                <SelectItem key={unit.id} value={unit.id}>
                  {unit.label} ({unit.symbol})
                </SelectItem>
              ))}
              <SelectItem value={CUSTOM_UNIT_ID}>Outra (digitar)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {attributes.unitId === CUSTOM_UNIT_ID && (
          <div className="space-y-1">
            <Label className="text-[13px] font-normal">Nome da medida</Label>
            <Input
              value={attributes.customUnit}
              maxLength={20}
              placeholder="Ex.: demãos, sacos, diárias"
              onChange={(event) => commit({ customUnit: event.target.value })}
            />
          </div>
        )}
        <div className="space-y-1">
          <Label className="text-[13px] font-normal">Nota</Label>
          <Input value={attributes.helperText} onChange={(event) => commit({ helperText: event.target.value })} />
        </div>
        <div className="flex items-center justify-between gap-2">
          <Label className="text-[13px] font-normal">Obrigatório</Label>
          <Switch checked={attributes.required} onCheckedChange={(required) => commit({ required })} />
        </div>
      </div>
    </div>
  );
}
