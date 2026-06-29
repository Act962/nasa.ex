"use client";

import { KeyRound, InfoIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Controller, useForm } from "react-hook-form";
import z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Switch } from "@/components/ui/switch";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { useMemo } from "react";
import { useQueryAiSettings, useUpdateAiSettings } from "../hooks/use-tracking";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/spinner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProviderIcon } from "./provider-icons";

const PROVIDER_MODELS = {
  OPENAI: [
    { id: "gpt-4.1", label: "GPT-4.1" },
    { id: "gpt-4.1-mini", label: "GPT-4.1 mini" },
    { id: "gpt-4o", label: "GPT-4o" },
    { id: "gpt-4o-mini", label: "GPT-4o mini" },
  ],
  ANTHROPIC: [
    { id: "claude-opus-4-7", label: "Claude Opus 4.7" },
    { id: "claude-opus-4-6", label: "Claude Opus 4.6" },
    { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
    { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5" },
    { id: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
  ],
  GOOGLE: [
    { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" },
    { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
    { id: "gemini-2.0-flash-lite", label: "Gemini 2.0 Flash Lite" },
    { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
    { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
  ],
} as const;

const PROVIDER_LABEL: Record<keyof typeof PROVIDER_MODELS, string> = {
  OPENAI: "OpenAI",
  ANTHROPIC: "Anthropic",
  GOOGLE: "Google",
};

// Schema condicional: quando `customModelEnabled` é true, exigimos provider +
// model + key (vinda no payload OU já configurada no servidor). Factory porque
// `apiKeyConfigured` é estado vindo do servidor (useQueryAiSettings).
const buildModelSchema = (apiKeyConfigured: boolean) =>
  z
    .object({
      customModelEnabled: z.boolean(),
      aiProvider: z.enum(["OPENAI", "ANTHROPIC", "GOOGLE"]).nullable(),
      aiModelId: z.string().nullable(),
      aiApiKey: z.string(),
    })
    .superRefine((data, ctx) => {
      if (!data.customModelEnabled) return;

      if (!data.aiProvider) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["aiProvider"],
          message: "Selecione um provider.",
        });
      }
      if (!data.aiModelId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["aiModelId"],
          message: "Selecione um modelo.",
        });
      }
      const hasKey = apiKeyConfigured || data.aiApiKey.trim().length > 0;
      if (!hasKey) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["aiApiKey"],
          message: "Informe a API key do provider selecionado.",
        });
      }
      if (data.aiApiKey.length > 0 && data.aiApiKey.trim().length < 10) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["aiApiKey"],
          message: "A API key parece inválida (muito curta).",
        });
      }
    });

type ModelData = z.infer<ReturnType<typeof buildModelSchema>>;

