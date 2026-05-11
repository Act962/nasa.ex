import { useEffect, useRef, useState } from "react";
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
import { usePrefillValue } from "@/features/form/context/form-prefill-context";

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
  label: z.string().trim().max(255).optional(),
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
      {label?.trim() && (
        <Label className="text-base font-normal! mb-2 whitespace-normal break-words leading-snug"
        style={{ color: textColor || undefined }}>
          {label}
          {required && <span className="text-red-500"> *</span>}
        </Label>
      )}
      <textarea
        readOnly
        rows={1}
        wrap="soft"
        placeholder={placeHolder}
        className="pointer-events-none! cursor-default w-full min-w-0 min-h-10 resize-none rounded-md border bg-transparent px-3 py-2 text-base shadow-xs leading-snug focus-visible:outline-none placeholder:text-muted-foreground"
        style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}
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

  // Pré-preenche com a resposta salva no fluxo de edição
  // (`/formulario/[slug]/[responseId]`). No fluxo público fica undefined.
  const prefill = usePrefillValue(block.id);
  const [value, setValue] = useState(prefill ?? "");
  const [isError, setIsError] = useState(false);

  // Sincroniza valor pré-preenchido com o ref de respostas no mount,
  // pra que mesmo sem interação o blur já tenha registrado a resposta.
  useEffect(() => {
    if (prefill && prefill.trim().length > 0 && handleBlur) {
      handleBlur(block.id, { value: prefill });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validateField = (val: string) => {
    if (required) {
      return val.trim().length > 0; // Validation: Required fields must not be empty.
    }
    return true; // If not required, always valid.
  };
  return (
    <div className="flex flex-col gap-2 w-full">
      {label?.trim() && (
        <Label className={`text-base font-normal! mb-2 whitespace-normal break-words leading-snug ${
          isError || isSubmitError ? "text-red-500" : ""
        }`}>
          {label}
          {required && <span className="text-red-500"> *</span>}
        </Label>
      )}
      <AutoGrowTextarea
        value={value}
        onChange={(v) => setValue(v)}
        onBlur={(v) => {
          const isValid = validateField(v);
          setIsError(!isValid);
          if (handleBlur) handleBlur(block.id, { value: v });
        }}
        placeholder={placeHolder}
        className={`min-h-10 ${isError || isSubmitError ? "border-red-500!" : ""}`}
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
        <p className="text-red-500 text-[0.8rem] break-words whitespace-normal">
          {required && value.trim().length === 0
            ? `This field is required.`
            : ""}
        </p>
      ) : (
        errorMessage && (
          <p className="text-red-500 text-[0.8rem] break-words whitespace-normal">{errorMessage}</p>
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

/**
 * Textarea que se comporta como input single-line mas QUEBRA o texto quando
 * cabe e CRESCE em altura conforme necessário. Substitui `<input>` no Campo
 * de Texto pra resolver o problema de "texto linear que vaza" em larguras
 * estreitas.
 */
function AutoGrowTextarea({
  value,
  onChange,
  onBlur,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Auto-resize altura conforme conteúdo
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={1}
      wrap="soft"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onBlur={(e) => onBlur(e.target.value)}
      className={`w-full min-w-0 min-h-10 resize-none rounded-md border bg-transparent px-3 py-2 text-base shadow-xs leading-snug focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring placeholder:text-muted-foreground ${className ?? ""}`}
      style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}
    />
  );
}
