import { useEffect, useState } from "react";
import { ChevronDown, ImagePlus, Trash } from "lucide-react";
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

const blockCategory: FormCategoryType = "Field";
const blockType: FormBlockType = "ImageUpload";

type AttributesType = {
  label: string;
  helperText: string;
  required: boolean;
  multiple: boolean;
  width: number;
  height: number;
};

const propertiesValidateSchema = z.object({
  label: z.string().trim().min(2).max(255),
  helperText: z.string().trim().max(255).optional(),
  required: z.boolean().default(false).optional(),
  multiple: z.boolean().default(false).optional(),
  width: z.number().int().min(40).max(2000),
  height: z.number().int().min(40).max(2000),
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

function CanvasView({ blockInstance }: { blockInstance: FormBlockInstance }) {
  const { label, required, helperText, width, height } = (blockInstance as Instance).attributes;
  return (
    <div className="flex flex-col gap-2 w-full">
      <Label className="text-base font-normal! mb-2">
        {label}
        {required && <span className="text-red-500">*</span>}
      </Label>
      <div
        className="border border-dashed rounded-md flex items-center justify-center text-sm text-muted-foreground"
        style={{ width: `${width}px`, height: `${height}px`, maxWidth: "100%" }}
      >
        <ImagePlus className="w-5 h-5 mr-2" />
        Imagem
      </div>
      {helperText && <p className="text-[0.8rem] text-muted-foreground">{helperText}</p>}
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
  const { label, required, helperText, multiple, width, height } = block.attributes;
  const [images, setImages] = useState<ImageItem[]>([]);
  const [isError, setIsError] = useState(false);

  function commit(next: ImageItem[]) {
    setImages(next);
    const isValid = !required || next.length > 0;
    setIsError(!isValid);
    handleBlur?.(block.id, {
      value: next.map((i) => i.url).join(","),
      meta: { images: next, dimensions: { width, height } },
    });
  }

  function onUpload(key: string, fileName?: string) {
    const item = { url: key, name: fileName ?? "Imagem" };
    commit(multiple ? [...images, item] : [item]);
  }

  return (
    <div className="flex flex-col gap-2 w-full">
      <Label
        className={`text-base font-normal! mb-2 ${isError || isSubmitError ? "text-red-500" : ""}`}
      >
        {label}
        {required && <span className="text-red-500">*</span>}
      </Label>
      {(multiple || images.length === 0) && (
        <div style={{ maxWidth: `${width}px`, width: "100%" }}>
          <Uploader fileTypeAccepted="image" onUpload={onUpload} />
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
      {helperText && <p className="text-[0.8rem] text-muted-foreground">{helperText}</p>}
      {(isError || isSubmitError) && (
        <p className="text-red-500 text-[0.8rem]">{errorMessage || "Envie uma imagem."}</p>
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
  return (
    <div
      className="relative border rounded-md overflow-hidden group"
      style={{ width: `${width}px`, height: `${height}px`, maxWidth: "100%" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={image.name} className="w-full h-full object-cover" />
      <Button
        type="button"
        variant="destructive"
        size="icon"
        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100"
        onClick={onRemove}
      >
        <Trash className="w-4 h-4" />
      </Button>
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
        </form>
      </Form>
    </div>
  );
}
