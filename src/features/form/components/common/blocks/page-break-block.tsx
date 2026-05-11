"use client";

import { useEffect } from "react";
import { ChevronDown, SeparatorHorizontal } from "lucide-react";
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
import { FormSettings } from "@/generated/prisma/client";
import { getContrastColor } from "@/utils/get-contrast-color";

/**
 * Page Break — separador visual entre seções de um form. Bloco DECORATIVO
 * (Layout): não captura input, não conta na barra de progresso, e não
 * aparece nas validações de "grupo completo".
 *
 * Uso típico:
 *   - Forms longos divididos em "Dados do cliente", "Dados do veículo",
 *     "Diagnóstico mecânico", etc.
 *   - Marca visual de transição mesmo em modo "tudo numa página".
 *
 * Não force quebra de step: a separação por step continua sendo no nível
 * `RowLayout` (cada grupo = um passo). Este bloco é puramente visual.
 */

const blockCategory: FormCategoryType = "Layout";
const blockType: FormBlockType = "PageBreak";

type AttributesType = {
  title: string;
  subtitle: string;
};

const propertiesValidateSchema = z.object({
  title: z.string().trim().max(255).optional(),
  subtitle: z.string().trim().max(255).optional(),
});
type PropertiesType = z.input<typeof propertiesValidateSchema>;

export const PageBreakBlock: ObjectBlockType = {
  blockType,
  blockCategory,
  createInstance: (id) => ({
    id,
    blockType,
    attributes: {
      title: "",
      subtitle: "",
    } satisfies AttributesType,
  }),
  blockBtnElement: { icon: SeparatorHorizontal, label: "Separador de página" },
  canvasComponent: PageBreakView,
  formComponent: PageBreakView,
  propertiesComponent: PropertiesView,
};

type Instance = FormBlockInstance & { attributes: AttributesType };

function PageBreakView({
  blockInstance,
  settings,
}: {
  blockInstance: FormBlockInstance;
  settings?: FormSettings | null;
}) {
  const block = blockInstance as Instance;
  const { title, subtitle } = block.attributes;

  // Cor adaptativa: usa contraste do bg do form (preto em fundo claro,
  // branco em fundo escuro). Sem bg setado → cai no `border` do tema.
  const textColor = settings?.backgroundColor
    ? getContrastColor(settings.backgroundColor)
    : undefined;
  const lineColor = textColor ? `${textColor}40` : undefined;

  // Sem título: linha simples (separador clean entre seções).
  if (!title?.trim() && !subtitle?.trim()) {
    return (
      <div className="w-full py-3" aria-hidden>
        <div
          className="border-t-2 border-dashed"
          style={lineColor ? { borderColor: lineColor } : undefined}
        />
      </div>
    );
  }

  // Com título: bloco "section header" — duas linhas com texto entre,
  // visualmente forte pra marcar transição entre seções.
  return (
    <div className="w-full py-4">
      <div className="flex items-center gap-3">
        <div
          className="flex-1 border-t-2 border-dashed"
          style={lineColor ? { borderColor: lineColor } : undefined}
        />
        <div className="text-center px-2">
          {title?.trim() && (
            <h3
              className="text-sm font-semibold uppercase tracking-wider whitespace-nowrap"
              style={textColor ? { color: textColor } : undefined}
            >
              {title}
            </h3>
          )}
          {subtitle?.trim() && (
            <p
              className="text-[11px] mt-0.5 whitespace-nowrap"
              style={
                textColor
                  ? { color: `${textColor}99` }
                  : { opacity: 0.7 }
              }
            >
              {subtitle}
            </p>
          )}
        </div>
        <div
          className="flex-1 border-t-2 border-dashed"
          style={lineColor ? { borderColor: lineColor } : undefined}
        />
      </div>
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

  useEffect(
    () => form.reset({ ...block.attributes }),
    [block.attributes, form],
  );

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
          Separador {positionIndex}
        </span>
        <ChevronDown className="w-4 h-4" />
      </div>
      <Form {...form}>
        <form
          onSubmit={(e) => e.preventDefault()}
          className="w-full space-y-3 px-4"
        >
          <p className="text-[11px] text-muted-foreground">
            Separador puramente visual. Não conta na barra de progresso e
            não bloqueia o avanço. Use para dividir seções num form longo.
          </p>

          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[13px] font-normal">
                  Título (opcional)
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="Ex: Dados do veículo"
                    onChange={(e) => {
                      field.onChange(e);
                      commit({ title: e.target.value });
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="subtitle"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[13px] font-normal">
                  Subtítulo (opcional)
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="Ex: Preencha os dados abaixo"
                    onChange={(e) => {
                      field.onChange(e);
                      commit({ subtitle: e.target.value });
                    }}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </form>
      </Form>
    </div>
  );
}
