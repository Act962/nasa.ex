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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useQueryInstances } from "@/features/tracking-settings/hooks/use-integration";
import { zodResolver } from "@hookform/resolvers/zod";
import { InfoIcon } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

/* ---------- TARGET ---------- */

const leadTargetSchema = z.object({
  sendMode: z.literal("LEAD"),
});

const customTargetSchema = z.object({
  sendMode: z.literal("CUSTOM"),
  phone: z
    .string()
    .min(10, "Telefone inválido")
    .regex(/^\d+$/, "Telefone deve conter apenas números"),
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
  imageUrl: z.url("URL inválida"),
  caption: z.string().optional(),
});

const documentPayloadSchema = z.object({
  type: z.literal("DOCUMENT"),
  documentUrl: z.url("URL inválida"),
  fileName: z.string().min(1, "Nome do arquivo obrigatório"),
  caption: z.string().optional(),
});

const payloadSchema = z.discriminatedUnion("type", [
  textPayloadSchema,
  imagePayloadSchema,
  documentPayloadSchema,
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

export const SendMessageDialog = ({
  open,
  onOpenChange,
  onSubmit,
  defaultValues,
}: Props) => {
  const { trackingId } = useParams<{ trackingId: string }>();
  const form = useForm<SendMessageFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaultValues ?? {
      target: {
        sendMode: "LEAD",
      },
      payload: {
        type: "TEXT",
        message: "",
      },
    },
  });

  const { instance, instanceLoading } = useQueryInstances(trackingId);

  // const sendMode = form.watch("target.sendMode");
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
            <FieldGroup>
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
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              />

              {messageType === "TEXT" && (
                <Controller
                  control={form.control}
                  name="payload.message"
                  render={({ field }) => (
                    <Field>
                      <FieldLabel>Mensagem</FieldLabel>
                      <Textarea {...field} placeholder="Digite a mensagem" />
                    </Field>
                  )}
                />
              )}

              {messageType === "IMAGE" && (
                <>
                  <Controller
                    control={form.control}
                    name="payload.imageUrl"
                    render={({ field }) => (
                      <Field>
                        <FieldLabel>URL da imagem</FieldLabel>
                        <Input
                          {...field}
                          placeholder="Digite a URL da imagem"
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
                        <Input {...field} placeholder="Digite a legenda" />
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
                    render={({ field }) => (
                      <Field>
                        <FieldLabel>URL do documento</FieldLabel>
                        <Input
                          {...field}
                          placeholder="Digite a URL do documento"
                        />
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
                        <Input {...field} placeholder="Digite a legenda" />
                      </Field>
                    )}
                  />
                </>
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
