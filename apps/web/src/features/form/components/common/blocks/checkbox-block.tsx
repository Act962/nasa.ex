import { useEffect, useState } from "react";
import { CheckSquare, ChevronDown, X } from "lucide-react";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { useBuilderStore } from "@/features/form/context/builder-form-provider";
import { usePrefillValue } from "@/features/form/context/form-prefill-context";

const blockCategory: FormCategoryType = "Field";
const blockType: FormBlockType = "Checkbox";

type Option = { id: string; label: string };
type AttributesType = {
  label: string;
  helperText: string;
  required: boolean;
  multiple: boolean;
  options: Option[];
};

const propertiesValidateSchema = z.object({
  label: z.string().trim().max(255).optional(),
  helperText: z.string().trim().max(255).optional(),
  required: z.boolean().default(false).optional(),
  multiple: z.boolean().default(false).optional(),
});
type PropertiesType = z.input<typeof propertiesValidateSchema>;

export const CheckboxBlock: ObjectBlockType = {
  blockType,
  blockCategory,
  createInstance: (id) => ({
    id,
    blockType,
    attributes: {
      label: "Caixa de seleção",
      helperText: "",
      required: false,
      multiple: true,
      options: [
        { id: "opt-1", label: "Opção 1" },
        { id: "opt-2", label: "Opção 2" },
      ],
    } satisfies AttributesType,
  }),
  blockBtnElement: { icon: CheckSquare, label: "Checkbox" },
  canvasComponent: CanvasView,
  formComponent: FormView,
  propertiesComponent: PropertiesView,
};

type Instance = FormBlockInstance & { attributes: AttributesType };

