import { useEffect, useRef, useState } from "react";
import { ChevronDown, EyeIcon, ImagePlus, Trash } from "lucide-react";
import { ImagePreviewDialog } from "@/features/actions/components/view-modal/image-preview-dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  FormBlockInstance,
  FormBlockType,
  FormCategoryType,
  HandleBlurFunc,
  ObjectBlockType,
} from "@/features/form/types";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useBuilderStore } from "@/features/form/context/builder-form-provider";
import { Uploader } from "@/components/file-uploader/uploader";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { usePrefillFieldValue } from "@/features/form/context/form-prefill-context";

const blockCategory: FormCategoryType = "Field";
const blockType: FormBlockType = "ImageUpload";

type AttributesType = {
  label: string;
  helperText: string;
  required: boolean;
  multiple: boolean;
  width: number;
  height: number;
  backgroundUrl?: string;
  backgroundFit?: "cover" | "contain";
};

const propertiesValidateSchema = z.object({
  label: z.string().trim().max(255).optional(),
  helperText: z.string().trim().max(255).optional(),
  required: z.boolean().default(false).optional(),
  multiple: z.boolean().default(false).optional(),
  width: z.number().int().min(40).max(2000),
  height: z.number().int().min(40).max(2000),
  backgroundUrl: z.string().optional(),
  backgroundFit: z.enum(["cover", "contain"]).optional(),
});
type PropertiesType = z.input<typeof propertiesValidateSchema>;

export const ImageUploadBlock: ObjectBlockType = {
  blockType,
  blockCategory,
  createInstance: (id) => ({
    id,
    blockType,
    attributes: {
      label: "Foto",
      helperText: "",
      required: false,
      multiple: false,
      width: 240,
      height: 180,
    } satisfies AttributesType,
  }),
  blockBtnElement: { icon: ImagePlus, label: "Upload imagem" },
  canvasComponent: CanvasView,
  formComponent: FormView,
  propertiesComponent: PropertiesView,
};

type Instance = FormBlockInstance & { attributes: AttributesType };
type ImageItem = { url: string; name: string };

/**
 * Coerções defensivas: width/height antigos podem ter sido sobrescritos por
 * `"full"|"half"|...` quando havia conflito com a largura da coluna do row.
 * Sempre converter pra Number e cair no default se inválido.
 */
function pxOrDefault(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n >= 40 ? n : fallback;
}

function CanvasView({ blockInstance }: { blockInstance: FormBlockInstance }) {
  const attrs = (blockInstance as Instance).attributes;
  const {
    label,
    required,
    helperText,
    backgroundUrl,
    backgroundFit,
  } = attrs;
  const width = pxOrDefault(attrs.width, 240);
  const height = pxOrDefault(attrs.height, 180);
  return (
    <div className="flex flex-col gap-2 w-full">
      {label?.trim() && (
        <Label className="text-base font-normal! mb-2 whitespace-normal break-words leading-snug">
          {label}
          {required && <span className="text-red-500"> *</span>}
        </Label>
      )}
      <UploadPreviewBox
        width={width}
        height={height}
        backgroundUrl={backgroundUrl}
        backgroundFit={backgroundFit}
      />
      {helperText && <p className="text-[0.8rem] text-muted-foreground break-words whitespace-normal">{helperText}</p>}
    </div>
  );
}

function UploadPreviewBox({
  width,
  height,
  backgroundUrl,
  backgroundFit,
}: {
  width: number;
  height: number;
  backgroundUrl?: string;
  backgroundFit?: "cover" | "contain";
}) {
  const constructedBg = useConstructUrl(backgroundUrl || "");
  return (
    <div
      className="relative border border-dashed rounded-md overflow-hidden flex items-center justify-center text-sm text-muted-foreground"
      style={{ width: `${width}px`, height: `${height}px`, maxWidth: "100%" }}
    >
      {backgroundUrl && (
        <img
          src={constructedBg}
          alt="upload background"
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ objectFit: backgroundFit ?? "cover" }}
        />
      )}
      <div className="relative flex items-center justify-center bg-background/80 rounded-full size-10 shadow-sm">
        <ImagePlus className="w-5 h-5" />
      </div>
    </div>
  );
}

