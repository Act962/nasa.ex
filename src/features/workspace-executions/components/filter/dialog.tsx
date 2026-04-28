"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  useColumnsByWorkspace,
  useListTags,
  useWorkspaceMembers,
} from "@/features/workspace/hooks/use-workspace";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, PlusIcon, Trash2Icon } from "lucide-react";
import { useParams } from "next/navigation";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import z from "zod";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const filterConditionSchema = z.discriminatedUnion("field", [
  z.object({
    field: z.literal("column"),
    operator: z.enum(["is", "is_not"]),
    value: z.array(z.string()).min(1, "Selecione ao menos uma coluna"),
  }),
  z.object({
    field: z.literal("tag"),
    operator: z.enum(["contains", "not_contains"]),
    value: z.array(z.string()).min(1, "Selecione ao menos uma etiqueta"),
  }),
  z.object({
    field: z.literal("participant"),
    operator: z.enum(["contains", "not_contains"]),
    value: z.array(z.string()).min(1, "Selecione ao menos um participante"),
  }),
  z.object({
    field: z.literal("isDone"),
    operator: z.literal("is"),
    value: z.enum(["true", "false"]),
  }),
  z.object({
    field: z.literal("name"),
    operator: z.enum(["equals", "contains"]),
    value: z.string().min(1, "Informe um valor"),
  }),
]);

export const wsFilterFormSchema = z.object({
  logic: z.enum(["and", "or"]),
  conditions: z
    .array(filterConditionSchema)
    .min(1, "Adicione ao menos uma condição"),
});

export type WsFilterCondition = z.infer<typeof filterConditionSchema>;
export type WsFilterFormValues = z.infer<typeof wsFilterFormSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FIELD_OPTIONS: { value: WsFilterCondition["field"]; label: string }[] = [
  { value: "column", label: "Coluna" },
  { value: "tag", label: "Etiqueta" },
  { value: "participant", label: "Participante" },
  { value: "isDone", label: "Concluída" },
  { value: "name", label: "Nome" },
];

const OPERATOR_OPTIONS: Record<
  WsFilterCondition["field"],
  { value: string; label: string }[]
> = {
  column: [
    { value: "is", label: "está em" },
    { value: "is_not", label: "não está em" },
  ],
  tag: [
    { value: "contains", label: "contém" },
    { value: "not_contains", label: "não contém" },
  ],
  participant: [
    { value: "contains", label: "contém" },
    { value: "not_contains", label: "não contém" },
  ],
  isDone: [{ value: "is", label: "é" }],
  name: [
    { value: "equals", label: "é igual a" },
    { value: "contains", label: "contém" },
  ],
};

const DEFAULT_CONDITION: WsFilterCondition = {
  field: "column",
  operator: "is",
  value: [],
};

const getDefaultOperator = (field: WsFilterCondition["field"]): string =>
  OPERATOR_OPTIONS[field][0].value;

const getDefaultValue = (field: WsFilterCondition["field"]) => {
  if (field === "column" || field === "tag" || field === "participant") return [];
  if (field === "isDone") return "true";
  return "";
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: WsFilterFormValues) => void;
  defaultValues?: Partial<WsFilterFormValues>;
}

type Member = {
  userId: string;
  user?: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
};

const memberId = (m: Member) => m.user?.id ?? m.userId;
const memberName = (m: Member) =>
  m.user?.name ?? m.user?.email ?? memberId(m);

