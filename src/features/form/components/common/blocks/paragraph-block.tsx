import { ChevronDown, TextIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FormBlockInstance,
  FormBlockType,
  FormCategoryType,
  ObjectBlockType,
} from "@/features/form/types";
import {
  fontSizeClass,
  fontWeightClass,
} from "@/features/form/constants/index";
import { z } from "zod";
import { useBuilderStore } from "@/features/form/context/builder-form-provider";
import { Textarea } from "@/components/ui/textarea";
import { getContrastColor } from "@/utils/get-contrast-color";

const blockCategory: FormCategoryType = "Field";
const blockType: FormBlockType = "Paragraph";

type fontSizeType = "small" | "medium" | "large";

type fontWeightType = "normal" | "lighter";

type attributesType = {
  label: string;
  text: string;
  fontSize: fontSizeType;
  fontWeight: fontWeightType;
};

type ParagraphPropertiesSchema = z.input<typeof paragraphValidateSchema>;
const paragraphValidateSchema = z.object({
  text: z.string().trim().min(1).max(1000),
  fontSize: z.enum(["small", "medium", "large"]).default("small"),
  fontWeight: z.enum(["normal", "lighter"]).default("normal"),
});

export const ParagraphBlock: ObjectBlockType = {
  blockType,
  blockCategory,

  createInstance: (id: string) => ({
    id,
    blockType,
    attributes: {
      label: "Paragraph",
      text: "Digite o texto do parágrafo.",
      fontSize: "small",
      fontWeight: "normal",
    },
  }),

  blockBtnElement: {
    icon: TextIcon,
    label: "Paragraph",
  },
  canvasComponent: ParagraphCanvasFormComponent,
  formComponent: ParagraphCanvasFormComponent,
  propertiesComponent: ParagraphPropertiesComponent,
};

type NewInstance = FormBlockInstance & {
  attributes: attributesType;
};

function ParagraphCanvasFormComponent({
  blockInstance,
  settings,
}: {
  blockInstance: FormBlockInstance;
  settings?: any;
}) {
  const block = blockInstance as NewInstance;
  const { text, fontSize, fontWeight } = block.attributes;

  const textColor = settings?.backgroundColor
    ? getContrastColor(settings.backgroundColor)
    : undefined;

  return (
    <div
      className={`w-full text-left ${fontSizeClass[fontSize]} ${fontWeightClass[fontWeight]}`}
      style={{ color: textColor || undefined }}
    >
      <p>{text}</p>
    </div>
  );
}

function ParagraphPropertiesComponent({
  positionIndex,
  parentId,
  blockInstance,
}: {
  positionIndex?: number;
  parentId?: string;
  blockInstance: FormBlockInstance;
}) {
  const { updateChildBlock } = useBuilderStore();
  const block = blockInstance as NewInstance;

  const form = useForm<ParagraphPropertiesSchema>({
    resolver: zodResolver(paragraphValidateSchema),
    mode: "onBlur",
    defaultValues: {
      text: block.attributes.text,
      fontSize: block.attributes.fontSize,
      fontWeight: block.attributes.fontWeight,
    },
  });

  const setChanges = (values: ParagraphPropertiesSchema) => {
    if (!parentId) return null;
    updateChildBlock(parentId, block.id, {
      ...block,
      attributes: {
        ...block.attributes,
        ...values,
      },
    });
  };

  return (
    <div className="w-full pb-4">
      <div className="w-full flex flex-row items-center justify-between gap-1 bg-foreground/10 rounded-md h-auto p-1 px-2 mb-[10px]">
        <span className="text-sm font-medium text-muted-foreground tracking-wider">
          Parágrafo {positionIndex}
        </span>
        <ChevronDown className="w-4 h-4" />
      </div>
      <Form {...form}>
        <form
          onSubmit={(e) => e.preventDefault()}
          className="w-full space-y-3 px-4"
        >
          {/* Label */}
          {/* Text Content */}
          <FormField
            control={form.control}
            name="text"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-baseline justify-between w-full gap-2">
                  <FormLabel className="text-[13px] font-normal">
                    Conteúdo
                  </FormLabel>
                  <div className="w-full max-w-[400px]">
                    <FormControl>
                      <Textarea
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          setChanges({
                            ...form.getValues(),
                            text: e.target.value,
                          });
                        }}
                        rows={4}
                        placeholder="Enter your paragraph text here"
                      />
                    </FormControl>
                  </div>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Font Size */}
          <FormField
            control={form.control}
            name="fontSize"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-baseline justify-between w-full gap-2">
                  <FormLabel className="text-[13px] font-normal">
                    Tamanho da fonte
                  </FormLabel>
                  <div className="w-full max-w-[187px]">
                    <FormControl>
                      <Select
                        {...field}
                        onValueChange={(value: fontSizeType) => {
                          field.onChange(value);
                          setChanges({
                            ...form.getValues(),
                            fontSize: value,
                          });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tamanho da fonte" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="small">Pequeno</SelectItem>
                          <SelectItem value="medium">Mediano</SelectItem>
                          <SelectItem value="large">Grande</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                  </div>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Font Weight */}
          <FormField
            control={form.control}
            name="fontWeight"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-baseline justify-between w-full gap-2">
                  <FormLabel className="text-[13px] font-normal">
                    Peso da fonte
                  </FormLabel>
                  <div className="w-full max-w-[187px]">
                    <FormControl>
                      <Select
                        {...field}
                        onValueChange={(value: fontWeightType) => {
                          field.onChange(value);
                          setChanges({
                            ...form.getValues(),
                            fontWeight: value,
                          });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o peso da fonte" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="light">Leve</SelectItem>
                          <SelectItem value="normal">Normal</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                  </div>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>
    </div>
  );
}
