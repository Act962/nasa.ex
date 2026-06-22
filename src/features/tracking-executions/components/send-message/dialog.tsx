import { Uploader } from "@/components/file-uploader/uploader";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useQueryInstances } from "@/features/tracking-settings/hooks/use-integration";
import { cn } from "@/lib/utils";
import { countries } from "@/types/some";
import { phoneMask } from "@/utils/format-phone";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDownIcon, InfoIcon } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";

import { VariablePicker } from "./variable-picker";
import { useVariableAutocomplete } from "./use-variable-autocomplete";
import { useAiButtonPresets } from "@/features/tracking-settings/hooks/use-ai-button-presets";
import { useTags } from "@/features/tags/hooks/use-tags";

/* ---------- TARGET ---------- */

const leadTargetSchema = z.object({
  sendMode: z.literal("LEAD"),
  code: z.string().optional(),
});

const customTargetSchema = z.object({
  sendMode: z.literal("CUSTOM"),
  code: z.string().optional(),
  phone: z.string().min(1, "Telefone inválido"),
});

const targetSchema = z.discriminatedUnion("sendMode", [
  leadTargetSchema,
  customTargetSchema,
]);

/* ---------- PAYLOAD ---------- */

const textPayloadSchema = z.object({
  type: z.literal("TEXT"),
  message: z.string().min(1, "Mensagem é obrigatória"),
});

const imagePayloadSchema = z.object({
  type: z.literal("IMAGE"),
  imageUrl: z.string("URL inválida").min(1, "URL inválida"),
  caption: z.string().optional(),
});

const documentPayloadSchema = z.object({
  type: z.literal("DOCUMENT"),
  documentUrl: z.string("URL inválida").min(1, "URL inválida"),
  fileName: z.string().min(1, "Nome do arquivo obrigatório"),
  caption: z.string().optional(),
});

/**
 * BUTTONS: WhatsApp interactive menu com até 3 botões. Dois modos:
 *  - "preset"  → usa `presetId` de AiButtonPreset já configurado em
 *                Chatbot IA → Presets de botões (tracking-scoped)
 *  - "inline"  → user define bodyText/footerText/buttons aqui mesmo
 *
 * No runtime, o executor resolve: se `presetId` setado, lê preset do DB;
 * senão usa os campos inline.
 */
const buttonItemSchema = z.object({
  text: z.string().min(1, "Texto do botão obrigatório"),
  id: z.string().min(1, "Identificador obrigatório"),
  tagId: z.string().optional(),
});

const buttonsPayloadSchema = z
  .object({
    type: z.literal("BUTTONS"),
    mode: z.enum(["preset", "inline"]).default("preset"),
    presetId: z.string().optional(),
    bodyText: z.string().optional(),
    footerText: z.string().optional(),
    buttons: z.array(buttonItemSchema).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.mode === "preset") {
      if (!val.presetId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Selecione um preset",
          path: ["presetId"],
        });
      }
    } else {
      if (!val.bodyText || val.bodyText.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Texto principal obrigatório",
          path: ["bodyText"],
        });
      }
      if (!val.buttons || val.buttons.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Adicione ao menos 1 botão",
          path: ["buttons"],
        });
      }
      if (val.buttons && val.buttons.length > 9) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Máximo 9 botões",
          path: ["buttons"],
        });
      }
    }
  });

const payloadSchema = z.discriminatedUnion("type", [
  textPayloadSchema,
  imagePayloadSchema,
  documentPayloadSchema,
  buttonsPayloadSchema,
]);

/* ---------- FORM ---------- */

export const formSchema = z.object({
  target: targetSchema,
  payload: payloadSchema,
});
export type SendMessageFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: SendMessageFormValues) => void;
  defaultValues?: Partial<SendMessageFormValues>;
}

const VariableTextarea = ({ value, onChange, ...props }: any) => {
  const {
    open,
    setOpen,
    search,
    setSearch,
    inputRef,
    handleKeyDown,
    handleSelect,
    handleValueChange,
  } = useVariableAutocomplete(value || "", onChange);

  return (
    <div className="relative">
      <Textarea
        {...props}
        ref={inputRef as any}
        value={value || ""}
        onChange={handleValueChange}
        onKeyDown={handleKeyDown}
      />
      <div className="absolute top-0 left-0">
        <VariablePicker
          open={open}
          onOpenChange={setOpen}
          search={search}
          onSearchChange={setSearch}
          onSelect={handleSelect}
          triggerRef={inputRef}
        />
      </div>
    </div>
  );
};

