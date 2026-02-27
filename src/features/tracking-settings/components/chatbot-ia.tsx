"use client";

import { InfoIcon, BotIcon } from "lucide-react";
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
import { useQueryAiSettings, useUpdateAiSettings } from "../hooks/use-tracking";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useEffect } from "react";
import { Spinner } from "@/components/spinner";
import { Button } from "@/components/ui/button";

const aiSettingSchema = z.object({
  assistantName: z.string().optional(),
  prompt: z.string().min(1, "Preencha um prompt para sua agente"),
  finishMessage: z.string().optional(),
  aiEnabled: z.boolean(),
});

type AiSettingData = z.infer<typeof aiSettingSchema>;

export function ChatBotIa({ trackingId }: { trackingId: string }) {
  const { settings, isLoadingSettings } = useQueryAiSettings(trackingId);
  const form = useForm<AiSettingData>({
    resolver: zodResolver(aiSettingSchema),
    defaultValues: {
      assistantName: settings?.assistantName ?? "",
      prompt: settings?.prompt ?? "",
      finishMessage: settings?.finishSentence ?? "",
      aiEnabled: settings?.tracking.globalAiActive ?? false,
    },
  });

  const updateAiSettings = useUpdateAiSettings();

  useEffect(() => {
    if (settings) {
      form.reset({
        assistantName: settings.assistantName ?? "",
        prompt: settings.prompt ?? "",
        finishMessage: settings.finishSentence ?? "",
        aiEnabled: settings.tracking.globalAiActive ?? false,
      });
    }
  }, [settings, form]);

  if (isLoadingSettings) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner />
      </div>
    );
  }

  const isSubmitting = updateAiSettings.isPending;

  const onSubmit = async (data: AiSettingData) => {
    console.log("Data", data);
    // updateAiSettings.mutate({
    //   aiEnabled: data.aiEnabled,
    //   assistantName: data.assistantName,
    //   finishMessage: data.finishMessage,
    //   prompt: data.prompt,
    //   trackingId,
    // });

    updateAiSettings.mutate({
      aiEnabled: data.aiEnabled,
      assistantName: data.assistantName,
      prompt: data.prompt,
      finishMessage: data.finishMessage,
      trackingId,
    });
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 rounded-2xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <BotIcon className="size-4 " />
            <h2 className="text-xl font-semibold">Chatbot IA</h2>
          </div>
          <p className="text-muted-foreground text-sm">
            Personalize seu agente de Ia para respoder de acordo com seu negócio
          </p>
        </div>
      </div>

      {/* Settings Sidebar */}
      <Alert>
        <InfoIcon />
        <AlertTitle>
          Suas configurações irão influenciar no comportamento da IA
        </AlertTitle>
        <AlertDescription>
          Os campos estão sendo salvos automaticamente
        </AlertDescription>
      </Alert>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FieldGroup>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="ia-global">
                Permitir interação da IA
              </FieldLabel>
              <FieldDescription>
                Habilitar essa função permitirá que a IA interaja com os leads
                que estiverem ativos
              </FieldDescription>
            </FieldContent>
            <Controller
              name="aiEnabled"
              control={form.control}
              render={({ field, fieldState }) => (
                <Switch
                  id="ai-global"
                  name={field.name}
                  checked={field.value}
                  disabled={isSubmitting}
                  onCheckedChange={field.onChange}
                  aria-invalid={fieldState.invalid}
                />
              )}
            />
          </Field>

          <FieldSeparator />
          <Field>
            <FieldLabel htmlFor="name">Nome da assistente</FieldLabel>
            <Input
              id="name"
              placeholder="John"
              disabled={isSubmitting}
              {...form.register("assistantName")}
            />
            <FieldDescription>
              Nome no qual a IA irá se apresentar
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel>Prompt</FieldLabel>
            <Textarea
              className="min-h-52"
              disabled={isSubmitting}
              placeholder="Você uma assistente de consultoria..."
              {...form.register("prompt")}
            />
            <FieldDescription>
              Informe para a IA como ela deve se comunicar
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel>Finalizar chata quando</FieldLabel>
            <Input
              placeholder="Quiente quiser pedir para ser atendido por um humano"
              disabled={isSubmitting}
              {...form.register("finishMessage")}
            />
          </Field>
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
