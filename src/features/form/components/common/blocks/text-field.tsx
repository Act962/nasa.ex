import { useEffect, useState } from "react";
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
  FormBlockInstance,
  FormBlockType,
  FormCategoryType,
  HandleBlurFunc,
  ObjectBlockType,
} from "@/features/form/types";
import { z } from "zod";
import { ChevronDown, TextCursorInput } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useBuilderStore } from "@/features/form/context/builder-form-provider";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Switch } from "@/components/ui/switch";
import { FormSettings } from "@/generated/prisma/client";
import { getContrastColor } from "@/utils/get-contrast-color";

const blockCategory: FormCategoryType = "Field";
const blockType: FormBlockType = "TextField";

type attributesType = {
  label: string;
  helperText: string;
  required: boolean;
  placeHolder: string;
};

type propertiesValidateSchemaType = z.input<typeof propertiesValidateSchema>;

const propertiesValidateSchema = z.object({
  placeHolder: z.string().trim().optional(),
  label: z.string().trim().min(2).max(255),
  required: z.boolean().default(false).optional(),
  helperText: z.string().trim().max(255).optional(),
});

export const TextFieldBlock: ObjectBlockType = {
  blockType,
  blockCategory,
  createInstance: (id: string) => ({
    id,
    blockType,
    attributes: {
      label: "Campo de texto",
      helperText: "",
      required: false,
      placeHolder: "Digite o texto",
    },
  }),
  blockBtnElement: {
    icon: TextCursorInput,
    label: "Campo de texto",
  },
  canvasComponent: TextFieldCanvasComponent,
  formComponent: TextFieldFormComponent,
  propertiesComponent: TextFieldPropertiesComponent,
};

type NewInstance = FormBlockInstance & {
  attributes: attributesType;
};

function TextFieldCanvasComponent({
  blockInstance,
  settings,
}: {
  blockInstance: FormBlockInstance;
  settings?: any;
}) {
  const block = blockInstance as NewInstance;
  const { helperText, label, placeHolder, required } = block.attributes;

  const textColor = settings?.backgroundColor
    ? getContrastColor(settings.backgroundColor)
    : undefined;

  return (
    <div className="flex flex-col gap-2 w-full">
      <Label
        className="text-base font-normal! mb-2"
        style={{ color: textColor || undefined }}
      >
        {label}
        {required && <span className="text-red-500">*</span>}
      </Label>
      <Input
        readOnly
        className="pointer-events-none!
        cursor-default h-10"
        placeholder={placeHolder}
      />
      {helperText && (
        <p
          className={
            textColor ? "text-[0.8rem]" : "text-[0.8rem] text-muted-foreground"
          }
          style={textColor ? { color: textColor, opacity: 0.8 } : undefined}
        >
          {helperText}
        </p>
      )}
    </div>
  );
}

