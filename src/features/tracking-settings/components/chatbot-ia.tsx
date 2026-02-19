"use client";

import { InfoIcon, BotIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Controller, useForm } from "react-hook-form";
import z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Switch } from "@/components/ui/switch";
import { Field, FieldContent, FieldLabel } from "@/components/ui/field";

const schema = z.object({
  glabalActiveIa: z.boolean(),
});

export function ChatBotIa() {
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      glabalActiveIa: false,
    },
  });

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 rounded-2xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <BotIcon className="size-4 " />
            <h2 className="text-xl font-semibold">Chatbot Ia</h2>
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
      <div className="col-span-4 space-y-6">
        <Controller
          control={form.control}
          name="glabalActiveIa"
          defaultValue={form.getValues().glabalActiveIa}
          render={({ field }) => (
            <Field>
              <FieldContent className="flex flex-row">
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
                <FieldLabel>Respostas de IA</FieldLabel>
              </FieldContent>
            </Field>
          )}
        />
      </div>
    </div>
  );
}
