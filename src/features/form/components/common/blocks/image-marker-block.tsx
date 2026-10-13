import { useEffect, useState, type MouseEvent } from "react";
import { ChevronDown, MapPin, Trash2 } from "lucide-react";
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
import { Uploader } from "@/components/file-uploader/uploader";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { useBuilderStore } from "@/features/form/context/builder-form-provider";
import { usePrefillFieldValue } from "@/features/form/context/form-prefill-context";
import {
  MAX_IMAGE_MARKERS,
  buildImageMarkersValue,
  parseImageMarkers,
  type ImageMarker,
} from "@/features/form-records/lib/image-markers-value";

// Bloco "Marcar na imagem" (spec 0075, RF-4): o construtor sobe uma imagem
// qualquer e quem preenche toca para pôr marcadores numerados.

const blockCategory: FormCategoryType = "Field";
const blockType: FormBlockType = "ImageMarker";

type AttributesType = {
  label: string;
  helperText: string;
  required: boolean;
  imageUrl: string;
  /** Pergunta uma legenda para cada marcador (ex.: nome da peça). */
  askNote: boolean;
};

type Instance = FormBlockInstance & { attributes: AttributesType };

export const ImageMarkerBlock: ObjectBlockType = {
  blockType,
  blockCategory,
  createInstance: (id) => ({
    id,
    blockType,
    attributes: {
      label: "Marque na imagem",
      helperText: "Toque na imagem para marcar. Toque num marcador para remover.",
      required: false,
      imageUrl: "",
      askNote: true,
    } satisfies AttributesType,
  }),
  blockBtnElement: { icon: MapPin, label: "Marcar na imagem" },
  canvasComponent: CanvasView,
  formComponent: FormView,
  propertiesComponent: PropertiesView,
};

function MarkedImage({
  imageUrl,
  markers,
  onImageClick,
  onMarkerClick,
}: {
  imageUrl: string;
  markers: ImageMarker[];
  onImageClick?: (xPercent: number, yPercent: number) => void;
  onMarkerClick?: (markerId: string) => void;
}) {
  const resolvedUrl = useConstructUrl(imageUrl);
  if (!imageUrl) {
    return (
      <div className="flex min-h-32 w-full items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        <MapPin className="mr-2 size-5" />
        Envie a imagem nas propriedades deste campo
      </div>
    );
  }

  const handleImageClick = (event: MouseEvent<HTMLButtonElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    onImageClick?.(((event.clientX - bounds.left) / bounds.width) * 100, ((event.clientY - bounds.top) / bounds.height) * 100);
  };

  return (
    <div className="relative w-full overflow-hidden rounded-md border">
      {/* `button` de propósito: no modo leitura o CSS da página desliga botões, e o toque deixa de marcar. */}
      <button type="button" aria-label="Marcar um ponto na imagem" onClick={handleImageClick} className="block w-full cursor-crosshair">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={resolvedUrl} alt="" draggable={false} className="block h-auto w-full select-none" />
      </button>
      {markers.map((marker, index) => (
        <button
          key={marker.id}
          type="button"
          aria-label={`Remover marcação ${index + 1}${marker.note ? `: ${marker.note}` : ""}`}
          onClick={() => onMarkerClick?.(marker.id)}
          style={{ left: `${marker.xPercent}%`, top: `${marker.yPercent}%` }}
          className="absolute flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-background bg-destructive text-[11px] font-semibold text-destructive-foreground shadow"
        >
          {index + 1}
        </button>
      ))}
    </div>
  );
}

function BlockLabel({ label, required, hasError }: { label: string; required: boolean; hasError?: boolean }) {
  if (!label?.trim()) return null;
  return (
    <Label className={`mb-2 whitespace-normal break-words text-base font-normal! leading-snug ${hasError ? "text-destructive" : ""}`}>
      {label}
      {required && <span className="text-destructive"> *</span>}
    </Label>
  );
}

