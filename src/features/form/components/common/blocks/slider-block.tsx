import { useEffect, useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
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
import { Slider } from "@/components/ui/slider";
import { useBuilderStore } from "@/features/form/context/builder-form-provider";

const blockCategory: FormCategoryType = "Field";
const blockType: FormBlockType = "Slider";

type AttributesType = {
  label: string;
  helperText: string;
  required: boolean;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  unit: string;
};

const propertiesValidateSchema = z.object({
  label: z.string().trim().min(2).max(255),
  helperText: z.string().trim().max(255).optional(),
  required: z.boolean().default(false).optional(),
  min: z.number().int(),
  max: z.number().int(),
  step: z.number().min(0.01),
  defaultValue: z.number(),
  unit: z.string().trim().max(20).optional(),
});
type PropertiesType = z.input<typeof propertiesValidateSchema>;

export const SliderBlock: ObjectBlockType = {
  blockType,
  blockCategory,
  createInstance: (id) => ({
    id,
    blockType,
    attributes: {
      label: "Avaliação",
      helperText: "",
      required: false,
      min: 0,
      max: 100,
      step: 1,
      defaultValue: 50,
      unit: "",
    } satisfies AttributesType,
  }),
  blockBtnElement: { icon: SlidersHorizontal, label: "Slider" },
  canvasComponent: CanvasView,
  formComponent: FormView,
  propertiesComponent: PropertiesView,
};

type Instance = FormBlockInstance & { attributes: AttributesType };

function CanvasView({ blockInstance }: { blockInstance: FormBlockInstance }) {
  const { label, required, helperText, min, max, defaultValue, unit } = (blockInstance as Instance).attributes;
  return (
    <div className="flex flex-col gap-2 w-full">
      <Label className="text-base font-normal! mb-2">
        {label}
        {required && <span className="text-red-500">*</span>}
        <span className="text-xs text-muted-foreground ml-2">
          {min}–{max} {unit}
        </span>
      </Label>
      <div className="pointer-events-none">
        <Slider value={[defaultValue]} min={min} max={max} step={1} />
      </div>
      {helperText && <p className="text-[0.8rem] text-muted-foreground">{helperText}</p>}
    </div>
  );
}

function FormView({
  blockInstance,
  handleBlur,
}: {
  blockInstance: FormBlockInstance;
  handleBlur?: HandleBlurFunc;
}) {
  const block = blockInstance as Instance;
  const { label, required, helperText, min, max, step, defaultValue, unit } = block.attributes;
  const [value, setValue] = useState<number>(defaultValue);

  function commit(v: number[]) {
    const next = v[0] ?? defaultValue;
    setValue(next);
    handleBlur?.(block.id, { value: String(next), meta: { num: next, unit } });
  }

  return (
    <div className="flex flex-col gap-2 w-full">
      <Label className="text-base font-normal! mb-2 flex items-center justify-between">
        <span>
          {label}
          {required && <span className="text-red-500">*</span>}
        </span>
        <span className="text-sm text-muted-foreground">
          {value} {unit}
        </span>
      </Label>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={commit} />
      {helperText && <p className="text-[0.8rem] text-muted-foreground">{helperText}</p>}
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
          Slider {positionIndex}
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
          <div className="grid grid-cols-3 gap-2">
            {(["min", "max", "step"] as const).map((key) => (
              <FormField
                key={key}
                control={form.control}
                name={key}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px] font-normal capitalize">{key}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        value={field.value}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          field.onChange(v);
                          commit({ [key]: v } as Partial<AttributesType>);
                        }}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            ))}
          </div>
          <FormField
            control={form.control}
            name="defaultValue"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[13px] font-normal">Valor padrão</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    value={field.value}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      field.onChange(v);
                      commit({ defaultValue: v });
                    }}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="unit"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[13px] font-normal">Unidade (opcional)</FormLabel>
                <FormControl>
                  <Input {...field} onChange={(e) => { field.onChange(e); commit({ unit: e.target.value }); }} />
                </FormControl>
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