function TextFieldFormComponent({
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
  const { helperText, label, placeHolder, required } = block.attributes;

  const textColor = settings?.backgroundColor
    ? getContrastColor(settings.backgroundColor)
    : undefined;

  const [value, setValue] = useState("");
  const [isError, setIsError] = useState(false);

  const validateField = (val: string) => {
    if (required) {
      return val.trim().length > 0; // Validation: Required fields must not be empty.
    }
    return true; // If not required, always valid.
  };
  return (
    <div className="flex flex-col gap-2 w-full">
      <Label
        className={`text-base font-normal! mb-2 ${
          isError || isSubmitError ? "text-red-500" : ""
        }`}
      >
        {label}
        {required && <span className="text-red-500">*</span>}
      </Label>
      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={(event) => {
          const inputValue = event.target.value;
          const isValid = validateField(inputValue);
          setIsError(!isValid); // Set error state based on validation.
          if (handleBlur) {
            handleBlur(block.id, {
              value: inputValue,
              meta: {},
            });
          }
        }}
        className={`h-10 ${isError || isSubmitError ? "border-red-500!" : ""}`}
        placeholder={placeHolder}
      />
      {helperText && (
        <p
          className={
            textColor ? "text-[0.8rem]" : "text-[0.8rem] text-muted-foreground"
          }
          style={textColor ? { opacity: 0.8 } : undefined}
        >
          {helperText}
        </p>
      )}

      {isError || isSubmitError ? (
        <p className="text-red-500 text-[0.8rem]">
          {required && value.trim().length === 0
            ? `This field is required.`
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

function TextFieldPropertiesComponent({
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
    mode: "onBlur",
    defaultValues: {
      label: block.attributes.label,
      helperText: block.attributes.helperText,
      required: block.attributes.required,
      placeHolder: block.attributes.placeHolder,
    },
  });

  useEffect(() => {
    form.reset({
      label: block.attributes.label,
      helperText: block.attributes.helperText,
      required: block.attributes.required,
      placeHolder: block.attributes.placeHolder,
    });
  }, [block.attributes, form]);

  function setChanges(values: propertiesValidateSchemaType) {
    if (!parentId) return null;
    updateChildBlock(parentId, block.id, {
      ...block,
      attributes: {
        ...block.attributes,
        ...values, // Merge new values into block's attributes
      },
    });
  }
  return (
    <div className="w-full  pb-4">
      <div className="w-full flex flex-row items-center justify-between gap-1 bg-foreground/10 rounded-md h-auto p-1 px-2 mb-[10px]">
        <span className="text-sm font-medium text-muted-foreground tracking-wider">
          Campo de texto {positionIndex}
        </span>
        <ChevronDown className="w-4 h-4" />
      </div>
      <Form {...form}>
        <form
          onSubmit={(e) => e.preventDefault()}
          className="w-full space-y-3 px-4"
        >
          <FormField
            control={form.control}
            name="label"
            render={({ field }) => (
              <FormItem className="text-end">
                <div className="flex items-baseline justify-between w-full gap-2">
                  <FormLabel className="text-[13px]  font-normal">
                    Label
                  </FormLabel>
                  <div className=" w-full max-w-[187px]">
                    <FormControl>
                      <Input
                        {...field}
                        className="max-w-[187px]"
                        onChange={(e) => {
                          field.onChange(e); // Update form state
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

          <FormField
            control={form.control}
            name="helperText"
            render={({ field }) => (
              <FormItem className="">
                <div className="flex items-baseline justify-between w-full gap-2">
                  <FormLabel className="text-[13px]  font-normal">
                    Nota
                  </FormLabel>
                  <div className=" w-full max-w-[187px]">
                    <FormControl>
                      <Input
                        {...field}
                        onChange={(e) => {
                          field.onChange(e); // Update form state
                          setChanges({
                            ...form.getValues(),
                            helperText: e.target.value,
                          });
                        }}
                      />
                    </FormControl>
                    <FormDescription
                      className="text-[11px] 
                    mt-2 pl-1"
                    >
                      Forneça uma nota curta para orientar os usuários
                    </FormDescription>
                  </div>
                </div>

                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="placeHolder"
            render={({ field }) => (
              <FormItem className="text-end">
                <div className="flex items-baseline justify-between w-full gap-2">
                  <FormLabel className="text-[13px]  font-normal">
                    Placeholder
                  </FormLabel>
                  <div className="w-full max-w-[187px]">
                    <FormControl>
                      <Input
                        {...field}
                        onChange={(e) => {
                          field.onChange(e); // Update form state
                          setChanges({
                            ...form.getValues(),
                            placeHolder: e.target.value,
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

          <FormField
            control={form.control}
            name="required"
            render={({ field }) => (
              <FormItem className="text-end">
                <div className="flex items-center justify-between w-full gap-2">
                  <FormLabel className="text-[13px] font-normal">
                    Obrigatório
                  </FormLabel>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={(value) => {
                        field.onChange(value); // Update form state
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