export const WsFilterDialog = ({
  open,
  onOpenChange,
  onSubmit,
  defaultValues,
}: Props) => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { columns, isLoading: isLoadingColumns } = useColumnsByWorkspace(
    workspaceId || "",
  );
  const { tags, isLoading: isLoadingTags } = useListTags(workspaceId || "");
  const { members } = useWorkspaceMembers(workspaceId || "");

  const form = useForm<WsFilterFormValues>({
    resolver: zodResolver(wsFilterFormSchema),
    defaultValues: defaultValues ?? {
      logic: "and",
      conditions: [{ ...DEFAULT_CONDITION }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "conditions",
  });

  const handleSubmit = (values: WsFilterFormValues) => {
    onSubmit(values);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Filtro</DialogTitle>
          <DialogDescription>
            Configure as condições para continuar o fluxo da ação.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <FieldGroup>
            <Controller
              name="logic"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel>Lógica entre condições</FieldLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="and">
                        AND — todas as condições devem ser verdadeiras
                      </SelectItem>
                      <SelectItem value="or">
                        OR — ao menos uma condição deve ser verdadeira
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />

            <div className="flex flex-col gap-3">
              <FieldLabel>Condições</FieldLabel>

              {fields.map((fieldItem, index) => {
                const currentField = form.watch(`conditions.${index}.field`);

                return (
                  <div
                    key={fieldItem.id}
                    className="flex items-start gap-2 rounded-md border p-3"
                  >
                    <Controller
                      name={`conditions.${index}.field`}
                      control={form.control}
                      render={({ field }) => (
                        <Select
                          onValueChange={(val) => {
                            const newField = val as WsFilterCondition["field"];
                            field.onChange(newField);
                            form.setValue(
                              `conditions.${index}.operator` as never,
                              getDefaultOperator(newField) as never,
                            );
                            form.setValue(
                              `conditions.${index}.value` as never,
                              getDefaultValue(newField) as never,
                            );
                          }}
                          value={field.value}
                        >
                          <SelectTrigger className="w-[140px] shrink-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FIELD_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />

                    <Controller
                      name={`conditions.${index}.operator` as never}
                      control={form.control}
                      render={({ field }) => (
                        <Select
                          onValueChange={field.onChange}
                          value={field.value as string}
                        >
                          <SelectTrigger className="w-[160px] shrink-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {OPERATOR_OPTIONS[currentField]?.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />

                    <Controller
                      name={`conditions.${index}.value`}
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <div className="flex flex-1 flex-col gap-1">
                          {currentField === "column" ||
                          currentField === "tag" ? (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  type="button"
                                  variant="outline"
                                  role="combobox"
                                  className="w-full justify-start h-auto min-h-10 py-2 px-3"
                                >
                                  <div className="flex flex-wrap gap-1">
                                    {Array.isArray(field.value) &&
                                    field.value.length > 0 ? (
                                      <>
                                        {field.value.slice(0, 3).map((id) => {
                                          const item =
                                            currentField === "column"
                                              ? columns.find(
                                                  (c: { id: string }) =>
                                                    c.id === id,
                                                )
                                              : tags.find(
                                                  (t: { id: string }) =>
                                                    t.id === id,
                                                );
                                          const label = (item as {
                                            name?: string;
                                          })?.name;
                                          const color = (item as {
                                            color?: string;
                                          })?.color;
                                          return (
                                            <Badge
                                              key={id}
                                              variant="secondary"
                                              className="font-normal"
                                              style={
                                                color
                                                  ? {
                                                      backgroundColor: color,
                                                      color: "#fff",
                                                    }
                                                  : undefined
                                              }
                                            >
                                              {label || id}
                                            </Badge>
                                          );
                                        })}
                                        {field.value.length > 3 && (
                                          <Badge
                                            variant="outline"
                                            className="font-normal"
                                          >
                                            +{field.value.length - 3}
                                          </Badge>
                                        )}
                                      </>
                                    ) : (
                                      <span className="text-muted-foreground">
                                        {currentField === "column"
                                          ? "Selecione as colunas..."
                                          : "Selecione as etiquetas..."}
                                      </span>
                                    )}
                                  </div>
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="p-0" align="start">
                                <Command>
                                  <CommandInput
                                    placeholder={
                                      currentField === "column"
                                        ? "Pesquisar coluna..."
                                        : "Pesquisar etiqueta..."
                                    }
                                  />
                                  <CommandList>
                                    {(currentField === "column"
                                      ? isLoadingColumns
                                      : isLoadingTags) ? (
                                      <div className="flex items-center justify-center p-4">
                                        <Spinner />
                                      </div>
                                    ) : (
                                      <>
                                        <CommandEmpty>
                                          Nenhum resultado encontrado.
                                        </CommandEmpty>
                                        <CommandGroup>
                                          {((currentField === "column"
                                            ? columns
                                            : tags) as {
                                            id: string;
                                            name: string;
                                          }[]).map((item) => {
                                            const isSelected = Array.isArray(
                                              field.value,
                                            )
                                              ? field.value.includes(item.id)
                                              : false;
                                            return (
                                              <CommandItem
                                                key={item.id}
                                                value={`${item.id}-${item.name}`}
                                                onSelect={() => {
                                                  const current = Array.isArray(
                                                    field.value,
                                                  )
                                                    ? field.value
                                                    : [];
                                                  const next = isSelected
                                                    ? current.filter(
                                                        (id) => id !== item.id,
                                                      )
                                                    : [...current, item.id];
                                                  field.onChange(next);
                                                }}
                                              >
                                                <div
                                                  className={cn(
                                                    "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                                    isSelected
                                                      ? "bg-primary text-primary-foreground"
                                                      : "opacity-50 [&_svg]:invisible",
                                                  )}
                                                >
                                                  <Check className="h-4 w-4" />
                                                </div>
                                                <span>{item.name}</span>
                                              </CommandItem>
                                            );
                                          })}
                                        </CommandGroup>
                                      </>
                                    )}
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          ) : currentField === "participant" ? (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  type="button"
                                  variant="outline"
                                  role="combobox"
                                  className="w-full justify-start h-auto min-h-10 py-2 px-3"
                                >
                                  <div className="flex flex-wrap gap-1">
                                    {Array.isArray(field.value) &&
                                    field.value.length > 0 ? (
                                      field.value.map((id) => {
                                        const m = (members as Member[]).find(
                                          (mm) => memberId(mm) === id,
                                        );
                                        const name = m
                                          ? memberName(m)
                                          : id;
                                        return (
                                          <span
                                            key={id}
                                            className="inline-flex items-center gap-1 rounded-md bg-muted pl-1 pr-1.5 py-0.5"
                                          >
                                            <Avatar className="size-5">
                                              <AvatarImage
                                                src={m?.user?.image ?? ""}
                                              />
                                              <AvatarFallback className="text-[10px]">
                                                {name
                                                  .substring(0, 2)
                                                  .toUpperCase()}
                                              </AvatarFallback>
                                            </Avatar>
                                            <span className="text-xs font-medium">
                                              {name}
                                            </span>
                                          </span>
                                        );
                                      })
                                    ) : (
                                      <span className="text-muted-foreground">
                                        Selecione participantes...
                                      </span>
                                    )}
                                  </div>
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="p-0" align="start">
                                <Command>
                                  <CommandInput placeholder="Pesquisar membro..." />
                                  <CommandList>
                                    <CommandEmpty>
                                      Nenhum membro encontrado.
                                    </CommandEmpty>
                                    <CommandGroup>
                                      {(members as Member[]).map((m) => {
                                        const id = memberId(m);
                                        const name = memberName(m);
                                        const isSelected = Array.isArray(
                                          field.value,
                                        )
                                          ? field.value.includes(id)
                                          : false;
                                        return (
                                          <CommandItem
                                            key={id}
                                            value={`${name} ${m.user?.email ?? ""}`}
                                            onSelect={() => {
                                              const current = Array.isArray(
                                                field.value,
                                              )
                                                ? field.value
                                                : [];
                                              const next = isSelected
                                                ? current.filter(
                                                    (v) => v !== id,
                                                  )
                                                : [...current, id];
                                              field.onChange(next);
                                            }}
                                          >
                                            <Avatar className="size-6 mr-2">
                                              <AvatarImage
                                                src={m.user?.image ?? ""}
                                              />
                                              <AvatarFallback>
                                                {name
                                                  .substring(0, 2)
                                                  .toUpperCase()}
                                              </AvatarFallback>
                                            </Avatar>
                                            <div className="flex flex-col">
                                              <span className="text-sm font-medium">
                                                {name}
                                              </span>
                                              {m.user?.email && (
                                                <span className="text-xs text-muted-foreground font-normal">
                                                  {m.user.email}
                                                </span>
                                              )}
                                            </div>
                                            {isSelected && (
                                              <Check className="size-4 ml-auto" />
                                            )}
                                          </CommandItem>
                                        );
                                      })}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          ) : currentField === "isDone" ? (
                            <Select
                              onValueChange={field.onChange}
                              value={
                                typeof field.value === "string"
                                  ? field.value
                                  : "true"
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="true">Concluída</SelectItem>
                                <SelectItem value="false">
                                  Não concluída
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              {...field}
                              placeholder="Nome da ação..."
                              className={
                                fieldState.error ? "border-destructive" : ""
                              }
                              value={
                                typeof field.value === "string"
                                  ? field.value
                                  : ""
                              }
                            />
                          )}
                          {fieldState.error && (
                            <span className="text-xs text-destructive">
                              {fieldState.error.message}
                            </span>
                          )}
                        </div>
                      )}
                    />

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => remove(index)}
                      disabled={fields.length === 1}
                    >
                      <Trash2Icon className="size-4" />
                    </Button>
                  </div>
                );
              })}

              {form.formState.errors.conditions?.root && (
                <span className="text-xs text-destructive">
                  {form.formState.errors.conditions.root.message}
                </span>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() => append({ ...DEFAULT_CONDITION })}
              >
                <PlusIcon className="mr-2 size-4" />
                Adicionar condição
              </Button>
            </div>
          </FieldGroup>

          <DialogFooter className="mt-6">
            <Button type="submit">Salvar filtro</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