const VariableInput = ({ value, onChange, ...props }: any) => {
  const {
    open,
    setOpen,
    search,
    setSearch,
    inputRef,
    handleKeyDown,
    handleSelect,
    handleValueChange,
  } = useVariableAutocomplete(value || "", onChange);

  return (
    <div className="relative">
      <Input
        {...props}
        ref={inputRef as any}
        value={value || ""}
        onChange={handleValueChange}
        onKeyDown={handleKeyDown}
      />
      <div className="absolute top-0 left-0">
        <VariablePicker
          open={open}
          onOpenChange={setOpen}
          search={search}
          onSearchChange={setSearch}
          onSelect={handleSelect}
          triggerRef={inputRef}
        />
      </div>
    </div>
  );
};

// ─── ButtonsPayloadFields ──────────────────────────────────────────────
// Form fields pra payload BUTTONS — duas abas: preset existente (picker)
// ou inline (texto + botões dinâmicos). Reusa a mesma estrutura da aba
// "Presets de botões" em Chatbot IA, incluindo `useFieldArray` pra o
// botão "+ Adicionar" funcionar de fato.
//
// Limite máximo: 9 botões. (WhatsApp nativo aceita 3 buttons inline, mas
// uazapi serializa como "lista" quando passa de 3 — usuário paga essa
// flexibilidade aqui.)
const MAX_BUTTONS = 9;