export function ChatBotIaModelTab({ trackingId }: { trackingId: string }) {
  const { settings, isLoadingSettings } = useQueryAiSettings(trackingId);

  const apiKeyConfigured = Boolean(settings?.aiApiKeyConfigured);

  const schema = useMemo(
    () => buildModelSchema(apiKeyConfigured),
    [apiKeyConfigured],
  );

  const form = useForm<ModelData>({
    resolver: zodResolver(schema),
    values: {
      customModelEnabled: Boolean(settings?.aiProvider),
      aiProvider: settings?.aiProvider ?? null,
      aiModelId: settings?.aiModelId ?? null,
      aiApiKey: "",
    },
  });

  const updateAiSettings = useUpdateAiSettings();

  if (isLoadingSettings || !settings) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner />
      </div>
    );
  }

  const isSubmitting = updateAiSettings.isPending;
  const customModelEnabled = form.watch("customModelEnabled");
  const provider = form.watch("aiProvider");
  const apiKeyLast4 = settings.aiApiKeyLast4 ?? null;
  const errors = form.formState.errors;

  // Base payload: como o oRPC `update-ai-settings` exige `prompt` + `aiEnabled`,
  // sempre reenviamos os valores atuais junto com a mudança de modelo.
  const buildBasePayload = () => ({
    trackingId,
    aiEnabled: settings.tracking?.globalAiActive ?? false,
    assistantName: settings.assistantName ?? undefined,
    prompt: settings.prompt,
    finishMessage: settings.finishSentence ?? undefined,
  });

  const onSubmit = (data: ModelData) => {
    if (!data.customModelEnabled) {
      updateAiSettings.mutate({
        ...buildBasePayload(),
        aiProvider: null,
        aiModelId: null,
        aiApiKey: "",
      });
      return;
    }

    updateAiSettings.mutate({
      ...buildBasePayload(),
      aiProvider: data.aiProvider,
      aiModelId: data.aiModelId,
      ...(data.aiApiKey ? { aiApiKey: data.aiApiKey } : {}),
    });
  };

  const onClearApiKey = () => {
    updateAiSettings.mutate({
      ...buildBasePayload(),
      aiApiKey: "",
    });
    form.setValue("aiApiKey", "");
  };

  return (
    <div className="space-y-6">
      <Alert>
        <InfoIcon />
        <AlertTitle>Modelo de IA do atendimento</AlertTitle>
        <AlertDescription>
          Por padrão, a NASA usa o modelo que está no seu plano. Ative a opção
          abaixo para conectar seu próprio provider e API key — o custo das
          chamadas passa a ser do seu provider.
        </AlertDescription>
      </Alert>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FieldGroup>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="custom-model">
                Usar meu próprio modelo de IA
              </FieldLabel>
              <FieldDescription>
                Quando desativado, a NASA usa o modelo padrão (custo coberto
                pelo seu plano).
              </FieldDescription>
            </FieldContent>
            <Controller
              name="customModelEnabled"
              control={form.control}
              render={({ field }) => (
                <Switch
                  id="custom-model"
                  name={field.name}
                  checked={field.value}
                  disabled={isSubmitting}
                  onCheckedChange={(checked) => {
                    field.onChange(checked);
                    if (!checked) {
                      form.setValue("aiProvider", null);
                      form.setValue("aiModelId", null);
                      form.setValue("aiApiKey", "");
                    } else if (!form.getValues("aiProvider")) {
                      form.setValue("aiProvider", "OPENAI");
                      form.setValue("aiModelId", "gpt-4.1-mini");
                    }
                  }}
                />
              )}
            />
          </Field>

          {customModelEnabled && (
            <>
              <FieldSeparator />

              <Field>
                <FieldLabel>Provider</FieldLabel>
                <Controller
                  name="aiProvider"
                  control={form.control}
                  render={({ field }) => (
                    <Select
                      value={field.value ?? undefined}
                      onValueChange={(v) => {
                        field.onChange(v);
                        const first = PROVIDER_MODELS[
                          v as keyof typeof PROVIDER_MODELS
                        ]?.[0]?.id;
                        form.setValue("aiModelId", first ?? null);
                      }}
                      disabled={isSubmitting}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um provider" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(PROVIDER_LABEL).map(([id, label]) => (
                          <SelectItem key={id} value={id}>
                            <div className="flex items-center gap-2">
                              <ProviderIcon
                                provider={
                                  id as "OPENAI" | "ANTHROPIC" | "GOOGLE"
                                }
                                className="size-4 shrink-0"
                              />
                              <span>{label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.aiProvider && (
                  <p className="text-destructive text-sm">
                    {errors.aiProvider.message}
                  </p>
                )}
              </Field>

              <Field>
                <FieldLabel>Modelo</FieldLabel>
                <Controller
                  name="aiModelId"
                  control={form.control}
                  render={({ field }) => {
                    const options = provider ? PROVIDER_MODELS[provider] : [];
                    return (
                      <Select
                        value={field.value ?? undefined}
                        onValueChange={field.onChange}
                        disabled={isSubmitting || !provider}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um modelo" />
                        </SelectTrigger>
                        <SelectContent>
                          {options.map((opt) => (
                            <SelectItem key={opt.id} value={opt.id}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    );
                  }}
                />
                {errors.aiModelId && (
                  <p className="text-destructive text-sm">
                    {errors.aiModelId.message}
                  </p>
                )}
              </Field>

              <Field>
                <FieldLabel htmlFor="api-key">API Key</FieldLabel>
                <div className="flex gap-2">
                  <Input
                    id="api-key"
                    type="password"
                    placeholder={
                      apiKeyConfigured
                        ? `••••••••${apiKeyLast4 ?? ""} (deixe em branco para manter)`
                        : "sk-..."
                    }
                    disabled={isSubmitting}
                    {...form.register("aiApiKey")}
                  />
                  {apiKeyConfigured && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isSubmitting}
                      onClick={onClearApiKey}
                    >
                      Remover
                    </Button>
                  )}
                </div>
                {errors.aiApiKey && (
                  <p className="text-destructive text-sm">
                    {errors.aiApiKey.message}
                  </p>
                )}
                <FieldDescription className="flex items-center gap-1">
                  <KeyRound className="size-3" />
                  Sua key é armazenada criptografada. A NASA não consegue
                  lê-la em texto plano depois de salvar.
                </FieldDescription>
              </Field>
            </>
          )}
        </FieldGroup>

        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Spinner />}
            Salvar
          </Button>
        </div>
      </form>
    </div>
  );
}