function CanvasView({ blockInstance }: { blockInstance: FormBlockInstance }) {
  const block = blockInstance as Instance;
  const { label, options, required, helperText, multiple } = block.attributes;
  return (
    <div className="flex flex-col gap-2 w-full">
      {label?.trim() && (
        <Label className="text-base font-normal! mb-2 whitespace-normal break-words leading-snug">
          {label}
          {required && <span className="text-red-500"> *</span>}
          {!multiple && (
            <span className="text-xs text-muted-foreground ml-1">(único)</span>
          )}
        </Label>
      )}
      <div className="flex flex-col gap-2">
        {options?.map((opt) => (
          <div key={opt.id} className="flex items-center gap-2 pointer-events-none">
            <Checkbox checked={false} />
            <span className="text-sm break-words whitespace-normal min-w-0 flex-1">{opt.label}</span>
          </div>
        ))}
      </div>
      {helperText && (
        <p className="text-[0.8rem] text-muted-foreground break-words whitespace-normal">{helperText}</p>
      )}
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
  const { label, options, required, helperText, multiple } = block.attributes;

  // Prefill: a resposta salva é uma string CSV de IDs (`opt1,opt2`).
  const prefill = usePrefillValue(block.id);
  const initialSelected = prefill
    ? prefill.split(",").filter((s) => s.length > 0)
    : [];
  const [selected, setSelected] = useState<string[]>(initialSelected);
  const [isError, setIsError] = useState(false);
  useEffect(() => {
    if (prefill && handleBlur) {
      handleBlur(block.id, {
        value: prefill,
        meta: {
          ids: initialSelected,
          labels: options
            .filter((o) => initialSelected.includes(o.id))
            .map((o) => o.label),
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle(id: string, checked: boolean) {
    let next: string[];
    if (multiple) {
      next = checked ? [...selected, id] : selected.filter((s) => s !== id);
    } else {
      next = checked ? [id] : [];
    }
    setSelected(next);
    const isValid = !required || next.length > 0;
    setIsError(!isValid);
    handleBlur?.(block.id, {
      value: next.join(","),
      meta: { ids: next, labels: options.filter((o) => next.includes(o.id)).map((o) => o.label) },
    });
  }

  return (
    <div className="flex flex-col gap-2 w-full">
      {label?.trim() && (
        <Label
          className={`text-base font-normal! mb-2 whitespace-normal break-words leading-snug ${isError || isSubmitError ? "text-red-500" : ""}`}
        >
          {label}
          {required && <span className="text-red-500"> *</span>}
        </Label>
      )}
      <div className="flex flex-col gap-2">
        {options?.map((opt) => (
          <label key={opt.id} className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={selected.includes(opt.id)}
              onCheckedChange={(c) => toggle(opt.id, !!c)}
            />
            <span className="text-sm break-words whitespace-normal min-w-0 flex-1">{opt.label}</span>
          </label>
        ))}
      </div>
      {helperText && (
        <p className="text-[0.8rem] text-muted-foreground break-words whitespace-normal">{helperText}</p>
      )}
      {(isError || isSubmitError) && (
        <p className="text-red-500 text-[0.8rem] break-words whitespace-normal">{errorMessage || "Selecione ao menos uma opção."}</p>
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
  const form = useForm<PropertiesType>({
    resolver: zodResolver(propertiesValidateSchema),
    mode: "onBlur",
    defaultValues: {
      label: block.attributes.label,
      helperText: block.attributes.helperText,
      required: block.attributes.required,
      multiple: block.attributes.multiple,
    },
  });

  useEffect(() => {
    form.reset({
      label: block.attributes.label,
      helperText: block.attributes.helperText,
      required: block.attributes.required,
      multiple: block.attributes.multiple,
    });
  }, [block.attributes, form]);

  function commit(partial: Partial<AttributesType>) {
    if (!parentId) return;
    updateChildBlock(parentId, block.id, {
      ...block,
      attributes: { ...block.attributes, ...partial },
    });
  }

  function updateOption(idx: number, value: string) {
    const next = [...block.attributes.options];
    next[idx] = { ...next[idx], label: value };
    commit({ options: next });
  }

  function addOption() {
    const next = [
      ...block.attributes.options,
      { id: `opt-${Date.now()}`, label: `Opção ${block.attributes.options.length + 1}` },
    ];
    commit({ options: next });
  }

  function removeOption(idx: number) {
    const next = block.attributes.options.filter((_, i) => i !== idx);
    commit({ options: next });
  }

  return (
    <div className="w-full pb-4">
      <div className="w-full flex flex-row items-center justify-between gap-1 bg-foreground/10 rounded-md h-auto p-1 px-2 mb-[10px]">
        <span className="text-sm font-medium text-muted-foreground tracking-wider">
          Checkbox {positionIndex}
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
                  <Input
                    {...field}
                    onChange={(e) => {
                      field.onChange(e);
                      commit({ label: e.target.value });
                    }}
                  />
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
                  <Input
                    {...field}
                    onChange={(e) => {
                      field.onChange(e);
                      commit({ helperText: e.target.value });
                    }}
                  />
                </FormControl>
                <FormDescription className="text-[11px] mt-1">
                  Texto curto pra orientar o usuário.
                </FormDescription>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="multiple"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between gap-2">
                  <FormLabel className="text-[13px] font-normal">Permite múltiplas seleções</FormLabel>
                  <FormControl>
                    <Switch
                      checked={!!field.value}
                      onCheckedChange={(v) => {
                        field.onChange(v);
                        commit({ multiple: v });
                      }}
                    />
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
                    <Switch
                      checked={!!field.value}
                      onCheckedChange={(v) => {
                        field.onChange(v);
                        commit({ required: v });
                      }}
                    />
                  </FormControl>
                </div>
              </FormItem>
            )}
          />
          <div className="space-y-2">
            <Label className="text-[13px] font-normal">Opções</Label>
            {block.attributes.options.map((opt, idx) => (
              <div key={opt.id} className="flex items-center gap-2">
                <Input
                  value={opt.label}
                  onChange={(e) => updateOption(idx, e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeOption(idx)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addOption}>
              Adicionar opção
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
