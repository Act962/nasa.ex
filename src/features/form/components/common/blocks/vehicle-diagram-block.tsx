import { useEffect, useState } from "react";
import { CarFront, ChevronDown, Trash2 } from "lucide-react";
import {
  FormBlockInstance,
  FormBlockType,
  FormCategoryType,
  HandleBlurFunc,
  ObjectBlockType,
} from "@/features/form/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useBuilderStore } from "@/features/form/context/builder-form-provider";
import { usePrefillFieldValue } from "@/features/form/context/form-prefill-context";
import { VEHICLE_ART_CREDIT } from "@/features/form-records/lib/vehicle-diagram-art";
import {
  DEFAULT_VEHICLE_TYPE,
  buildVehicleDiagram,
  buildVehicleDiagramValue,
  parseVehicleDiagramMeta,
  type SelectedVehiclePart,
} from "@/features/form-records/lib/vehicle-diagrams";

// Bloco "Diagrama do veículo" (spec 0075, RF-12): imagem do veículo com áreas
// clicáveis por cima; tocar numa peça a pinta de vermelho e abre o campo do
// ponto de observação dela.

const blockCategory: FormCategoryType = "Field";
const blockType: FormBlockType = "VehicleDiagram";

type AttributesType = {
  label: string;
  helperText: string;
  required: boolean;
};

type Instance = FormBlockInstance & { attributes: AttributesType };

export const VehicleDiagramBlock: ObjectBlockType = {
  blockType,
  blockCategory,
  createInstance: (id) => ({
    id,
    blockType,
    attributes: {
      label: "Peças do veículo",
      helperText: "Toque na peça para marcar. Toque de novo para desmarcar.",
      required: false,
    } satisfies AttributesType,
  }),
  blockBtnElement: { icon: CarFront, label: "Diagrama do veículo" },
  canvasComponent: CanvasView,
  formComponent: FormView,
  propertiesComponent: PropertiesView,
};

function DiagramDrawing({
  selectedPartIds,
  onTogglePart,
}: {
  selectedPartIds: ReadonlySet<string>;
  onTogglePart?: (partId: string) => void;
}) {
  const diagram = buildVehicleDiagram();
  return (
    <div className="w-full">
      {/* Fundo claro fixo: a arte é traço escuro sobre branco. */}
      <div className="w-full overflow-hidden rounded-md border bg-white p-2">
        <svg
          viewBox={`0 0 ${diagram.width} ${diagram.height}`}
          className="block h-auto w-full"
          role="group"
          aria-label="Diagrama do veículo"
        >
          <image
            href={diagram.imageUrl}
            width={diagram.width}
            height={diagram.height}
          />
          {diagram.parts.map((part) => {
            const isSelected = selectedPartIds.has(part.id);
            return (
              <g
                key={part.id}
                role="checkbox"
                aria-checked={isSelected}
                aria-label={part.label}
                tabIndex={onTogglePart ? 0 : -1}
                className={
                  onTogglePart ? "group cursor-pointer outline-none" : undefined
                }
                onClick={() => onTogglePart?.(part.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onTogglePart?.(part.id);
                  }
                }}
              >
                <title>{part.label}</title>
                {part.polygons.map((polygon) => (
                  <polygon
                    key={polygon}
                    points={polygon}
                    fill="#ef4444"
                    fillOpacity={isSelected ? 0.55 : 0}
                    stroke="#b91c1c"
                    strokeOpacity={isSelected ? 1 : 0}
                    strokeWidth={1.5}
                    strokeLinejoin="round"
                    className={
                      isSelected
                        ? undefined
                        : "group-hover:fill-opacity-20 group-focus-visible:stroke-opacity-100"
                    }
                  />
                ))}
              </g>
            );
          })}
        </svg>
      </div>
      {/* Texto, não link: o bloco aparece dentro de cartões que já são links. */}
      <p className="mt-1 text-right text-[10px] text-muted-foreground">
        {VEHICLE_ART_CREDIT.label}
      </p>
    </div>
  );
}

function BlockLabel({
  label,
  required,
  hasError,
}: {
  label: string;
  required: boolean;
  hasError?: boolean;
}) {
  if (!label?.trim()) return null;
  return (
    <Label
      className={`mb-2 whitespace-normal break-words text-base font-normal! leading-snug ${hasError ? "text-destructive" : ""}`}
    >
      {label}
      {required && <span className="text-destructive"> *</span>}
    </Label>
  );
}

