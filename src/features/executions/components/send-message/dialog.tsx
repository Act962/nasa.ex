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
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

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
