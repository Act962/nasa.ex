"use client";

import { Uploader } from "@/components/file-uploader/uploader";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useQueryInstances } from "@/features/tracking-settings/hooks/use-integration";
import { countries } from "@/types/some";
import { zodResolver } from "@hookform/resolvers/zod";
import { InfoIcon, Loader2 } from "lucide-react";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { client } from "@/lib/orpc";
import { toast } from "sonner";
import {
  useMutationFileMessage,
  useMutationImageMessage,
  useMutationTextMessage,
} from "@/features/tracking-chat/hooks/use-messages";
import { WhatsAppInstanceStatus } from "@/generated/prisma/enums";
import { getMimeType } from "@/utils/get-mimetype";
import { EmptyConversation } from "./empty-conversation";

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

const textPayloadSchema = z.object({
  type: z.literal("TEXT"),
  message: z.string().min(1, "Mensagem é obrigatória"),
});

const imagePayloadSchema = z.object({
  type: z.literal("IMAGE"),
  imageUrl: z.string("URL inválida").min(1, "URL inválida"),
  caption: z.string().optional(),
});

const docsPayloadSchema = z.object({
  type: z.literal("DOCS"),
  docsUrl: z.string("URL inválida").min(1, "URL inválida"),
  body: z.string(),
});

const payloadSchema = z.discriminatedUnion("type", [
  textPayloadSchema,
  imagePayloadSchema,
  docsPayloadSchema,
]);

export const sheetSendMessageSchema = z.object({
  target: targetSchema,
  payload: payloadSchema,
});
export type SheetSendMessageFormValues = z.infer<typeof sheetSendMessageSchema>;

interface SendMessageSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trackingId: string;
  defaultValues?: Partial<SheetSendMessageFormValues>;
  conversationId: string;
  lead: {
    id: string;
    name: string;
    phone: string | null;
  };
}

export function SendMessageSheet({
  open,
  onOpenChange,
  trackingId,
  defaultValues,
  conversationId,
  lead,
}: SendMessageSheetProps) {
  const mutationMessageText = useMutationTextMessage({
    conversationId: conversationId,
    lead,
  });

  const mutationMessageImage = useMutationImageMessage({
    conversationId: conversationId,
    lead,
  });

  const mutationMessageFile = useMutationFileMessage({
    conversationId: conversationId,
    lead,
  });
  const form = useForm<SheetSendMessageFormValues>({
    resolver: zodResolver(sheetSendMessageSchema),
    defaultValues: defaultValues ?? {
      target: {
        sendMode: "LEAD",
        code: countries[0].code,
      } as SheetSendMessageFormValues["target"],
      payload: {
        type: "TEXT",
        message: "",
      },
    },
  });

  const { instance, instanceLoading } = useQueryInstances(trackingId);

  const messageType = form.watch("payload.type");

  const handleSubmit = async (values: SheetSendMessageFormValues) => {
    if (
      instanceLoading ||
      !instance ||
      !instance?.apiKey ||
      instance.status === "DISCONNECTED"
    ) {
      toast.error("Instância não conectada");
      return;
    }

    let targetPhone = lead.phone;
    let targetConvId = conversationId;

    if (values.target.sendMode === "CUSTOM") {
      const phoneDigits = values.target.phone.replace(/\D/g, "");
      const res = await client.conversation.list({
        trackingId,
        search: phoneDigits,
        statusId: null,
      });
      if (!res.items || res.items.length === 0) {
        toast.error(
          "Número não encontrado na base de leads. Certifique-se que o lead tem uma conversa ativa.",
        );
        return;
      }

      targetPhone = `${values.target.code || ""}${phoneDigits}`;
      targetConvId = res.items[0].id;
    }

    if (!targetConvId || !targetPhone) {
      toast.error("Dados do lead insuficientes");
      return;
    }

    const payload = values.payload;

    if (payload.type === "TEXT") {
      mutationMessageText.mutate(
        {
          body: payload.message,
          leadPhone: lead.phone ?? "",
          conversationId: conversationId,
          token: instance.apiKey,
        },
        {
          onSuccess: () => {
            form.reset();
            onOpenChange(false);
            toast.success("Mensagem enviada!");
          },
        },
      );
    } else if (payload.type === "IMAGE") {
      mutationMessageImage.mutate(
        {
          conversationId: targetConvId,
          leadPhone: targetPhone,
          mediaUrl: payload.imageUrl,
          body: payload.caption,
          token: instance.apiKey,
        },
        {
          onSuccess: () => {
            form.reset();
            onOpenChange(false);
            toast.success("Image enviada!");
          },
        },
      );
    } else if (payload.type === "DOCS") {
      mutationMessageFile.mutate(
        {
          conversationId: targetConvId,
          leadPhone: targetPhone,
          mediaUrl: payload.docsUrl,
          mimetype: getMimeType(payload.docsUrl),
          token: instance.apiKey,
          fileName: "arquivo",
          body: payload.body,
        },
        {
          onSuccess: () => {
            form.reset();
            onOpenChange(false);
            toast.success("Documento enviado!");
          },
        },
      );
    }
  };

  const isPending =
    mutationMessageImage.isPending ||
    mutationMessageText.isPending ||
    mutationMessageFile.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={"right"} className="flex flex-col px-4 ">
        <SheetHeader>
          <SheetTitle>Enviar Mensagem</SheetTitle>
          <SheetDescription>Configure a mensagem</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4">
          {!instanceLoading &&
            (!instance ||
              instance.status === WhatsAppInstanceStatus.DISCONNECTED) && (
              <Alert>
                <InfoIcon />
                <AlertTitle>Nenhuma instância encontrada</AlertTitle>
                <AlertDescription>
                  Para enviar mensagens, é necessário ter uma instância
                  conectada.
                </AlertDescription>
                <AlertAction>
                  <Button size="xs" asChild>
                    <Link
                      href={`/tracking/${trackingId}/settings?tab=instance`}
                    >
                      Conectar
                    </Link>
                  </Button>
                </AlertAction>
              </Alert>
            )}

          {!instanceLoading && !conversationId && instance && (
            <EmptyConversation
              apikey={instance?.apiKey}
              lead={{ ...lead, phone: lead.phone ?? "" }}
              trackingId={trackingId}
            />
          )}

          {!instanceLoading && instance && conversationId && (
            <form
              id="send-message-sheet-form"
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-3"
            >
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
                        <SelectItem value="DOCS">Arquivo</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              />

              <FieldGroup>
                {messageType === "TEXT" && (
                  <Controller
                    control={form.control}
                    name="payload.message"
                    render={({ field, fieldState }) => (
                      <Field>
                        <FieldLabel>Mensagem</FieldLabel>
                        <Textarea {...field} placeholder="Digite a mensagem" />
                        <FieldError errors={[fieldState.error]} />
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
                          <Input {...field} placeholder="Digite a legenda" />
                        </Field>
                      )}
                    />
                  </>
                )}

                {messageType === "DOCS" && (
                  <>
                    <Controller
                      control={form.control}
                      name="payload.docsUrl"
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
                      name="payload.body"
                      render={({ field }) => (
                        <Field>
                          <FieldLabel>Legenda</FieldLabel>
                          <Input {...field} placeholder="Digite a legenda" />
                        </Field>
                      )}
                    />
                  </>
                )}
              </FieldGroup>
            </form>
          )}
        </div>

        {!instanceLoading && conversationId && instance && (
          <SheetFooter className="border-t pt-4">
            <Button
              type="submit"
              form="send-message-sheet-form"
              className="w-full"
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin mr-2" />
              ) : null}
              {isPending ? "Enviando..." : "Enviar"}
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
