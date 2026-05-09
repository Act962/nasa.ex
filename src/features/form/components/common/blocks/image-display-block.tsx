import { useEffect } from "react";
import { ChevronDown, Image as ImageIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useBuilderStore } from "@/features/form/context/builder-form-provider";
import { Uploader } from "@/components/file-uploader/uploader";
import { useConstructUrl } from "@/hooks/use-construct-url";

const blockCategory: FormCategoryType = "Layout";
const blockType: FormBlockType = "ImageDisplay";

type AttributesType = {
  url: string;
  alt: string;
  width: number;
  height: number;
  align: "left" | "center" | "right";
};

const propertiesValidateSchema = z.object({
  url: z.string().trim(),
  alt: z.string().trim().max(255),
  width: z.number().int().min(40).max(2000),
  height: z.number().int().min(40).max(2000),
  align: z.enum(["left", "center", "right"]),
});
type PropertiesType = z.input<typeof propertiesValidateSchema>;

export const ImageDisplayBlock: ObjectBlockType = {
  blockType,
  blockCategory,
  createInstance: (id) => ({
    id,
    blockType,
    attributes: {
      url: "",
      alt: "Imagem",
      width: 320,
      height: 200,
      align: "center",
    } satisfies AttributesType,
  }),
  blockBtnElement: { icon: ImageIcon, label: "Imagem fixa" },
  canvasComponent: View,
  formComponent: View,
  propertiesComponent: PropertiesView,
};

type Instance = FormBlockInstance & { attributes: AttributesType };

function View({ blockInstance }: { blockInstance: FormBlockInstance }) {
  const attrs = (blockInstance as Instance).attributes;
  const { url, alt, align } = attrs;
  const wRaw = attrs.width as unknown;
  const hRaw = attrs.height as unknown;
  const width =
    typeof wRaw === "number" && Number.isFinite(wRaw) && wRaw >= 40
      ? wRaw
      : Number(wRaw) >= 40 && Number.isFinite(Number(wRaw))
        ? Number(wRaw)
        : 320;
  const height =
    typeof hRaw === "number" && Number.isFinite(hRaw) && hRaw >= 40
      ? hRaw
      : Number(hRaw) >= 40 && Number.isFinite(Number(hRaw))
        ? Number(hRaw)
        : 200;
  const constructed = useConstructUrl(url || "");
  const justify = align === "left" ? "justify-start" : align === "right" ? "justify-end" : "justify-center";
  if (!url) {
    return (
      <div className={`flex w-full ${justify}`}>
        <div
          className="border border-dashed rounded-md flex items-center justify-center text-sm text-muted-foreground"
          style={{ width: `${width}px`, height: `${height}px`, maxWidth: "100%" }}
        >
          <ImageIcon className="w-5 h-5 mr-2" />
          Imagem decorativa
        </div>
      </div>
    );
  }
  return (
    <div className={`flex w-full ${justify}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={constructed}
        alt={alt}
        style={{ width: `${width}px`, height: `${height}px`, maxWidth: "100%", objectFit: "cover" }}
        className="rounded-md"
      />
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
          Imagem fixa {positionIndex}
        </span>
        <ChevronDown className="w-4 h-4" />
      </div>
      <Form {...form}>
        <form onSubmit={(e) => e.preventDefault()} className="w-full space-y-3 px-4">
          <FormField
            control={form.control}
            name="url"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[13px] font-normal">Imagem</FormLabel>
                <Uploader
                  fileTypeAccepted="image"
                  onUpload={(key) => {
                    field.onChange(key);
                    commit({ url: key });
                  }}
                />
                <FormControl>
                  <Input
                    className="mt-2 h-7 text-xs"
                    placeholder="ou cole uma URL/key"
                    {...field}
                    onChange={(e) => {
                      field.onChange(e);
                      commit({ url: e.target.value });
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="alt"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[13px] font-normal">Texto alternativo</FormLabel>
                <FormControl>
                  <Input
                    className="h-7 text-xs"
                    {...field}
                    onChange={(e) => { field.onChange(e); commit({ alt: e.target.value }); }}
                  />
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
                      className="h-7 text-xs"
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
                      className="h-7 text-xs"
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
            name="align"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[13px] font-normal">Alinhamento</FormLabel>
                <FormControl>
                  <select
                    className="w-full border rounded-md h-7 px-2 text-xs bg-transparent"
                    value={field.value}
                    onChange={(e) => {
                      const v = e.target.value as AttributesType["align"];
                      field.onChange(v);
                      commit({ align: v });
                    }}
                  >
                    <option value="left">Esquerda</option>
                    <option value="center">Centro</option>
                    <option value="right">Direita</option>
                  </select>
                </FormControl>
              </FormItem>
            )}
          />
        </form>
      </Form>
    </div>
  );
}