function ButtonsPayloadFields({
  trackingId,
  form,
}: {
  trackingId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: any;
}) {
  const { presets, isLoadingPresets } = useAiButtonPresets(trackingId);
  const { tags } = useTags({ trackingId });

  // useFieldArray = padrão correto pra arrays dinâmicos no react-hook-form.
  // Lida com add/update/remove + re-renders sem precisar do watch manual
  // (que não dispara render confiável quando o path é de um discriminated
  // union member).
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "payload.buttons",
  });

  // Watch via Controller-style — usar Controller no `payload.mode` em vez
  // de form.setValue+watch direto. Isso garante que o RHF re-renderize o
  // componente quando o select muda (especialmente em discriminated
  // unions onde o path "payload.mode" não está registrado por outro
  // Controller). Bug anterior: trocar pra Inline não fazia render dos
  // campos inline.
  const modeWatched = form.watch("payload.mode");
  const mode: "preset" | "inline" =
    modeWatched === "inline" ? "inline" : "preset";

  const addButton = () => {
    if (fields.length >= MAX_BUTTONS) return;
    append({
      text: "",
      id:
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `btn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    });
  };

  return (
    <div className="space-y-3">
      {/* Modo: Preset OU Inline */}
      <Controller
        control={form.control}
        name="payload.mode"
        defaultValue="preset"
        render={({ field }) => (
          <Field>
            <FieldLabel>Origem do menu</FieldLabel>
            <Select
              value={field.value ?? "preset"}
              onValueChange={(v) => field.onChange(v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="preset">
                  Preset existente (Chatbot IA → Presets de botões)
                </SelectItem>
                <SelectItem value="inline">
                  Inline (digitar aqui agora)
                </SelectItem>
              </SelectContent>
            </Select>
          </Field>
        )}
      />

      {mode === "preset" && (
        <Controller
          control={form.control}
          name="payload.presetId"
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel>Preset</FieldLabel>
              <Select
                value={field.value ?? ""}
                onValueChange={field.onChange}
                disabled={isLoadingPresets || presets.length === 0}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      isLoadingPresets
                        ? "Carregando..."
                        : presets.length === 0
                          ? "Nenhum preset cadastrado"
                          : "Escolha um preset"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {presets.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError errors={[fieldState.error]} />
              {presets.length === 0 && !isLoadingPresets && (
                <FieldDescription>
                  Cadastre presets em{" "}
                  <Link
                    href={`/tracking/${trackingId}/settings?tab=chatbot-ia&iaTab=buttons`}
                    className="underline"
                  >
                    Chatbot IA → Presets de botões
                  </Link>
                  .
                </FieldDescription>
              )}
            </Field>
          )}
        />
      )}

      {mode === "inline" && (
        <>
          <Controller
            control={form.control}
            name="payload.bodyText"
            render={({ field, fieldState }) => (
              <Field>
                <FieldLabel>Texto principal</FieldLabel>
                <Textarea
                  {...field}
                  value={field.value ?? ""}
                  placeholder="Pergunta ou contexto antes dos botões"
                  rows={3}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Controller
            control={form.control}
            name="payload.footerText"
            render={({ field }) => (
              <Field>
                <FieldLabel>Rodapé (opcional)</FieldLabel>
                <Input
                  {...field}
                  value={field.value ?? ""}
                  placeholder="Texto pequeno embaixo dos botões"
                />
              </Field>
            )}
          />
          <Field>
            <FieldLabel>
              Botões ({fields.length}/{MAX_BUTTONS})
            </FieldLabel>
            <div className="space-y-2">
              {fields.map((fieldItem, i) => (
                <div key={fieldItem.id} className="flex gap-2">
                  <Controller
                    control={form.control}
                    name={`payload.buttons.${i}.text` as const}
                    render={({ field }) => (
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        placeholder="Texto do botão"
                        className="flex-1"
                      />
                    )}
                  />
                  <Controller
                    control={form.control}
                    name={`payload.buttons.${i}.id` as const}
                    render={({ field }) => (
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        placeholder="ID (interno)"
                        className="w-32"
                      />
                    )}
                  />
                  <Controller
                    control={form.control}
                    name={`payload.buttons.${i}.tagId` as const}
                    render={({ field }) => (
                      <Select
                        value={field.value ?? ""}
                        onValueChange={(v) =>
                          field.onChange(v === "__none__" ? undefined : v)
                        }
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue placeholder="Tag (opcional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Sem tag</SelectItem>
                          {tags.map((tag) => (
                            <SelectItem key={tag.id} value={tag.id}>
                              <span
                                className="inline-block w-2 h-2 rounded-full mr-1 shrink-0"
                                style={{
                                  backgroundColor: tag.color ?? "#1447e6",
                                }}
                              />
                              {tag.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => remove(i)}
                    aria-label="Remover botão"
                  >
                    ×
                  </Button>
                </div>
              ))}
              {fields.length < MAX_BUTTONS && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addButton}
                >
                  + Adicionar botão
                </Button>
              )}
              {fields.length === 0 && (
                <FieldDescription>
                  Clique em "+ Adicionar botão" pra começar.
                </FieldDescription>
              )}
            </div>
          </Field>
        </>
      )}
    </div>
  );
}

export const SendMessageDialog = ({
  open,
  onOpenChange,
  onSubmit,
  defaultValues,
}: Props) => {
  const { trackingId } = useParams<{ trackingId: string }>();

  // Input ≠ Output por causa do `.default("preset")` em payload.mode: na
  // entrada `mode` é opcional, na saída é obrigatório. Parametrizamos o
  // useForm com <input, ctx, output> pra casar o resolver (input) com o
  // handleSubmit (output = SendMessageFormValues).
  const form = useForm<z.input<typeof formSchema>, unknown, SendMessageFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaultValues ?? {
      target: {
        sendMode: "LEAD",
        code: countries[0].code,
      } as SendMessageFormValues["target"],
      payload: {
        type: "TEXT",
        message: "",
      },
    },
  });

  const { instance, instanceLoading } = useQueryInstances(trackingId);

  const sendMode = form.watch("target.sendMode");
  const selectedCode = form.watch("target.code" as any);
  const countrySelected =
    countries.find((c) => c.code === selectedCode) || countries[0];
  const messageType = form.watch("payload.type");

  const handleSubmit = (values: SendMessageFormValues) => {
    onSubmit(values);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar Mensagem</DialogTitle>
          <DialogDescription>Configure a mensagem</DialogDescription>
        </DialogHeader>
        {!instanceLoading && !instance && (
          <Alert>
            <InfoIcon />
            <AlertTitle>Nenhuma instância encontrada</AlertTitle>
            <AlertDescription>
              Para enviar mensagens, é necessário ter uma instância conectada.
            </AlertDescription>
            <AlertAction>
              <Button size="xs" asChild>
                <Link href={`/tracking/${trackingId}/settings?tab=instance`}>
                  Conectar
                </Link>
              </Button>
            </AlertAction>
          </Alert>
        )}
        {!instanceLoading && instance && (
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <Controller
              control={form.control}
              name="payload.type"
              render={({ field }) => (
                <Field>
                  <FieldLabel>Tipo de mensagem</FieldLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo de mensagem" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TEXT">Texto</SelectItem>
                      <SelectItem value="IMAGE">Imagem</SelectItem>
                      <SelectItem value="DOCUMENT">Documento</SelectItem>
                      <SelectItem value="BUTTONS">Menu de Botões</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />

            <Controller
              control={form.control}
              name="target.sendMode"
              render={({ field }) => {
                const isCustomMode = field.value === "CUSTOM";

                return (
                  <div className="flex items-center justify-end mt-2">
                    <span className="text-sm mr-2">Customizar envio</span>
                    <Switch
                      checked={isCustomMode}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          field.onChange("CUSTOM");
                          form.setValue(
                            "target.code" as any,
                            countries[0].code,
                          );
                        } else {
                          field.onChange("LEAD");
                        }
                      }}
                    />
                  </div>
                );
              }}
            />

            <FieldGroup>
              {sendMode === "CUSTOM" && (
                <Controller
                  control={form.control}
                  name="target.phone"
                  render={({ field, fieldState }) => (
                    <Field>
                      <FieldContent>
                        <FieldLabel>Número</FieldLabel>
                        <InputGroup>
                          <InputGroupAddon>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  className={cn(
                                    "text-xs flex items-center hover:bg-accent transition-all px-1 rounded-sm py-1 gap-x-1",
                                    countrySelected && "bg-accent",
                                  )}
                                >
                                  <img
                                    src={countrySelected.flag}
                                    alt={countrySelected.country}
                                    className="size-4 rounded-sm"
                                  />
                                  <span>{countrySelected.ddi}</span>
                                  <ChevronDownIcon className="size-3" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                className="[--radius:0.95rem] max-h-30 overflow-y-auto"
                              >
                                <DropdownMenuGroup>
                                  {countries.map((country) => (
                                    <DropdownMenuItem
                                      key={country.code}
                                      onClick={() =>
                                        form.setValue(
                                          "target.code" as any,
                                          country.code,
                                        )
                                      }
                                      className="cursor-pointer"
                                    >
                                      <img
                                        src={country.flag}
                                        alt={country.country}
                                        className="size-5 rounded-sm"
                                      />
                                      <span>{country.ddi}</span>
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuGroup>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </InputGroupAddon>
                          <InputGroupInput
                            {...field}
                            onChange={(e) => {
                              field.onChange(phoneMask(e.target.value));
                            }}
                            placeholder="(00) 0000-0000"
                          />
                        </InputGroup>
                        <FieldError errors={[fieldState.error]} />
                        <FieldDescription>
                          O número deve estar na base de leads para que a
                          mensagem seja enviada.
                        </FieldDescription>
                      </FieldContent>
                    </Field>
                  )}
                />
              )}

              {messageType === "TEXT" && (
                <Controller
                  control={form.control}
                  name="payload.message"
                  render={({ field, fieldState }) => (
                    <Field className="gap-3">
                      <FieldLabel>Mensagem</FieldLabel>
                      <VariableTextarea
                        {...field}
                        placeholder="Digite a mensagem"
                      />
                      <FieldError errors={[fieldState.error]} />
                      <FieldDescription>
                        Clique em "/" para adicionar variáveis.
                      </FieldDescription>
                    </Field>
                  )}
                />
              )}

              {messageType === "IMAGE" && (
                <>
                  <Controller
                    control={form.control}
                    name="payload.imageUrl"
                    render={({ field, fieldState }) => (
                      <Field>
                        <FieldLabel>Imagem</FieldLabel>
                        <Uploader
                          value={field.value}
                          onConfirm={field.onChange}
                        />
                        <FieldError errors={[fieldState.error]} />
                      </Field>
                    )}
                  />
                  <Controller
                    control={form.control}
                    name="payload.caption"
                    render={({ field }) => (
                      <Field>
                        <FieldLabel>Legenda</FieldLabel>
                        <VariableInput
                          {...field}
                          placeholder="Digite a legenda"
                        />
                      </Field>
                    )}
                  />
                </>
              )}

              {messageType === "DOCUMENT" && (
                <>
                  <Controller
                    control={form.control}
                    name="payload.documentUrl"
                    render={({ field, fieldState }) => (
                      <Field>
                        <FieldLabel>Documento</FieldLabel>
                        <Uploader
                          value={field.value}
                          onConfirm={field.onChange}
                          fileTypeAccepted="outros"
                        />
                        <FieldError errors={[fieldState.error]} />
                      </Field>
                    )}
                  />
                  <Controller
                    control={form.control}
                    name="payload.fileName"
                    render={({ field }) => (
                      <Field>
                        <FieldLabel>Nome do arquivo</FieldLabel>
                        <Input
                          {...field}
                          placeholder="Digite o nome do arquivo"
                        />
                      </Field>
                    )}
                  />
                  <Controller
                    control={form.control}
                    name="payload.caption"
                    render={({ field }) => (
                      <Field>
                        <FieldLabel>Legenda</FieldLabel>
                        <VariableInput
                          {...field}
                          placeholder="Digite a legenda"
                        />
                      </Field>
                    )}
                  />
                </>
              )}

              {messageType === "BUTTONS" && (
                <ButtonsPayloadFields
                  trackingId={trackingId}
                  form={form}
                />
              )}
            </FieldGroup>

            <DialogFooter className="mt-4">
              <Button type="submit">Enviar</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
