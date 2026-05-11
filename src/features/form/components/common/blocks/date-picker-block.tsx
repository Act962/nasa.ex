import { useEffect, useState } from "react";
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useBuilderStore } from "@/features/form/context/builder-form-provider";
import { FormSettings } from "@/generated/prisma/client";
import { getContrastColor } from "@/utils/get-contrast-color";
import { usePrefillValue } from "@/features/form/context/form-prefill-context";

const blockCategory: FormCategoryType = "Field";
const blockType: FormBlockType = "DatePicker";

type AttributesType = {
  label: string;
  helperText: string;
  required: boolean;
  withTime: boolean;
};

const propertiesValidateSchema = z.object({
  label: z.string().trim().max(255).optional(),
  helperText: z.string().trim().max(255).optional(),
  required: z.boolean().default(false).optional(),
  withTime: z.boolean().default(false).optional(),
});
type PropertiesType = z.input<typeof propertiesValidateSchema>;

export const DatePickerBlock: ObjectBlockType = {
  blockType,
  blockCategory,
  createInstance: (id) => ({
    id,
    blockType,
    attributes: {
      label: "Data",
      helperText: "",
      required: false,
      withTime: false,
    } satisfies AttributesType,
  }),
  blockBtnElement: { icon: CalendarIcon, label: "Data" },
  canvasComponent: CanvasView,
  formComponent: FormView,
  propertiesComponent: PropertiesView,
};

type Instance = FormBlockInstance & { attributes: AttributesType };

function CanvasView({ blockInstance }: { blockInstance: FormBlockInstance }) {
  const { label, required, helperText } = (blockInstance as Instance).attributes;
  return (
    <div className="flex flex-col gap-2 w-full">
      {label?.trim() && (

        <Label className="text-base font-normal! mb-2 whitespace-normal break-words leading-snug">

          {label}

          {required && <span className="text-red-500"> *</span>}

        </Label>

      )}
      <Button
        type="button"
        variant="outline"
        className="justify-start font-normal pointer-events-none"
      >
        <CalendarIcon className="mr-2 h-4 w-4" />
        Selecione uma data
      </Button>
      {helperText && <p className="text-[0.8rem] text-muted-foreground break-words whitespace-normal">{helperText}</p>}
    </div>
  );
}

function FormView({
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
  const block = blockInstance as Instance;
  const { label, required, helperText, withTime } = block.attributes;

  // Cor do texto que contrasta com o fundo do form (preto se fundo claro,
  // branco se fundo escuro). Aplicada com `!important` no trigger pra
  // sobrepor a herança do `color` do form wrapper, e mantida fixa no hover.
  const textColor = settings?.backgroundColor
    ? getContrastColor(settings.backgroundColor)
    : undefined;

  // Prefill: a resposta salva é "yyyy-MM-dd" (sem time) ou
  // "yyyy-MM-ddTHH:mm" (com time). Reconstruímos Date/string a partir disso.
  const prefill = usePrefillValue(block.id);
  const [datePart, timePart] = prefill ? prefill.split("T") : ["", ""];
  const initialDate = datePart
    ? (() => {
        // Constroi Date local a partir de "yyyy-MM-dd" pra evitar shift de
        // fuso (new Date("2026-05-08") é UTC e pode virar dia 7 no BR).
        const [y, m, d] = datePart.split("-").map(Number);
        if (!y || !m || !d) return undefined;
        return new Date(y, m - 1, d);
      })()
    : undefined;
  const [date, setDate] = useState<Date | undefined>(initialDate);
  const [time, setTime] = useState<string>(timePart || "");
  const [isError, setIsError] = useState(false);
  useEffect(() => {
    if (prefill && handleBlur) {
      handleBlur(block.id, { value: prefill, meta: { iso: prefill } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function commit(d: Date | undefined, t: string) {
    setDate(d);
    setTime(t);
    let value = "";
    if (d) {
      const tt = withTime && t ? t : "";
      value = withTime && tt
        ? `${format(d, "yyyy-MM-dd")}T${tt}`
        : format(d, "yyyy-MM-dd");
    }
    const isValid = !required || !!value;
    setIsError(!isValid);
    handleBlur?.(block.id, { value, meta: { iso: value } });
  }

  return (
    <div className="flex flex-col gap-2 w-full">
      {label?.trim() && (
        <Label className={`text-base font-normal! mb-2 whitespace-normal break-words leading-snug ${isError || isSubmitError ? "text-red-500" : ""}`}>
          {label}
          {required && <span className="text-red-500"> *</span>}
        </Label>
      )}
      {/* `<style>` injetado no escopo do form pra forçar a cor do texto do
          trigger no hover, sobrepondo o `hover:text-accent-foreground` do
          shadcn-button outline (que poderia escurecer/clarear de forma
          inadequada vs. o fundo do form). */}
      {textColor && (
        <style>{`[data-date-trigger]:hover { color: ${textColor} !important; }`}</style>
      )}
      <div className="flex gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              data-date-trigger
              className={`justify-start font-normal flex-1 bg-transparent! hover:bg-foreground/10! ${
                isError || isSubmitError ? "border-red-500!" : ""
              }`}
              style={{
                color: textColor || undefined,
                borderColor: textColor ? `${textColor}40` : undefined,
              }}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date ? format(date, "PPP", { locale: ptBR }) : "Selecione uma data"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(d) => commit(d, time)}
              locale={ptBR}
              autoFocus
            />
          </PopoverContent>
        </Popover>
        {withTime && (
          <Input
            type="time"
            className="w-32 bg-transparent!"
            style={{
              color: textColor || undefined,
              borderColor: textColor ? `${textColor}40` : undefined,
            }}
            value={time}
            onChange={(e) => commit(date, e.target.value)}
          />
        )}
      </div>
      {helperText && <p className="text-[0.8rem] text-muted-foreground break-words whitespace-normal">{helperText}</p>}
      {(isError || isSubmitError) && (
        <p className="text-red-500 text-[0.8rem] break-words whitespace-normal">{errorMessage || "Selecione uma data."}</p>
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
          Data {positionIndex}
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
          <FormField
            control={form.control}
            name="withTime"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between gap-2">
                  <FormLabel className="text-[13px] font-normal">Inclui hora</FormLabel>
                  <FormControl>
                    <Switch checked={!!field.value} onCheckedChange={(v) => { field.onChange(v); commit({ withTime: v }); }} />
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
