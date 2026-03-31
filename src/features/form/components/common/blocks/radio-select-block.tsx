import {
  FormBlockInstance,
  FormBlockType,
  FormCategoryType,
  HandleBlurFunc,
  ObjectBlockType,
} from "@/features/form/types";
import { ChevronDown, CircleIcon, TagIcon, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useBuilderStore } from "@/features/form/context/builder-form-provider";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { v4 as uuidv4 } from "uuid";
import { FormSettings } from "@/generated/prisma/client";
import { getContrastColor } from "@/utils/get-contrast-color";
import { TagDropdown } from "./dropdown-select-tag";

const blockCategory: FormCategoryType = "Field";
const blockType: FormBlockType = "RadioSelect";

type attributesType = {
  label: string;
  options: { value: string; tagId?: string | null }[];
  required: boolean;
};

type propertiesValidateSchemaType = z.input<typeof propertiesValidateSchema>;

const propertiesValidateSchema = z.object({
  label: z.string().trim().min(2).max(255),
  required: z.boolean().default(false),
  options: z.array(
    z.object({ value: z.string().min(1), tagId: z.string().nullable() }),
  ),
});

export const RadioSelectBlock: ObjectBlockType = {
  blockCategory,
  blockType,

  createInstance: (id: string) => ({
    id,
    blockType,
    attributes: {
      label: "Selecione uma opção",
      options: [
        { value: "Opção 1", tagId: null },
        { value: "Opção 2", tagId: null },
      ],
      required: false,
    },
  }),

  blockBtnElement: {
    icon: CircleIcon,
    label: "Radio",
  },

  canvasComponent: RadioSelectCanvasComponent,
  formComponent: RadioSelectFormComponent,
  propertiesComponent: RadioSelectPropertiesComponent,
};