function FormView({
  blockInstance,
  handleBlur,
  isError: isSubmitError,
  errorMessage,
}: {
  blockInstance: FormBlockInstance;
  handleBlur?: HandleBlurFunc;
  isError?: boolean;
  errorMessage?: string;
}) {
  const block = blockInstance as Instance;
  const {
    label,
    required,
    helperText,
    multiple,
    backgroundUrl,
    backgroundFit,
  } = block.attributes;
  const width = pxOrDefault(block.attributes.width, 240);
  const height = pxOrDefault(block.attributes.height, 180);

  // Prefill: extrai a lista de imagens (mesmo padrão do FileUpload — meta
  // tem o array original com nomes; cai pra split do CSV de URLs como fallback).
  const prefill = usePrefillFieldValue(block.id);
  const initialImages: ImageItem[] = (() => {
    if (!prefill) return [];
    const metaImages = (prefill.meta as { images?: unknown } | undefined)?.images;
    if (Array.isArray(metaImages)) {
      return metaImages
        .filter((i): i is ImageItem =>
          !!i &&
          typeof i === "object" &&
          typeof (i as { url?: unknown }).url === "string",
        )
        .map((i) => ({
          url: (i as { url: string }).url,
          name: (i as { name?: string }).name ?? "Imagem",
        }));
    }
    if (typeof prefill.value === "string" && prefill.value.length > 0) {
      return prefill.value
        .split(",")
        .map((u) => u.trim())
        .filter(Boolean)
        .map((url) => ({ url, name: url.split("/").pop() ?? "Imagem" }));
    }
    return [];
  })();
  const [images, setImages] = useState<ImageItem[]>(initialImages);
  const [isError, setIsError] = useState(false);
  const [uploaderEpoch, setUploaderEpoch] = useState(0);
  const constructedBg = useConstructUrl(backgroundUrl || "");
  // Backup persistente extra das imagens em sessionStorage por blockId —
  // sobrevive a re-renders mesmo sem prefill (caso o user esteja preenchendo
  // pela primeira vez e algum rerender acidental dispare).
  const storageKey = `nasa.form.image-upload.${block.id}`;
  const initialRestoreRef = useRef(false);

  // Sincroniza o prefill com o formVals no mount.
  useEffect(() => {
    if (initialImages.length > 0 && handleBlur) {
      handleBlur(block.id, {
        value: initialImages.map((i) => i.url).join(","),
        meta: { images: initialImages, dimensions: { width, height } },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function commit(next: ImageItem[]) {
    setImages(next);
    const isValid = !required || next.length > 0;
    setIsError(!isValid);
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* quota / private mode — ignorar */
    }
    handleBlur?.(block.id, {
      value: next.map((i) => i.url).join(","),
      meta: { images: next, dimensions: { width, height } },
    });
  }

  function onUpload(key: string, fileName?: string) {
    const item = { url: key, name: fileName ?? "Imagem" };
    commit(multiple ? [...images, item] : [item]);
    if (multiple) {
      // Força remontar o Uploader pra aceitar próxima imagem
      // (ele desabilita o dropzone enquanto tem objectUrl interno).
      setUploaderEpoch((e) => e + 1);
    }
  }

  // Restaura na montagem inicial — sessionStorage tem prioridade sobre
  // useState vazio. Re-emite pro formVals.current pra garantir que o
  // submit final inclua as imagens.
  useEffect(() => {
    if (initialRestoreRef.current) return;
    initialRestoreRef.current = true;
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as ImageItem[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        setImages(parsed);
        handleBlur?.(block.id, {
          value: parsed.map((i) => i.url).join(","),
          meta: { images: parsed, dimensions: { width, height }, restored: true },
        });
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-2 w-full">
      {label?.trim() && (
        <Label className={`text-base font-normal! mb-2 whitespace-normal break-words leading-snug ${isError || isSubmitError ? "text-red-500" : ""}`}>
          {label}
          {required && <span className="text-red-500"> *</span>}
        </Label>
      )}
      {(multiple || images.length === 0) && (
        <div
          className={`relative rounded-md overflow-hidden [&_[data-slot=card]]:bg-transparent! [&_[data-slot=card]]:h-full! [&_[data-slot=card]]:w-full! ${
            backgroundUrl
              ? "[&_[data-slot=card]]:border-transparent! [&_p]:hidden [&_[data-slot=card]>[data-slot=card-content]]:p-0!"
              : ""
          }`}
          style={{
            width: `${width}px`,
            height: `${height}px`,
            maxWidth: "100%",
            backgroundImage: backgroundUrl ? `url(${constructedBg})` : undefined,
            backgroundSize: backgroundFit ?? "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        >
          <div className="relative w-full h-full">
            <Uploader
              key={`uploader-${uploaderEpoch}`}
              fileTypeAccepted="image"
              onUpload={onUpload}
            />
          </div>
        </div>
      )}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {images.map((img, idx) => (
            <ImagePreview
              key={`${img.url}-${idx}`}
              image={img}
              width={width}
              height={height}
              onRemove={() => commit(images.filter((_, i) => i !== idx))}
            />
          ))}
        </div>
      )}
      {helperText && <p className="text-[0.8rem] text-muted-foreground break-words whitespace-normal">{helperText}</p>}
      {(isError || isSubmitError) && (
        <p className="text-red-500 text-[0.8rem] break-words whitespace-normal">{errorMessage || "Envie uma imagem."}</p>
      )}
    </div>
  );
}

function ImagePreview({
  image,
  width,
  height,
  onRemove,
}: {
  image: ImageItem;
  width: number;
  height: number;
  onRemove: () => void;
}) {
  const url = useConstructUrl(image.url);
  const [open, setOpen] = useState(false);
  return (
    <>
      <div
        className="relative border rounded-md overflow-hidden group"
        style={{ width: `${width}px`, height: `${height}px`, maxWidth: "100%" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={image.name} className="w-full h-full object-cover" />

        {/* Overlay com ações no hover */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="size-8 shadow-sm"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(true);
            }}
            title="Visualizar"
          >
            <EyeIcon className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="size-8 shadow-sm"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            title="Remover"
          >
            <Trash className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <ImagePreviewDialog
        open={open}
        src={url}
        fileName={image.name}
        onClose={() => setOpen(false)}
      />
    </>
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
  const form = useForm<PropertiesType>({
    resolver: zodResolver(propertiesValidateSchema),
    mode: "onBlur",
    defaultValues: { ...block.attributes },
  });

  useEffect(() => form.reset({ ...block.attributes }), [block.attributes, form]);

  function commit(partial: Partial<AttributesType>) {
    if (!parentId) return;
    updateChildBlock(parentId, block.id, {
      ...block,
      attributes: { ...block.attributes, ...partial },
    });
  }

  return (
    <div className="w-full pb-4">
      <div className="w-full flex flex-row items-center justify-between gap-1 bg-foreground/10 rounded-md h-auto p-1 px-2 mb-[10px]">
        <span className="text-sm font-medium text-muted-foreground tracking-wider">
          Upload imagem {positionIndex}
        </span>
        <ChevronDown className="w-4 h-4" />
      </div>
      <Form {...form}>
        <form onSubmit={(e) => e.preventDefault()} className="w-full space-y-3 px-4">
          <FormField
            control={form.control}
            name="label"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[13px] font-normal">Título</FormLabel>
                <FormControl>
                  <Input {...field} onChange={(e) => { field.onChange(e); commit({ label: e.target.value }); }} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="helperText"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[13px] font-normal">Nota</FormLabel>
                <FormControl>
                  <Input {...field} onChange={(e) => { field.onChange(e); commit({ helperText: e.target.value }); }} />
                </FormControl>
              </FormItem>
            )}
          />
          <div className="grid grid-cols-2 gap-2">
            <FormField
              control={form.control}
              name="width"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[13px] font-normal">Largura (px)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      value={field.value}
                      onChange={(e) => {
                        const v = Number(e.target.value) || 0;
                        field.onChange(v);
                        commit({ width: v });
                      }}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="height"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[13px] font-normal">Altura (px)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      value={field.value}
                      onChange={(e) => {
                        const v = Number(e.target.value) || 0;
                        field.onChange(v);
                        commit({ height: v });
                      }}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="multiple"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between gap-2">
                  <FormLabel className="text-[13px] font-normal">Permite múltiplas imagens</FormLabel>
                  <FormControl>
                    <Switch checked={!!field.value} onCheckedChange={(v) => { field.onChange(v); commit({ multiple: v }); }} />
                  </FormControl>
                </div>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="required"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between gap-2">
                  <FormLabel className="text-[13px] font-normal">Obrigatório</FormLabel>
                  <FormControl>
                    <Switch checked={!!field.value} onCheckedChange={(v) => { field.onChange(v); commit({ required: v }); }} />
                  </FormControl>
                </div>
              </FormItem>
            )}
          />

          {/* Imagem de fundo do upload */}
          <div className="pt-2 border-t space-y-2">
            <FormLabel className="text-[13px] font-medium">
              Imagem de fundo do upload
            </FormLabel>
            <p className="text-[11px] text-muted-foreground">
              Aparece atrás da área de upload — útil pra mostrar um modelo
              ou silhueta (ex: posição do veículo).
            </p>

            <Uploader
              fileTypeAccepted="image"
              onUpload={(key) =>
                commit({ backgroundUrl: key } as Partial<AttributesType>)
              }
            />

            {block.attributes.backgroundUrl && (
              <>
                <div className="flex items-center gap-2">
                  <Input
                    value={block.attributes.backgroundUrl}
                    onChange={(e) =>
                      commit({
                        backgroundUrl: e.target.value,
                      } as Partial<AttributesType>)
                    }
                    className="text-[12px] h-8"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      commit({ backgroundUrl: "" } as Partial<AttributesType>)
                    }
                    className="text-[11px] text-muted-foreground hover:text-foreground underline"
                  >
                    limpar
                  </button>
                </div>

                <div>
                  <FormLabel className="text-[12px] font-normal">
                    Ajuste da imagem
                  </FormLabel>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() =>
                        commit({
                          backgroundFit: "cover",
                        } as Partial<AttributesType>)
                      }
                      className={`text-xs px-3 py-1.5 rounded border ${
                        (block.attributes.backgroundFit ?? "cover") === "cover"
                          ? "border-primary bg-primary/10"
                          : "border-border hover:bg-accent"
                      }`}
                    >
                      Preencher
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        commit({
                          backgroundFit: "contain",
                        } as Partial<AttributesType>)
                      }
                      className={`text-xs px-3 py-1.5 rounded border ${
                        block.attributes.backgroundFit === "contain"
                          ? "border-primary bg-primary/10"
                          : "border-border hover:bg-accent"
                      }`}
                    >
                      Encaixar
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
}