function CanvasView({ blockInstance }: { blockInstance: FormBlockInstance }) {
  const { label, required, helperText } = (blockInstance as Instance)
    .attributes;
  return (
    <div className="flex w-full flex-col gap-2">
      <BlockLabel label={label} required={required} />
      <div className="pointer-events-none">
        <DiagramDrawing selectedPartIds={new Set()} />
      </div>
      {helperText && (
        <p className="whitespace-normal break-words text-[0.8rem] text-muted-foreground">
          {helperText}
        </p>
      )}
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
  const { label, required, helperText } = block.attributes;
  const saved = parseVehicleDiagramMeta(usePrefillFieldValue(block.id)?.meta);
  const [selectedParts, setSelectedParts] = useState<SelectedVehiclePart[]>(
    saved?.parts ?? [],
  );

  const publish = (nextParts: SelectedVehiclePart[]) => {
    setSelectedParts(nextParts);
    handleBlur?.(
      block.id,
      buildVehicleDiagramValue(DEFAULT_VEHICLE_TYPE, nextParts),
    );
  };

  // Resposta salva entra no formulário mesmo sem o usuário tocar em nada.
  useEffect(() => {
    if (saved && saved.parts.length > 0)
      handleBlur?.(
        block.id,
        buildVehicleDiagramValue(DEFAULT_VEHICLE_TYPE, saved.parts),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePart = (partId: string) => {
    if (selectedParts.some((part) => part.partId === partId)) {
      publish(selectedParts.filter((part) => part.partId !== partId));
      return;
    }
    const diagramPart = buildVehicleDiagram().parts.find(
      (part) => part.id === partId,
    );
    if (diagramPart)
      publish([
        ...selectedParts,
        { partId, label: diagramPart.label, note: "" },
      ]);
  };

  const updateNote = (partId: string, note: string, shouldPublish: boolean) => {
    const nextParts = selectedParts.map((part) =>
      part.partId === partId ? { ...part, note } : part,
    );
    if (shouldPublish) publish(nextParts);
    else setSelectedParts(nextParts);
  };

  return (
    <div className="flex w-full flex-col gap-2">
      <BlockLabel label={label} required={required} hasError={isSubmitError} />
      <DiagramDrawing
        selectedPartIds={new Set(selectedParts.map((part) => part.partId))}
        onTogglePart={togglePart}
      />
      {helperText && (
        <p className="whitespace-normal break-words text-[0.8rem] text-muted-foreground">
          {helperText}
        </p>
      )}
      {selectedParts.length > 0 && (
        <ul className="space-y-2">
          {selectedParts.map((part) => (
            <li key={part.partId} className="rounded-[16px] border bg-card p-3">
              <div className="flex items-center gap-2">
                <span className="size-3 shrink-0 rounded-sm bg-destructive" aria-hidden />
                <span className="min-w-0 flex-1 break-words text-sm font-medium">{part.label}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  data-record-stepper
                  aria-label={`Desmarcar ${part.label}`}
                  onClick={() => togglePart(part.partId)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <Textarea
                value={part.note}
                maxLength={120}
                rows={2}
                placeholder="Ponto de observação (opcional)"
                aria-label={`Ponto de observação de ${part.label}`}
                onChange={(event) => updateNote(part.partId, event.target.value, false)}
                onBlur={(event) => updateNote(part.partId, event.target.value.trim(), true)}
                className="mt-2 min-h-[3.25rem] w-full resize-none"
              />
            </li>
          ))}
        </ul>
      )}
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
    updateChildBlock(parentId, block.id, {
      ...block,
      attributes: { ...attributes, ...partial },
    });
  };

  return (
    <div className="w-full pb-4">
      <div className="mb-[10px] flex h-auto w-full flex-row items-center justify-between gap-1 rounded-md bg-foreground/10 p-1 px-2">
        <span className="text-sm font-medium tracking-wider text-muted-foreground">
          Diagrama do veículo {positionIndex}
        </span>
        <ChevronDown className="h-4 w-4" />
      </div>
      <div className="w-full space-y-3 px-4">
        <div className="space-y-1">
          <Label className="text-[13px] font-normal">Título</Label>
          <Input
            value={attributes.label}
            onChange={(event) => commit({ label: event.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[13px] font-normal">Nota</Label>
          <Input
            value={attributes.helperText}
            onChange={(event) => commit({ helperText: event.target.value })}
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <Label className="text-[13px] font-normal">Obrigatório</Label>
          <Switch
            checked={attributes.required === true}
            onCheckedChange={(required) => commit({ required })}
          />
        </div>
      </div>
    </div>
  );
}
