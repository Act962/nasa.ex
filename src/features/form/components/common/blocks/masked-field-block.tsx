"use client";

import { useEffect, useState } from "react";
import {
  ChevronDown,
  Hash,
  Mail,
  MapPin,
  Phone,
  Sparkles,
} from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBuilderStore } from "@/features/form/context/builder-form-provider";
import {
  useResolvedInitialValue,
  type LeadPrefillSource,
} from "@/features/form/context/form-prefill-context";
import { useMutationValidateCep } from "@/features/form/hooks/use-form";
import { FormSettings } from "@/generated/prisma/client";
import type { FormSettingsTyped } from "@/features/form/types";
import { getContrastColor } from "@/utils/get-contrast-color";
import { validateCPF } from "@/utils/validate-data";
import {
  applyMask,
  autoCompleteFor,
  BR_STATES,
  formatLabel,
  formatPlaceholder,
  inputModeFor,
  isValidByFormat,
  isValidCep,
  type MaskedFormat,
} from "@/features/form/lib/masks";

/**
 * MaskedField — input formatado com seleção de tipo:
 *   - Telefone com DDD: máscara (##) #####-####
 *   - CPF: ###.###.###-##  (com validação de DV)
 *   - CEP: #####-###
 *   - Cidade — UF: city + UF dropdown
 *   - E-mail: validação RFC simplificada
 *
 * O tipo é configurado em "Propriedades do grupo" (PropertiesView).
 * Cada formato aplica máscara live + valida onBlur.
 *
 * Persistência:
 *   value: a string formatada (ex.: "(11) 91234-5678")
 *   meta: {
 *     format: "phone-br" | "cpf" | ...,
 *     raw: string (sem máscara, ex.: "11912345678"),
 *     isValid: boolean
 *   }
 */

const blockCategory: FormCategoryType = "Field";
const blockType: FormBlockType = "MaskedField";

type AttributesType = {
  label: string;
  helperText: string;
  required: boolean;
  placeHolder: string;
  format: MaskedFormat;
  validateCep: boolean;
  validateCpf: boolean;
  /** Vínculo com o step de identificação (spec 0006). */
  prefillFromLead?: LeadPrefillSource | null;
};

const propertiesValidateSchema = z.object({
  label: z.string().trim().max(255).optional(),
  helperText: z.string().trim().max(255).optional(),
  required: z.boolean().default(false).optional(),
  placeHolder: z.string().trim().max(255).optional(),
  format: z
    .enum(["phone-br", "cpf", "cep", "city-uf", "email"])
    .default("phone-br"),
  validateCep: z.boolean().default(false).optional(),
  validateCpf: z.boolean().default(false).optional(),
});
type PropertiesType = z.input<typeof propertiesValidateSchema>;

export const MaskedFieldBlock: ObjectBlockType = {
  blockType,
  blockCategory,
  createInstance: (id) => ({
    id,
    blockType,
    attributes: {
      label: "Telefone com DDD",
      helperText: "",
      required: false,
      placeHolder: "",
      format: "phone-br",
      validateCep: false,
      validateCpf: false,
    } satisfies AttributesType,
  }),
  blockBtnElement: { icon: Sparkles, label: "Campo formatado" },
  canvasComponent: CanvasView,
  formComponent: FormView,
  propertiesComponent: PropertiesView,
};

type Instance = FormBlockInstance & { attributes: AttributesType };

function iconFor(format: MaskedFormat) {
  switch (format) {
    case "phone-br":
      return Phone;
    case "cpf":
      return Hash;
    case "cep":
    case "city-uf":
      return MapPin;
    case "email":
      return Mail;
  }
}

