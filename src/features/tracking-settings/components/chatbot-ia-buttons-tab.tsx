"use client";

import { useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import z from "zod";
import { MessageSquareDashed, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import {
  useAiButtonPresets,
  useCreateAiButtonPreset,
  useDeleteAiButtonPreset,
  useUpdateAiButtonPreset,
} from "../hooks/use-ai-button-presets";

const buttonItemSchema = z.object({
  text: z.string().min(1, "Texto do botão é obrigatório"),
  id: z.string().min(1, "Identificador é obrigatório"),
});

const presetFormSchema = z.object({
  name: z.string().min(1, "Informe um nome"),
  // description/footerText ficam como string vazia quando vazios (não
  // optional) para o zodResolver inferir o mesmo tipo no input e no output
  // do form. O router server aceita "" e converte conforme necessário.
  description: z.string(),
  bodyText: z.string().min(1, "Informe o texto da mensagem"),
  footerText: z.string(),
  buttons: z.array(buttonItemSchema).min(1, "Adicione pelo menos um botão"),
});

type PresetFormData = z.infer<typeof presetFormSchema>;

type Preset = ReturnType<typeof useAiButtonPresets>["presets"][number];

type ButtonItem = z.infer<typeof buttonItemSchema>;

function parseButtons(raw: unknown): ButtonItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((b): b is Record<string, unknown> => typeof b === "object" && b !== null)
    .map((b) => ({
      text: typeof b.text === "string" ? b.text : "",
      id: typeof b.id === "string" ? b.id : crypto.randomUUID(),
    }));
}

export function ChatBotIaButtonsTab({ trackingId }: { trackingId: string }) {
  const { presets, isLoadingPresets } = useAiButtonPresets(trackingId);
  const createPreset = useCreateAiButtonPreset(trackingId);

  const handleCreate = () => {
    createPreset.mutate(
      {
        trackingId,
        name: "Novo preset",
        description: "",
        bodyText: "",
        buttons: [{ text: "", id: crypto.randomUUID() }],
        isActive: true,
      },
      {
        onError: (error) => toast.error(error.message),
      },
    );
  };

  if (isLoadingPresets) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-base font-semibold">Presets de botões</h3>
          <p className="text-muted-foreground text-sm">
            Configure conjuntos de botões que a IA pode enviar no WhatsApp para
            guiar o lead pelo fluxo de atendimento.
          </p>
        </div>

        {presets.length > 0 && (
          <Button onClick={handleCreate} disabled={createPreset.isPending}>
            {createPreset.isPending ? <Spinner /> : <Plus />}
            Adicionar preset
          </Button>
        )}
      </div>

      {presets.length === 0 ? (
        <EmptyState
          onCreate={handleCreate}
          isCreating={createPreset.isPending}
        />
      ) : (
        <Accordion type="multiple" className="w-full flex flex-col gap-3">
          {presets.map((preset) => (
            <PresetRow
              key={preset.id}
              preset={preset}
              trackingId={trackingId}
            />
          ))}
        </Accordion>
      )}
    </div>
  );
}

function EmptyState({
  onCreate,
  isCreating,
}: {
  onCreate: () => void;
  isCreating: boolean;
}) {
  return (
    <div className="border border-dashed rounded-2xl p-10 flex flex-col items-center justify-center text-center gap-3">
      <div className="bg-muted rounded-full p-3">
        <MessageSquareDashed className="size-6 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="font-medium">Nenhum preset de botões ainda</p>
        <p className="text-muted-foreground text-sm max-w-md">
          Crie seu primeiro preset para que a IA possa enviar opções rápidas ao
          lead durante o atendimento.
        </p>
      </div>
      <Button onClick={onCreate} disabled={isCreating}>
        {isCreating ? <Spinner /> : <Plus />}
        Criar primeiro preset
      </Button>
    </div>
  );
}

