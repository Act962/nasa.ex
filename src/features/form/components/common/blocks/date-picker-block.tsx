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
import { MultiSelectChips } from "@/features/form/components/common/multi-select-chips";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

const blockCategory: FormCategoryType = "Field";
const blockType: FormBlockType = "DatePicker";

type ResetTriggersType = {
  trackingIds?: string[];
  statusIds?: string[];
  tagIds?: string[];
  formIds?: string[];
  nextGroupIds?: string[];
};

type AttributesType = {
  label: string;
  helperText: string;
  required: boolean;
  withTime: boolean;
  /**
   * Quando true, esta data vira o "prazo" do formulário. Na listagem
   * de "Detalhes do lead > Formulários > Todos os forms" aparece um
   * countdown ao lado do botão "Abrir" mostrando "Faltam X dias HH:MM:SS".
   * Também é refletido na observação do lead pra ser visível no card
   * do tracking (kanban).
   */
  useAsDeadline: boolean;
  /**
   * "Zerar Cronômetro quando..." — quando QUALQUER um dos eventos
   * configurados acontecer (status mudou, tag adicionada, form submetido,
   * grupo alcançado), o badge do cronômetro deixa de aparecer (prazo
   * cumprido). Multi-select por categoria, lógica OR entre tudo.
   */
  resetTriggers?: ResetTriggersType;
};

const resetTriggersSchema = z
  .object({
    trackingIds: z.array(z.string()).optional(),
    statusIds: z.array(z.string()).optional(),
    tagIds: z.array(z.string()).optional(),
    formIds: z.array(z.string()).optional(),
    nextGroupIds: z.array(z.string()).optional(),
  })
  .optional();