// ─── Canvas ─────────────────────────────────────────────────────────────
function CanvasView({ blockInstance }: { blockInstance: FormBlockInstance }) {
  const block = blockInstance as Instance;
  const { label, required, helperText, format, placeHolder } = block.attributes;
  const Icon = iconFor(format);
  return (
    <div className="flex flex-col gap-2 w-full">
      {label?.trim() && (
        <Label className="text-base font-normal! mb-2 whitespace-normal break-words leading-snug">
          {label}
          {required && <span className="text-red-500"> *</span>}
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground ml-2">
            {formatLabel(format)}
          </span>
        </Label>
      )}
      <div className="relative pointer-events-none">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          readOnly
          value=""
          placeholder={placeHolder || formatPlaceholder(format)}
          className="pl-9"
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

// ─── FormView ───────────────────────────────────────────────────────────
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
  const {
    label,
    required,
    helperText,
    placeHolder,
    format,
    validateCep,
    validateCpf,
  } = block.attributes;
  const textColor = settings?.backgroundColor
    ? getContrastColor(settings.backgroundColor)
    : undefined;
  const Icon = iconFor(format);
  const shouldCheckCep = format === "cep" && !!validateCep;
  const shouldCheckCpf = format === "cpf" && !!validateCpf;
  const validateCepMutation = useMutationValidateCep();

  // CPF: checagem síncrona (dígito verificador) — ao contrário do CEP não
  // depende de rede, então não precisa de estado "checking"/mutation.
  function cpfExistsFor(formatted: string): boolean | undefined {
    if (!shouldCheckCpf) return undefined;
    const digits = formatted.replace(/\D/g, "");
    if (digits.length !== 11) return undefined;
    return validateCPF(formatted);
  }

  // Prefill: o valor salvo já está formatado (ex.: "(11) 91234-5678").
  // Ordem: resposta salva → identificação → vazio (spec 0006, D-3). O valor
  // vindo da identificação passa pela máscara do bloco, já que chega como
  // digitado no step 1 e com DDI (RF-8).
  const { initialValue: rawPrefill, identityValue: rawIdentityValue } =
    useResolvedInitialValue(
      block.id,
      block.attributes.prefillFromLead ?? null,
    );
  const identityValue =
    rawIdentityValue === undefined
      ? undefined
      : applyMask(format, rawIdentityValue);
  const prefill =
    rawPrefill === rawIdentityValue && rawPrefill !== undefined
      ? identityValue
      : rawPrefill;

  // City-UF: armazenamos como "Cidade - UF" no value. Separa pra UI.
  const initialCity = (() => {
    if (format !== "city-uf" || !prefill) return "";
    const idx = prefill.lastIndexOf(" - ");
    return idx >= 0 ? prefill.slice(0, idx) : prefill;
  })();
  const initialUf = (() => {
    if (format !== "city-uf" || !prefill) return "";
    const idx = prefill.lastIndexOf(" - ");
    return idx >= 0 ? prefill.slice(idx + 3) : "";
  })();

  const [value, setValue] = useState<string>(prefill ?? "");
  const [city, setCity] = useState<string>(initialCity);
  const [uf, setUf] = useState<string>(initialUf);
  const [touched, setTouched] = useState(false);
  const [cepStatus, setCepStatus] = useState<
    "idle" | "checking" | "valid" | "invalid"
  >("idle");

  // Propaga prefill no mount.
  useEffect(() => {
    if (prefill && handleBlur) {
      const prefillCpfExists = cpfExistsFor(prefill);
      handleBlur(block.id, {
        value: prefill,
        meta: {
          format,
          raw: prefill.replace(/\D/g, ""),
          isValid: isValidByFormat(format, prefill),
          ...(prefillCpfExists !== undefined && { cpfExists: prefillCpfExists }),
        },
      });
      if (shouldCheckCep) void runCepCheck(prefill);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Acompanha a identificação enquanto o campo não foi editado (spec 0006,
  // D-4). `touched` já existia neste bloco e marca interação do usuário.
  useEffect(() => {
    if (touched) return;
    if (identityValue === undefined) return;
    commit(identityValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identityValue]);

  function commit(formatted: string) {
    setValue(formatted);
    // Novo valor precisa ser re-verificado no ViaCEP; invalida o status atual.
    if (shouldCheckCep) setCepStatus("idle");
    const cpfExists = cpfExistsFor(formatted);
    handleBlur?.(block.id, {
      value: formatted,
      meta: {
        format,
        raw: formatted.replace(/\D/g, ""),
        isValid: isValidByFormat(format, formatted),
        ...(cpfExists !== undefined && { cpfExists }),
      },
    });
  }

  // Checa no ViaCEP se o CEP existe. Fail-open: `skipped` (ViaCEP indisponível)
  // conta como existente pra não travar o lead.
  async function runCepCheck(cepValue: string) {
    if (!shouldCheckCep || !isValidCep(cepValue)) return;
    setCepStatus("checking");
    try {
      const { status } = await validateCepMutation.mutateAsync({ cep: cepValue });
      const hasCepExists = status !== "invalid";
      setCepStatus(hasCepExists ? "valid" : "invalid");
      handleBlur?.(block.id, {
        value: cepValue,
        meta: {
          format,
          raw: cepValue.replace(/\D/g, ""),
          isValid: isValidByFormat(format, cepValue),
          cepExists: hasCepExists,
        },
      });
    } catch {
      // Erro inesperado no transporte → fail-open (não bloqueia o envio).
      setCepStatus("valid");
      handleBlur?.(block.id, {
        value: cepValue,
        meta: {
          format,
          raw: cepValue.replace(/\D/g, ""),
          isValid: isValidByFormat(format, cepValue),
          cepExists: true,
        },
      });
    }
  }

  function commitCityUf(nextCity: string, nextUf: string) {
    setCity(nextCity);
    setUf(nextUf);
    const composed =
      nextCity.trim() && nextUf ? `${nextCity.trim()} - ${nextUf}` : "";
    handleBlur?.(block.id, {
      value: composed,
      meta: { format, city: nextCity, uf: nextUf, isValid: !!composed },
    });
  }

  const localInvalid =
    touched && required && value.length > 0 && !isValidByFormat(format, value);
  const cepNotFound = shouldCheckCep && cepStatus === "invalid";
  const cpfNotFound = shouldCheckCpf && cpfExistsFor(value) === false;
  const isError = localInvalid || cepNotFound || cpfNotFound || isSubmitError;

  // ── city-uf tem layout próprio ────────────────────────────────────────
  if (format === "city-uf") {
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
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Icon
              className="absolute left-3 top-1/2 -translate-y-1/2 size-4 pointer-events-none"
              style={{ color: textColor || undefined, opacity: 0.6 }}
            />
            <Input
              type="text"
              autoComplete="address-level2"
              placeholder={placeHolder || "São Paulo"}
              className={`pl-9 bg-transparent! ${isError ? "border-red-500!" : ""}`}
              style={{
                color: textColor || undefined,
                borderColor: textColor ? `${textColor}40` : undefined,
              }}
              value={city}
              onChange={(e) => commitCityUf(e.target.value, uf)}
              onBlur={() => setTouched(true)}
            />
          </div>
          <Select value={uf} onValueChange={(v) => commitCityUf(city, v)}>
            <SelectTrigger
              className={`w-24 bg-transparent! ${isError ? "border-red-500!" : ""}`}
              style={{
                color: textColor || undefined,
                borderColor: textColor ? `${textColor}40` : undefined,
              }}
            >
              <SelectValue placeholder="UF" />
            </SelectTrigger>
            <SelectContent>
              {BR_STATES.map((s) => (
                <SelectItem key={s.uf} value={s.uf}>
                  {s.uf} — {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
        {isError && (
          <p className="text-red-500 text-[0.8rem] break-words whitespace-normal">
            {errorMessage || "Informe cidade e estado."}
          </p>
        )}
      </div>
    );
  }

  // ── Demais formatos: input único com máscara/validação ────────────────
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
        <Icon
          className="absolute left-3 top-1/2 -translate-y-1/2 size-4 pointer-events-none"
          style={{ color: textColor || undefined, opacity: 0.6 }}
        />
        <Input
          type={format === "email" ? "email" : "text"}
          inputMode={inputModeFor(format)}
          autoComplete={autoCompleteFor(format)}
          placeholder={placeHolder || formatPlaceholder(format)}
          className={`pl-9 bg-transparent! ${isError ? "border-red-500!" : ""}`}
          style={{
            color: textColor || undefined,
            borderColor: textColor ? `${textColor}40` : undefined,
          }}
          value={value}
          onChange={(e) => {
            // Marca edição já no digitar (não só no blur), senão uma mudança
            // na identificação sobrescreveria o que está sendo digitado.
            setTouched(true);
            commit(applyMask(format, e.target.value));
          }}
          onBlur={() => {
            setTouched(true);
            void runCepCheck(value);
          }}
        />
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
          {validationMessageFor(format)}
        </p>
      )}
      {shouldCheckCep && cepStatus === "checking" && (
        <p
          className="text-[0.8rem] break-words whitespace-normal"
          style={{
            color: textColor ? `${textColor}99` : undefined,
            opacity: textColor ? undefined : 0.7,
          }}
        >
          Verificando CEP…
        </p>
      )}
      {cepNotFound && !localInvalid && (
        <p className="text-red-500 text-[0.8rem] break-words whitespace-normal">
          CEP não encontrado
        </p>
      )}
      {cpfNotFound && !localInvalid && (
        <p className="text-red-500 text-[0.8rem] break-words whitespace-normal">
          CPF inválido
        </p>
      )}
      {isSubmitError && !localInvalid && !cepNotFound && !cpfNotFound && (
        <p className="text-red-500 text-[0.8rem] break-words whitespace-normal">
          {errorMessage || "Campo inválido."}
        </p>
      )}
    </div>
  );
}

function validationMessageFor(format: MaskedFormat): string {
  switch (format) {
    case "phone-br":
      return "Telefone inválido — use DDD + número (ex: (11) 91234-5678)";
    case "cpf":
      return "CPF inválido";
    case "cep":
      return "CEP inválido — use o formato 00000-000";
    case "email":
      return "E-mail inválido";
    case "city-uf":
      return "Informe cidade e estado";
  }
}

// ─── Properties ─────────────────────────────────────────────────────────
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
          Campo formatado {positionIndex}
        </span>
        <ChevronDown className="w-4 h-4" />
      </div>
      <Form {...form}>
        <form
          onSubmit={(e) => e.preventDefault()}
          className="w-full space-y-3 px-4"
        >
          {/* Tipo de máscara — peça central deste bloco */}
          <FormField
            control={form.control}
            name="format"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[13px] font-normal">
                  Tipo do campo
                </FormLabel>
                <Select
                  value={field.value}
                  onValueChange={(v) => {
                    const next = v as MaskedFormat;
                    field.onChange(next);
                    // Atualiza label e placeholder pra defaults sensatos
                    // se o user ainda não personalizou.
                    const currentLabel = block.attributes.label?.trim();
                    const isDefaultLabel =
                      !currentLabel ||
                      ["Telefone com DDD", "CPF", "CEP", "Cidade — UF", "E-mail", "Campo"].includes(
                        currentLabel,
                      );
                    commit({
                      format: next,
                      ...(isDefaultLabel && { label: formatLabel(next) }),
                    });
                  }}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="phone-br">
                      <div className="flex items-center gap-2">
                        <Phone className="size-3.5" />
                        Telefone com DDD
                      </div>
                    </SelectItem>
                    <SelectItem value="cpf">
                      <div className="flex items-center gap-2">
                        <Hash className="size-3.5" />
                        CPF
                      </div>
                    </SelectItem>
                    <SelectItem value="cep">
                      <div className="flex items-center gap-2">
                        <MapPin className="size-3.5" />
                        CEP
                      </div>
                    </SelectItem>
                    <SelectItem value="city-uf">
                      <div className="flex items-center gap-2">
                        <MapPin className="size-3.5" />
                        Cidade — UF
                      </div>
                    </SelectItem>
                    <SelectItem value="email">
                      <div className="flex items-center gap-2">
                        <Mail className="size-3.5" />
                        E-mail
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

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
                    placeholder={formatPlaceholder(block.attributes.format)}
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

          {block.attributes.format === "cep" && (
            <FormField
              control={form.control}
              name="validateCep"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between gap-2">
                    <FormLabel className="text-[13px] font-normal">
                      Validar se o CEP existe
                    </FormLabel>
                    <FormControl>
                      <Switch
                        checked={!!field.value}
                        onCheckedChange={(v) => {
                          field.onChange(v);
                          commit({ validateCep: v });
                        }}
                      />
                    </FormControl>
                  </div>
                </FormItem>
              )}
            />
          )}

          {block.attributes.format === "cpf" && (
            <FormField
              control={form.control}
              name="validateCpf"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between gap-2">
                    <FormLabel className="text-[13px] font-normal">
                      Validar se o CPF existe
                    </FormLabel>
                    <FormControl>
                      <Switch
                        checked={!!field.value}
                        onCheckedChange={(v) => {
                          field.onChange(v);
                          commit({ validateCpf: v });
                        }}
                      />
                    </FormControl>
                  </div>
                </FormItem>
              )}
            />
          )}
        </form>
      </Form>
    </div>
  );
}