type NewInstance = FormBlockInstance & {
  attributes: attributesType;
};
//Preview Component
function RadioSelectCanvasComponent({
  blockInstance,
  settings,
}: {
  blockInstance: FormBlockInstance;
  settings?: FormSettings | null;
}) {
  const block = blockInstance as NewInstance;

  const { label, options, required } = block.attributes;

  const textColor = getContrastColor(settings?.backgroundColor || "");

  return (
    <div
      className="flex flex-col
  gap-3 w-full
    "
    >
      <Label
        className="
     text-base font-normal! mb-2
     "
        style={{ color: textColor }}
      >
        {label}
        {required && <span className="text-red-500">*</span>}
      </Label>

      <RadioGroup
        disabled={true}
        className="space-y-3
        disabled:cursor-default 
        pointer-events-none
        cursor-default"
      >
        {options?.map((option: OptionType, index: number) => (
          <div key={index} className="flex items-center space-x-2">
            <RadioGroupItem
              disabled
              value={option.value}
              id={option.value}
              style={{ borderColor: settings?.primaryColor }}
            />
            <Label
              htmlFor={option.value}
              className="font-normal!"
              style={{ color: textColor }}
            >
              {option.value}
            </Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}
//Form Component
type OptionType = {
  value: string;
  meta?: {
    tagId?: string | null;
  };
};
function RadioSelectFormComponent({
  blockInstance,
  handleBlur,
  isError: isSubmitError,
  errorMessage,
  settings,
}: {
  blockInstance: FormBlockInstance;
  handleBlur?: HandleBlurFunc;
  isError?: boolean;
  errorMessage?: string;
  settings?: FormSettings | null;
}) {
  const block = blockInstance as NewInstance;
  const { label, options, required } = block.attributes;

  const textColor = getContrastColor(settings?.backgroundColor || "");

  const [value, setValue] = useState<{
    value: string;
    meta: Record<string, unknown>;
  }>({
    value: "",
    meta: {},
  });
  const [isError, setIsError] = useState(false);

  const validateField = (val: string) => {
    if (required) {
      return val.trim().length > 0;
    }
    return true; // If not required, always valid.
  };

  return (
    <div className="flex flex-col gap-3 w-full">
      <Label
        className={`text-base font-normal! mb-2 ${isError || isSubmitError ? "text-red-500" : ""}`}
        style={{ color: textColor }}
      >
        {label}
        {required && <span className="text-red-500">*</span>}
      </Label>

      <RadioGroup
        value={value.value}
        className="space-y-3"
        onValueChange={(value) => {
          const option = options.find((option) => option.value === value);
          setValue({
            value,
            meta: { tagId: option?.tagId || null },
          });
          const isValid = validateField(value);
          setIsError(!isValid);
          if (handleBlur) {
            handleBlur(block.id, {
              value,
              meta: {
                tagId: option?.tagId || null,
              },
            });
          }
        }}
      >
        {options?.map((option: OptionType, index: number) => {
          const uniqueId = `option-${uuidv4()}`;
          return (
            <div key={index} className="flex items-center space-x-2">
              <RadioGroupItem
                value={option.value}
                id={uniqueId}
                className={`cursor-pointer ${
                  isError || isSubmitError ? "border-red-500" : ""
                }`}
                style={{
                  borderColor: settings?.primaryColor || undefined,
                  color: textColor || undefined,
                }}
              />
              <Label
                htmlFor={uniqueId}
                className="font-normal! cursor-pointer"
                style={{
                  color: textColor || undefined,
                }}
              >
                {option.value}
              </Label>
            </div>
          );
        })}
      </RadioGroup>

      {isError ? (
        <p className="text-red-500 text-[0.8rem]">
          {required && value.value.trim().length === 0
            ? "This field is required"
            : ""}
        </p>
      ) : (
        errorMessage && (
          <p className="text-red-500 text-[0.8rem]">{errorMessage}</p>
        )
      )}
    </div>
  );
}
//Settings Properties Component
function RadioSelectPropertiesComponent({
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

  // Define form schema and validation
  const form = useForm<propertiesValidateSchemaType>({
    resolver: zodResolver(propertiesValidateSchema),
    mode: "onBlur",
    defaultValues: {
      label: block.attributes.label,
      required: block.attributes.required,
      options: block.attributes.options.map((option) => ({
        value: option.value,
        tagId: option.tagId,
      })),
    },
  });

  // Reset form values when block attributes change
  useEffect(() => {
    form.reset({
      label: block.attributes.label,
      required: block.attributes.required,
      options: block.attributes.options || [],
    });
  }, [block.attributes, form]);

  function setChanges(values: propertiesValidateSchemaType) {
    if (!parentId) return null;

    //Update ChildBlock
    updateChildBlock(parentId, block.id, {
      ...block,
      attributes: {
        ...block.attributes,
        ...values,
      },
    });
  }

  const handleTagSelect = (tag: string | null, index: number) => {
    const updatedOptions = form.getValues().options.map((option, i) => {
      if (i === index) {
        return {
          ...option,
          tagId: tag,
        };
      }
      return option;
    });

    form.setValue("options", updatedOptions);

    setChanges({
      ...form.getValues(),
      options: updatedOptions,
    });
  };

  return (
    <div className="w-full pb-4">
      <div className="w-full flex items-center justify-between gap-1 bg-foreground/10 rounded-md h-auto p-1 px-2 mb-[10px]">
        <span
          className="
          text-sm font-medium text-muted-foreground
          tracking-wider
        "
        >
          Radio {positionIndex}
        </span>
        <ChevronDown className="w-4 h-4" />
      </div>

      <Form {...form}>
        <form
          onSubmit={(e) => e.preventDefault()}
          className="w-full space-y-3 px-4"
        >
          {/* Label Field */}
          <FormField
            control={form.control}
            name="label"
            render={({ field }) => (
              <FormItem className="text-end">
                <div
                  className="flex items-baseline
                  justify-between w-full gap-2"
                >
                  <FormLabel className="text-[13px] font-normal">
                    Label
                  </FormLabel>
                  <div className="w-full max-w-[187px]">
                    <Input
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                        setChanges({
                          ...form.getValues(),
                          label: e.target.value,
                        });
                      }}
                      // onKeyDown={(event) => {
                      //   if(event.key === "Enter") event.currentTarget
                      // }}
                    />
                  </div>
                </div>
              </FormItem>
            )}
          />

          {/* Options Field */}
          <FormField
            control={form.control}
            name="options"
            render={({ field }) => (
              <FormItem className="text-end">
                <div
                  className="flex items-baseline
                  justify-between w-full gap-2"
                >
                  <FormLabel className="text-[13px] font-normal">
                    Opções
                  </FormLabel>
                  <div className="flex flex-col gap-1">
                    {field?.value?.map(
                      (
                        option: { value: string; tagId: string | null },
                        index: number,
                      ) => (
                        <div
                          key={index}
                          className="relative flex items-center justify-between gap-2"
                        >
                          <TagDropdown
                            tagId={option.tagId}
                            onSelect={(tag) => handleTagSelect(tag, index)}
                          >
                            <TagIcon className="text-muted-foreground size-4" />
                          </TagDropdown>
                          <Input
                            value={option.value}
                            onChange={(e) => {
                              const updatedOptions = [...(field.value || [])];
                              updatedOptions[index].value = e.target.value;
                              field.onChange(updatedOptions);
                              setChanges({
                                ...form.getValues(),
                                options: updatedOptions,
                              });
                            }}
                            className="max-w-[187px]"
                          />

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="
                            p-0 absolute -right-1 -top-1
                            bg-foreground rounded-full
                            w-4 h-4
                          "
                            onClick={() => {
                              const updatedOptions = field.value?.filter(
                                (_, i) => i !== index,
                              );
                              field.onChange(updatedOptions);
                              setChanges({
                                ...form.getValues(),
                                options: updatedOptions,
                              });
                            }}
                          >
                            <X className="w-2.5 h-2.5 text-background" />
                          </Button>
                        </div>
                      ),
                    )}

                    <FormMessage />

                    <Button
                      type="button"
                      variant="outline"
                      className="mt-2"
                      size="sm"
                      onClick={() => {
                        const currentOptions = field?.value || [];
                        const newOption = `Opção ${currentOptions.length + 1}`;
                        const updatedOptions = [
                          ...currentOptions,
                          { value: newOption, tagId: null },
                        ];
                        field.onChange(updatedOptions);
                        setChanges({
                          ...form.getValues(),
                          options: updatedOptions,
                        });
                      }}
                    >
                      Adicionar opção
                    </Button>
                  </div>
                </div>
              </FormItem>
            )}
          />

          {/* Required Field */}
          <FormField
            control={form.control}
            name="required"
            render={({ field }) => (
              <FormItem className="text-end">
                <div
                  className="flex items-baseline
                  justify-between w-full gap-2"
                >
                  <FormLabel className="text-[13px] font-normal">
                    Obrigatorio
                  </FormLabel>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={(value) => {
                        field.onChange(value);
                        setChanges({
                          ...form.getValues(),
                          required: value,
                        });
                      }}
                    />
                  </FormControl>
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