function CanvasView({ blockInstance }: { blockInstance: FormBlockInstance }) {
  const { label, required, helperText, imageUrl } = (blockInstance as Instance).attributes;
  return (
    <div className="flex w-full flex-col gap-2">
      <BlockLabel label={label} required={required} />
      <div className="pointer-events-none">
        <MarkedImage imageUrl={imageUrl} markers={[]} />
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
  const { label, required, helperText, imageUrl, askNote } = block.attributes;
  const savedMarkers = parseImageMarkers(usePrefillFieldValue(block.id)?.meta);
  const [markers, setMarkers] = useState<ImageMarker[]>(savedMarkers);

  const publish = (nextMarkers: ImageMarker[]) => {
    setMarkers(nextMarkers);
    handleBlur?.(block.id, buildImageMarkersValue(nextMarkers));
  };

  // Resposta salva entra no formulário mesmo sem o usuário tocar em nada.
  useEffect(() => {
    if (savedMarkers.length > 0) handleBlur?.(block.id, buildImageMarkersValue(savedMarkers));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addMarker = (xPercent: number, yPercent: number) => {
    if (markers.length >= MAX_IMAGE_MARKERS) return;
    publish([...markers, { id: crypto.randomUUID(), xPercent: Math.round(xPercent * 100) / 100, yPercent: Math.round(yPercent * 100) / 100, note: "" }]);
  };
  const updateNote = (markerId: string, note: string, shouldPublish: boolean) => {
    const nextMarkers = markers.map((marker) => (marker.id === markerId ? { ...marker, note } : marker));
    if (shouldPublish) publish(nextMarkers);
    else setMarkers(nextMarkers);
  };

  return (
    <div className="flex w-full flex-col gap-2">
      <BlockLabel label={label} required={required} hasError={isSubmitError} />
      <MarkedImage
        imageUrl={imageUrl}
        markers={markers}
        onImageClick={addMarker}
        onMarkerClick={(markerId) => publish(markers.filter((marker) => marker.id !== markerId))}
      />
      {markers.length > 0 && (
        <ol className="space-y-1">
          {markers.map((marker, index) => (
            <li key={marker.id} className="flex items-center gap-2">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-destructive text-[11px] font-semibold text-destructive-foreground">
                {index + 1}
              </span>
              {askNote ? (
                <Input
                  value={marker.note}
                  maxLength={80}
                  placeholder="O que é esta marcação?"
                  aria-label={`Legenda da marcação ${index + 1}`}
                  onChange={(event) => updateNote(marker.id, event.target.value, false)}
                  onBlur={(event) => updateNote(marker.id, event.target.value.trim(), true)}
                  className="h-8 min-w-0"
                />
              ) : (
                <span className="text-sm text-muted-foreground">Marcação {index + 1}</span>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remover marcação ${index + 1}`}
                onClick={() => publish(markers.filter((current) => current.id !== marker.id))}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ol>
      )}
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
        <span className="text-sm font-medium tracking-wider text-muted-foreground">Marcar na imagem {positionIndex}</span>
        <ChevronDown className="h-4 w-4" />
      </div>
      <div className="w-full space-y-3 px-4">
        <div className="space-y-1">
          <Label className="text-[13px] font-normal">Título</Label>
          <Input value={attributes.label} onChange={(event) => commit({ label: event.target.value })} />
        </div>
        <div className="space-y-1">
          <Label className="text-[13px] font-normal">Imagem de fundo</Label>
          <Uploader fileTypeAccepted="image" onUpload={(key) => commit({ imageUrl: key })} />
          <Input
            className="mt-2 h-7 text-xs"
            placeholder="ou cole uma URL"
            value={attributes.imageUrl}
            onChange={(event) => commit({ imageUrl: event.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[13px] font-normal">Nota</Label>
          <Input value={attributes.helperText} onChange={(event) => commit({ helperText: event.target.value })} />
        </div>
        <div className="flex items-center justify-between gap-2">
          <Label className="text-[13px] font-normal">Pedir legenda de cada marcação</Label>
          <Switch checked={attributes.askNote} onCheckedChange={(askNote) => commit({ askNote })} />
        </div>
        <div className="flex items-center justify-between gap-2">
          <Label className="text-[13px] font-normal">Obrigatório</Label>
          <Switch checked={attributes.required} onCheckedChange={(required) => commit({ required })} />
        </div>
      </div>
    </div>
  );
}