function PresetRow({
  preset,
  trackingId,
}: {
  preset: Preset;
  trackingId: string;
}) {
  const updatePreset = useUpdateAiButtonPreset(trackingId);
  const deletePreset = useDeleteAiButtonPreset(trackingId);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const form = useForm<PresetFormData>({
    resolver: zodResolver(presetFormSchema),
    values: {
      name: preset.name,
      description: preset.description ?? "",
      bodyText: preset.bodyText,
      footerText: preset.footerText ?? "",
      buttons: parseButtons(preset.buttons),
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "buttons",
  });

  const onSubmit = (data: PresetFormData) => {
    updatePreset.mutate(
      {
        id: preset.id,
        name: data.name,
        description: data.description ?? "",
        bodyText: data.bodyText,
        footerText: data.footerText ? data.footerText : null,
        buttons: data.buttons,
      },
      {
        onSuccess: () => toast.success("Preset atualizado"),
        onError: (error) => toast.error(error.message),
      },
    );
  };

  const handleToggleActive = (next: boolean) => {
    updatePreset.mutate(
      { id: preset.id, isActive: next },
      {
        onError: (error) => toast.error(error.message),
      },
    );
  };

  const handleDelete = () => {
    deletePreset.mutate(
      { id: preset.id },
      {
        onSuccess: () => {
          setConfirmOpen(false);
          toast.success("Preset removido");
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  return (
    <AccordionItem
      value={preset.id}
      className="rounded-xl border bg-card text-card-foreground shadow-sm border-b"
    >
      <div className="flex items-center justify-between gap-2 px-4">
        <AccordionTrigger className="py-4 hover:no-underline">
          <div className="flex flex-col items-start gap-0.5">
            <span className="font-medium">{preset.name || "Sem nome"}</span>
            <span className="text-xs text-muted-foreground">
              {parseButtons(preset.buttons).length} botão(ões)
              {!preset.isActive && " · pausado"}
            </span>
          </div>
        </AccordionTrigger>

        <div
          className="flex items-center gap-2 pl-2"
          onClick={(e) => e.stopPropagation()}
        >
          <Switch
            checked={preset.isActive}
            onCheckedChange={handleToggleActive}
            disabled={updatePreset.isPending}
            aria-label="Ativar preset"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setConfirmOpen(true)}
            disabled={deletePreset.isPending}
            aria-label="Remover preset"
          >
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
      </div>

      <AccordionContent className="px-4 pb-4">
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4 pt-2 border-t"
        >
          <FieldGroup>
            <Field>
              <FieldLabel>Nome</FieldLabel>
              <Input
                placeholder="Ex: Formas de pagamento"
                {...form.register("name")}
              />
            </Field>

            <Field>
              <FieldLabel>Quando usar</FieldLabel>
              <Textarea
                placeholder="Descreva em texto livre quando a IA deve enviar este preset. Ex: 'Quando o lead perguntar sobre formas de pagamento.'"
                {...form.register("description")}
              />
              <FieldDescription>
                Essa instrução vai alimentar a IA para decidir quando disparar
                este preset.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel>Texto da mensagem</FieldLabel>
              <Textarea
                placeholder="Como podemos te ajudar?"
                {...form.register("bodyText")}
              />
            </Field>

            <Field>
              <FieldLabel>Rodapé (opcional)</FieldLabel>
              <Input
                placeholder="Atendimento NASA"
                {...form.register("footerText")}
              />
            </Field>

            <Field>
              <FieldLabel>Botões</FieldLabel>
              <div className="space-y-2">
                {fields.map((field, index) => (
                  <div key={field.id} className="flex items-start gap-2">
                    <Controller
                      control={form.control}
                      name={`buttons.${index}.text`}
                      render={({ field: f }) => (
                        <Input
                          placeholder="Texto do botão"
                          className="flex-1"
                          {...f}
                        />
                      )}
                    />
                    <input
                      type="hidden"
                      {...form.register(`buttons.${index}.id`)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(index)}
                      disabled={fields.length === 1}
                      aria-label="Remover botão"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                {form.formState.errors.buttons?.message && (
                  <p className="text-destructive text-xs">
                    {form.formState.errors.buttons.message}
                  </p>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    append({ text: "", id: crypto.randomUUID() })
                  }
                >
                  <Plus />
                  Adicionar botão
                </Button>
              </div>
              <FieldDescription>
                Texto exibido ao lead no WhatsApp. O identificador interno é
                gerado automaticamente.
              </FieldDescription>
            </Field>
          </FieldGroup>

          <div className="flex justify-end">
            <Button type="submit" disabled={updatePreset.isPending}>
              {updatePreset.isPending && <Spinner />}
              Salvar
            </Button>
          </div>
        </form>
      </AccordionContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover preset?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O preset &quot;{preset.name}
              &quot; será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePreset.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deletePreset.isPending}
            >
              {deletePreset.isPending && <Spinner />}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AccordionItem>
  );
}
