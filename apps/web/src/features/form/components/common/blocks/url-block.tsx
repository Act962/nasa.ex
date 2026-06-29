"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ExternalLink, Link as LinkIcon } from "lucide-react";
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
import { useBuilderStore } from "@/features/form/context/builder-form-provider";
import { usePrefillValue } from "@/features/form/context/form-prefill-context";
import { FormSettings } from "@/generated/prisma/client";
import type { FormSettingsTyped } from "@/features/form/types";
import { getContrastColor } from "@/utils/get-contrast-color";

/**
 * Url field — input pra coleta de URLs (links externos, redes sociais,
 * referência de documento, etc.). Valida formato URL básico (precisa de
 * protocolo) quando required, e oferece um botão "abrir" pra que o
 * consultor (em modo edit) possa visitar o link rapidamente.
 *
 * Persistência:
 *   value: "https://exemplo.com/pagina"
 *   meta: { isValid: true }
 */

const blockCategory: FormCategoryType = "Field";
const blockType: FormBlockType = "Url";

type AttributesType = {
  label: string;
  helperText: string;
  required: boolean;
  placeHolder: string;
};

const propertiesValidateSchema = z.object({
  label: z.string().trim().max(255).optional(),
  helperText: z.string().trim().max(255).optional(),
  required: z.boolean().default(false).optional(),
  placeHolder: z.string().trim().max(255).optional(),
});
type PropertiesType = z.input<typeof propertiesValidateSchema>;

export const UrlBlock: ObjectBlockType = {
  blockType,
  blockCategory,
  createInstance: (id) => ({
    id,
    blockType,
    attributes: {
      label: "Link",
      helperText: "",
      required: false,
      placeHolder: "https://exemplo.com",
    } satisfies AttributesType,
  }),
  blockBtnElement: { icon: LinkIcon, label: "URL" },
  canvasComponent: CanvasView,
  formComponent: FormView,
  propertiesComponent: PropertiesView,
};

type Instance = FormBlockInstance & { attributes: AttributesType };

// ─── Validação ──────────────────────────────────────────────────────────
function isValidUrl(value: string): boolean {
  if (!value) return false;
  try {
    // Aceita apenas http(s) explícitos. URLs sem protocolo costumam quebrar
    // em redirects e tracking, então preferimos rejeitar.
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

// ─── Canvas (preview no builder) ────────────────────────────────────────
function CanvasView({ blockInstance }: { blockInstance: FormBlockInstance }) {
  const block = blockInstance as Instance;
  const { label, required, helperText, placeHolder } = block.attributes;
  return (
    <div className="flex flex-col gap-2 w-full">
      {label?.trim() && (
        <Label className="text-base font-normal! mb-2 whitespace-normal break-words leading-snug">
          {label}
          {required && <span className="text-red-500"> *</span>}
        </Label>
      )}
      <div className="relative pointer-events-none">
        <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          readOnly
          placeholder={placeHolder}
          className="pl-9"
          value=""
        />
      </div>
      {helperText && (
        <p className="text-[0.8rem] text-muted-foreground break-words whitespace-normal">
          {helperText}
        </p>
      )}
    </div>
  );
}

// ─── FormView (público + edit) ──────────────────────────────────────────
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
  settings?: FormSettings | FormSettingsTyped | null;
}) {
  const block = blockInstance as Instance;
  const { label, required, helperText, placeHolder } = block.attributes;

  const textColor = settings?.backgroundColor
    ? getContrastColor(settings.backgroundColor)
    : undefined;

  // Prefill: URL salva é uma string direta.
  const prefill = usePrefillValue(block.id);
  const [value, setValue] = useState(prefill ?? "");
  const [touched, setTouched] = useState(false);

  // Propaga prefill no mount (mantém formVals atualizado mesmo sem interação).
  useEffect(() => {
    if (prefill && handleBlur) {
      handleBlur(block.id, {
        value: prefill,
        meta: { isValid: isValidUrl(prefill) },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const localInvalid = touched && required && value.length > 0 && !isValidUrl(value);
  const isError = localInvalid || isSubmitError;

  function commit(v: string) {
    setValue(v);
    handleBlur?.(block.id, {
      value: v,
      meta: { isValid: isValidUrl(v) },
    });
  }

  return (
    <div className="flex flex-col gap-2 w-full">
      {label?.trim() && (
        <Label
          className={`text-base font-normal! mb-2 whitespace-normal break-words leading-snug ${
            isError ? "text-red-500" : ""
          }`}
        >
          {label}
          {required && <span className="text-red-500"> *</span>}
        </Label>
      )}
      <div className="relative">
        <LinkIcon
          className="absolute left-3 top-1/2 -translate-y-1/2 size-4 pointer-events-none"
          style={{ color: textColor || undefined, opacity: 0.6 }}
        />
        <Input
          type="url"
          inputMode="url"
          autoComplete="url"
          placeholder={placeHolder || "https://exemplo.com"}
          className={`pl-9 bg-transparent! ${
            isError ? "border-red-500!" : ""
          } ${value && isValidUrl(value) ? "pr-10" : ""}`}
          style={{
            color: textColor || undefined,
            borderColor: textColor ? `${textColor}40` : undefined,
          }}
          value={value}
          onChange={(e) => commit(e.target.value)}
          onBlur={() => setTouched(true)}
        />
        {/* Atalho pra abrir o link em nova aba quando válido. Útil no modo
            edit pra o consultor visitar a URL salva sem perder o estado
            do formulário. */}
        {value && isValidUrl(value) && (
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-foreground/10 transition-colors"
            style={{ color: textColor || undefined }}
            title="Abrir link em nova aba"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="size-4" />
          </a>
        )}
      </div>
      {helperText && (
        <p
          className="text-[0.8rem] break-words whitespace-normal"
          style={{
            color: textColor ? `${textColor}99` : undefined,
            opacity: textColor ? undefined : 0.7,
          }}
        >
          {helperText}
        </p>
      )}
      {localInvalid && (
        <p className="text-red-500 text-[0.8rem] break-words whitespace-normal">
          URL inválida — use o formato https://...
        </p>
      )}
      {isSubmitError && !localInvalid && (
        <p className="text-red-500 text-[0.8rem] break-words whitespace-normal">
          {errorMessage || "Informe um link válido."}
        </p>
      )}
    </div>
  );
}

// ─── Properties (sidebar do builder) ────────────────────────────────────
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
          URL {positionIndex}
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
            name="placeHolder"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[13px] font-normal">
                  Placeholder
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    onChange={(e) => {
                      field.onChange(e);
                      commit({ placeHolder: e.target.value });
                    }}
                  />
                </FormControl>
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
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="required"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between gap-2">
                  <FormLabel className="text-[13px] font-normal">
                    Obrigatório
                  </FormLabel>
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
        </form>
      </Form>
    </div>
  );
}