const propertiesValidateSchema = z.object({
  label: z.string().trim().max(255).optional(),
  helperText: z.string().trim().max(255).optional(),
  required: z.boolean().default(false).optional(),
  withTime: z.boolean().default(false).optional(),
  useAsDeadline: z.boolean().default(false).optional(),
  resetTriggers: resetTriggersSchema,
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
      useAsDeadline: false,
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
              {/* Formato explícito DD/MM/YYYY a pedido do produto (10/05/26).
                  Placeholder também mostra o padrão pra orientar o usuário. */}
              {date
                ? format(date, "dd/MM/yyyy", { locale: ptBR })
                : "DD/MM/AAAA"}
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
          // O <input type="time"> já renderiza um ícone de relógio nativo
          // (lado direito no Chrome, fim do campo no Safari/Firefox). Não
          // precisa de um <Clock> extra à esquerda — dois ícones confunde
          // o user. Mantemos só o nativo, mais consistente com o calendário.
          <div className="w-36">
            <Input
              type="time"
              value={time}
              onChange={(e) => commit(date, e.target.value)}
              className="bg-transparent!"
              style={{
                // Sem textColor do tema → força preto sólido (default do
                // <input type=time> fica cinza claro e some em fundos claros).
                // Com textColor → respeita o tema do form.
                colorScheme: "light",
                color: textColor || "#000",
                borderColor: textColor ? `${textColor}40` : undefined,
              }}
            />
          </div>
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
            name="useAsDeadline"
            render={({ field }) => (
              <FormItem>
                <div className="flex flex-col gap-1.5 rounded-md border border-border/60 bg-muted/30 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <FormLabel className="text-[13px] font-normal">
                      Cronometrar a partir desta data
                    </FormLabel>
                    <FormControl>
                      <Switch
                        checked={!!field.value}
                        onCheckedChange={(v) => {
                          field.onChange(v);
                          commit({ useAsDeadline: v });
                        }}
                      />
                    </FormControl>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-tight">
                    A data preenchida vira o prazo do form. Em "Detalhes
                    do lead {">"} Formulários" aparece o countdown ("Faltam
                    HH:MM:SS") ao lado do botão "Abrir".
                  </p>
                  {field.value && (
                    <ResetTriggersSection
                      value={block.attributes.resetTriggers ?? {}}
                      onChange={(v) => commit({ resetTriggers: v })}
                      currentBlockId={block.id}
                    />
                  )}
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

/**
 * Seção "Zerar Cronômetro quando..." — aparece embaixo do toggle
 * `useAsDeadline` quando ele está ON. 5 multi-selects (Tracking, Status,
 * Tags, Próximo Formulário, Próximo Grupo). Lógica entre triggers é OR:
 * ANY um deles satisfeito → cronômetro cumprido (badge some).
 *
 * Fonte de dados:
 *  - Tracking: orpc.tracking.list (todos os trackings da org)
 *  - Status:   orpc.status.listSimple({trackingId}) — limitado ao tracking do form
 *  - Tags:     orpc.tags.listTags({query.trackingId}) — idem
 *  - Forms:    orpc.form.list (todos os forms da org, exclui o atual)
 *  - Grupos:   useBuilderStore().blockLayouts (RowLayouts do form, exclui o pai)
 */
function ResetTriggersSection({
  value,
  onChange,
  currentBlockId,
}: {
  value: ResetTriggersType;
  onChange: (v: ResetTriggersType) => void;
  currentBlockId: string;
}) {
  const { formData, blockLayouts, selectedBlockLayout } = useBuilderStore();
  const trackingId = formData?.settings?.trackingId ?? null;
  const currentFormId = formData?.id ?? null;
  // Grupo pai do DatePicker atual — não faz sentido escolher o próprio
  // grupo como "próximo grupo".
  const parentGroupId = selectedBlockLayout?.id ?? null;

  // Trackings da org
  const trackingsQ = useQuery({
    ...orpc.tracking.list.queryOptions(),
    staleTime: 5 * 60 * 1000,
  });
  // Status do tracking atual do form
  const statusQ = useQuery({
    ...orpc.status.listSimple.queryOptions({
      input: { trackingId: trackingId ?? "" },
    }),
    enabled: !!trackingId,
    staleTime: 5 * 60 * 1000,
  });
  // Tags do tracking atual
  const tagsQ = useQuery({
    ...orpc.tags.listTags.queryOptions({
      input: { query: { trackingId: trackingId ?? "" } },
    }),
    enabled: !!trackingId,
    staleTime: 5 * 60 * 1000,
  });
  // Forms da org (exclui o atual)
  const formsQ = useQuery({
    ...orpc.form.list.queryOptions({ input: {} }),
    staleTime: 5 * 60 * 1000,
  });

  // Grupos do form atual — só RowLayout, filtra fora o grupo pai.
  // Label cai pra "Grupo N" quando não tem label custom.
  const groupOptions = (blockLayouts ?? [])
    .filter((b) => b.id !== parentGroupId)
    .map((b, idx) => ({
      id: b.id,
      label:
        ((b.attributes as { label?: string } | undefined)?.label?.trim() ||
          `Grupo ${idx + 1}`),
    }));

  const trackingOptions = (
    ((trackingsQ.data as { trackings?: Array<{ id: string; name: string }> } | undefined)
      ?.trackings) ?? []
  ).map((t) => ({ id: t.id, label: t.name }));

  const statusOptions = (
    ((statusQ.data as { status?: Array<{ id: string; name: string; color?: string | null }> } | undefined)
      ?.status) ?? []
  ).map((s) => ({ id: s.id, label: s.name, color: s.color ?? null }));

  const tagOptions = (
    ((tagsQ.data as { tags?: Array<{ id: string; name: string; color?: string | null }> } | undefined)
      ?.tags) ?? []
  ).map((t) => ({ id: t.id, label: t.name, color: t.color ?? null }));

  const formOptions = (
    ((formsQ.data as { forms?: Array<{ id: string; name: string }> } | undefined)
      ?.forms) ?? []
  )
    .filter((f) => f.id !== currentFormId)
    .map((f) => ({ id: f.id, label: f.name }));

  // Helper pra atualizar uma chave preservando as outras.
  const updateKey = (
    key: keyof ResetTriggersType,
  ): ((next: string[]) => void) => {
    return (next) => {
      const merged: ResetTriggersType = { ...value, [key]: next };
      // Limpa keys vazias pra não inflar o JSON salvo.
      const cleaned: ResetTriggersType = {};
      for (const k of [
        "trackingIds",
        "statusIds",
        "tagIds",
        "formIds",
        "nextGroupIds",
      ] as Array<keyof ResetTriggersType>) {
        const arr = merged[k];
        if (arr && arr.length > 0) cleaned[k] = arr;
      }
      onChange(cleaned);
    };
  };

  // Referencia currentBlockId pra futuro uso (ex: filtrar self do formOptions
  // quando este date-picker virar um campo de form principal). Suprime
  // "declared but never used" sem mudar a API pública.
  void currentBlockId;

  return (
    <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-border/60">
      <p className="text-[11px] font-semibold text-foreground/70 uppercase tracking-wider">
        Zerar Cronômetro quando…
      </p>
      <p className="text-[11px] text-muted-foreground leading-tight">
        Qualquer um dos eventos abaixo cumpre o prazo. O badge do
        cronômetro some do card do lead.
      </p>

      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] text-muted-foreground">Tracking</label>
        <MultiSelectChips
          options={trackingOptions}
          value={value.trackingIds ?? []}
          onChange={updateKey("trackingIds")}
          placeholder="Selecione trackings…"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] text-muted-foreground">Status</label>
        <MultiSelectChips
          options={statusOptions}
          value={value.statusIds ?? []}
          onChange={updateKey("statusIds")}
          placeholder={trackingId ? "Selecione status…" : "Sem tracking no form"}
          disabled={!trackingId}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] text-muted-foreground">Tags</label>
        <MultiSelectChips
          options={tagOptions}
          value={value.tagIds ?? []}
          onChange={updateKey("tagIds")}
          placeholder={trackingId ? "Selecione tags…" : "Sem tracking no form"}
          disabled={!trackingId}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] text-muted-foreground">
          Próximo Formulário
        </label>
        <MultiSelectChips
          options={formOptions}
          value={value.formIds ?? []}
          onChange={updateKey("formIds")}
          placeholder="Selecione forms…"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] text-muted-foreground">
          Próximo Grupo (deste form)
        </label>
        <MultiSelectChips
          options={groupOptions}
          value={value.nextGroupIds ?? []}
          onChange={updateKey("nextGroupIds")}
          placeholder={
            groupOptions.length > 0
              ? "Selecione grupos…"
              : "Sem outros grupos neste form"
          }
          disabled={groupOptions.length === 0}
        />
      </div>
    </div>
  );
}
