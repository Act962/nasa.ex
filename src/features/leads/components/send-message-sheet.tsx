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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useQueryInstances } from "@/features/tracking-settings/hooks/use-integration";
import { cn } from "@/lib/utils";
import { countries } from "@/types/some";
import { phoneMask } from "@/utils/format-phone";
import {
  formSchema,
  type SendMessageFormValues,
} from "@/features/executions/components/send-message/dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDownIcon, InfoIcon } from "lucide-react";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SendMessageSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: SendMessageFormValues) => void;
  trackingId: string;
  defaultValues?: Partial<SendMessageFormValues>;
}

export function SendMessageSheet({
  open,
  onOpenChange,
  onSubmit,
  trackingId,
  defaultValues,
}: SendMessageSheetProps) {
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={"right"} className="flex flex-col  px-4 ">
        <SheetHeader>
          <SheetTitle>Enviar Mensagem</SheetTitle>
          <SheetDescription>Configure a mensagem</SheetDescription>
        </SheetHeader>

        <div className="flex-1 py-4 space-y-4">
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
            <form
              id="send-message-sheet-form"
              onSubmit={form.handleSubmit(handleSubmit)}
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
            </form>
          )}
        </div>

        {!instanceLoading && instance && (
          <SheetFooter className="border-t pt-4">
            <Button
              type="submit"
              form="send-message-sheet-form"
              className="w-full"
            >
              Enviar
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
