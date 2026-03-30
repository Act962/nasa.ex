import React, { useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { ChevronDown, HeadingIcon } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormDescription,
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
import { fontSizeClass, fontWeightClass } from "@/features/form/constants";
import { Input } from "@/components/ui/input";
import { useBuilderStore } from "@/features/form/context/builder-form-provider";
import { getContrastColor } from "@/utils/get-contrast-color";

const blockCategory: FormCategoryType = "Field";
const blockType: FormBlockType = "Heading";

type fontSizeType =
  | "small"
  | "medium"
  | "large"
  | "x-large"
  | "2x-large"
  | "4x-large";

type fontWeightType = "normal" | "bold" | "bolder" | "lighter";

type attributesType = {
  label: string;
  level: 1 | 2 | 3 | 4 | 5 | 6; // Corresponds to heading levels (h1 - h6)
  fontSize: fontSizeType;
  fontWeight: fontWeightType;
};

type propertiesValidateSchemaType = z.input<typeof propertiesValidateSchema>;

const propertiesValidateSchema = z.object({
  label: z.string().trim().min(2).max(255),
  level: z.number().min(1).max(6).default(1), // Defaults to H1
  fontSize: z
    .enum(["small", "medium", "large", "x-large", "2x-large", "4x-large"])
    .default("medium"),
  fontWeight: z.enum(["normal", "bold", "bolder", "lighter"]).default("normal"),
});

export const HeadingBlock: ObjectBlockType = {
  blockType,
  blockCategory,
  createInstance: (id: string) => ({
    id,
    blockType,
    attributes: {
      label: "Heading",
      level: 1, // Default to H1
      fontSize: "medium",
      fontWeight: "normal",
    },
  }),
  blockBtnElement: {
    icon: HeadingIcon,
    label: "Heading",
  },
  canvasComponent: HeadingCanvasFormComponent, // Renders the heading block on the canvas
  formComponent: HeadingCanvasFormComponent, // Customize as needed
  propertiesComponent: HeadingPropertiesComponent, // Properties editor
};

type NewInstance = FormBlockInstance & {
  attributes: attributesType;
};

function HeadingCanvasFormComponent({
  blockInstance,
  settings,
}: {
  blockInstance: FormBlockInstance;
  settings?: any;
}) {
  const block = blockInstance as NewInstance;
  const { level, label, fontSize, fontWeight } = block.attributes;

  const textColor = settings?.backgroundColor
    ? getContrastColor(settings.backgroundColor)
    : undefined;

  return (
    <div
      className={`w-full text-left
         ${fontSizeClass[fontSize]} ${fontWeightClass[fontWeight]}`}
      style={{ color: textColor || undefined }}
    >
      {React.createElement(
        `h${level}`, // Dynamically create heading tag based on 'level'
        {}, // No additional props for the heading element
        label, // Label for the heading
      )}
    </div>
  );
}

function HeadingPropertiesComponent({
  positionIndex,
  parentId,
  blockInstance,
}: {
  positionIndex?: number;
  parentId?: string;
  blockInstance: FormBlockInstance;
}) {
  const block = blockInstance as NewInstance;
  const { updateChildBlock } = useBuilderStore();

  const form = useForm<propertiesValidateSchemaType>({
    resolver: zodResolver(propertiesValidateSchema),
    defaultValues: {
      label: block.attributes.label,
      fontSize: block.attributes.fontSize,
      fontWeight: block.attributes.fontWeight,
      level: block.attributes.level,
    },
    mode: "onBlur",
  });

  useEffect(() => {
    form.reset({
      label: block.attributes.label,
      fontSize: block.attributes.fontSize,
      fontWeight: block.attributes.fontWeight,
      level: block.attributes.level,
    });
  }, [block.attributes, form]);

  function setChanges(values: propertiesValidateSchemaType) {
    if (!parentId) {
      console.log("parentId is required");
      return;
    }
    updateChildBlock(parentId, block.id, {
      ...block,
      attributes: {
        ...block.attributes,
        ...values, // Merge new values into block's attributes
      },
    });
  }

  return (
    <div className="w-full pb-4">
      <div className="w-full flex flex-row items-center justify-between gap-1 bg-foreground/10 rounded-md h-auto p-1 px-2 mb-[10px]">
        <span className="text-sm font-medium text-muted-foreground tracking-wider">
          Titulo {positionIndex}
        </span>
        <ChevronDown className="w-4 h-4" />
      </div>
      <Form {...form}>
        <form
          onSubmit={(e) => e.preventDefault()}
          className="w-full space-y-3 px-4"
        >
          {/* Label */}
          <FormField
            control={form.control}
            name="label"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-baseline justify-between w-full gap-2">
                  <FormLabel className="text-[13px] font-normal">
                    Label
                  </FormLabel>
                  <div className="w-full max-w-[187px]">
                    <FormControl>
                      <Input
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          setChanges({
                            ...form.getValues(),
                            label: e.target.value,
                          });
                        }}
                      />
                    </FormControl>
                    <FormDescription></FormDescription>
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
                <div
                  className="flex items-baseline justify-between 
                w-full gap-2"
                >
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
                          <SelectValue placeholder="Select Font Size" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="small">Pequeno</SelectItem>
                          <SelectItem value="medium">Mediano</SelectItem>
                          <SelectItem value="large">Grande</SelectItem>
                          <SelectItem value="x-large">extra Grande</SelectItem>
                          <SelectItem value="2x-large">
                            2x extra Grande
                          </SelectItem>
                          <SelectItem value="4x-large">
                            4x extra Grande
                          </SelectItem>
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
                          <SelectValue placeholder="Select Font Weight" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="bold">Negrito</SelectItem>
                          <SelectItem value="bolder">Mais negrito</SelectItem>
                          <SelectItem value="lighter">Menos negrito</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                  </div>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Heading Level */}
          <FormField
            control={form.control}
            name="level"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-baseline justify-between w-full gap-2">
                  <FormLabel className="text-[13px] font-normal">
                    Nivel
                  </FormLabel>
                  <div className="w-full max-w-[187px]">
                    <FormControl>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          setChanges({
                            ...form.getValues(),
                            level: Number(value),
                          });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select Heading Level" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">H1</SelectItem>
                          <SelectItem value="2">H2</SelectItem>
                          <SelectItem value="3">H3</SelectItem>
                          <SelectItem value="4">H4</SelectItem>
                          <SelectItem value="5">H5</SelectItem>
                          <SelectItem value="6">H6</SelectItem>
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
