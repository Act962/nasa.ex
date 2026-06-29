"use client";

import { Uploader } from "@/components/file-uploader/uploader";
import {
  Alert,
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
import { cn } from "@/lib/utils";
import { orpc } from "@/lib/orpc";
import { countries } from "@/types/some";
import { phoneMask } from "@/utils/format-phone";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { ChevronDownIcon, InfoIcon } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { VariablePicker } from "./variable-picker";
import { useVariableAutocomplete } from "./use-variable-autocomplete";

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

export const wsSendMessageFormSchema = z.object({
  instanceId: z.string().min(1, "Selecione uma instância"),
  target: targetSchema,
  payload: payloadSchema,
});
export type WsSendMessageFormValues = z.infer<typeof wsSendMessageFormSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: WsSendMessageFormValues) => void;
  defaultValues?: Partial<WsSendMessageFormValues>;
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

export const WsSendMessageDialog = ({
  open,
  onOpenChange,
  onSubmit,
  defaultValues,
}: Props) => {
  const form = useForm<WsSendMessageFormValues>({
    resolver: zodResolver(wsSendMessageFormSchema),
    defaultValues: defaultValues ?? {
      instanceId: "",
      target: {
        sendMode: "LEAD",
        code: countries[0].code,
      } as WsSendMessageFormValues["target"],
      payload: {
        type: "TEXT",
        message: "",
      },
    },
  });

  const { data: instances = [], isLoading: instancesLoading } = useQuery(
    orpc.integrations.listAvailable.queryOptions(),
  );

  const sendMode = form.watch("target.sendMode");
  const selectedCode = form.watch("target.code" as any);
  const countrySelected =
    countries.find((c) => c.code === selectedCode) || countries[0];
  const messageType = form.watch("payload.type");

  const handleSubmit = (values: WsSendMessageFormValues) => {
    onSubmit(values);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar mensagem aos participantes</DialogTitle>
          <DialogDescription>
            Configure a instância e a mensagem que será enviada via WhatsApp.
          </DialogDescription>
        </DialogHeader>

        {!instancesLoading && instances.length === 0 && (
          <Alert>
            <InfoIcon />
            <AlertTitle>Nenhuma instância disponível</AlertTitle>
            <AlertDescription>
              Conecte uma instância em algum tracking para poder enviar
              mensagens a partir das automações de workspace.
            </AlertDescription>
          </Alert>
        )}

        {!instancesLoading && instances.length > 0 && (
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <FieldGroup>
              <Controller
                control={form.control}
                name="instanceId"
                render={({ field, fieldState }) => (
                  <Field>
                    <FieldLabel>Instância (WhatsApp)</FieldLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a instância" />
                      </SelectTrigger>
                      <SelectContent>
                        {instances.map((i) => (
                          <SelectItem key={i.id} value={i.id}>
                            <div className="flex flex-col">
                              <span className="text-sm">
                                {i.profileName || i.instanceName}
                                {i.phoneNumber ? ` · ${i.phoneNumber}` : ""}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                Tracking: {i.trackingName}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldError errors={[fieldState.error]} />
                    <FieldDescription>
                      A mensagem será enviada usando esta instância para o
                      telefone cadastrado em cada participante.
                    </FieldDescription>
                  </Field>
                )}
              />

              <Controller
                control={form.control}
                name="payload.type"
                render={({ field }) => (
                  <Field>
                    <FieldLabel>Tipo de mensagem</FieldLabel>
                    <Select
                      value={field.value}
                      onValueChange={(v) => {
                        if (v === "TEXT")
                          form.setValue("payload", {
                            type: "TEXT",
                            message: "",
                          } as any);
                        if (v === "IMAGE")
                          form.setValue("payload", {
                            type: "IMAGE",
                            imageUrl: "",
                            caption: "",
                          } as any);
                        if (v === "DOCUMENT")
                          form.setValue("payload", {
                            type: "DOCUMENT",
                            documentUrl: "",
                            fileName: "",
                            caption: "",
                          } as any);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
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
                  const isCustom = field.value === "CUSTOM";
                  return (
                    <div className="flex items-center justify-end mt-1">
                      <span className="text-sm mr-2">
                        Enviar para número customizado
                      </span>
                      <Switch
                        checked={isCustom}
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
                                  type="button"
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
                            onChange={(e) =>
                              field.onChange(phoneMask(e.target.value))
                            }
                            placeholder="(00) 0000-0000"
                          />
                        </InputGroup>
                        <FieldError errors={[fieldState.error]} />
                        <FieldDescription>
                          Ao usar número customizado, a mensagem é enviada
                          apenas para esse número (não percorre os
                          participantes).
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
                        Digite "/" para inserir variáveis.
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
            </FieldGroup>

            <DialogFooter className="mt-4">
              <Button type="submit">Salvar</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
