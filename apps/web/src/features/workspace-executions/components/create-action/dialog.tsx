"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { Textarea } from "@/components/ui/textarea";
import {
  useColumnsByWorkspace,
  useWorkspaceMembers,
} from "@/features/workspace/hooks/use-workspace";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronDownIcon,
  ChevronsUpDown,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import {
  Controller,
  useFieldArray,
  useForm,
  useFormContext,
  useWatch,
} from "react-hook-form";

export type Priority = "NONE" | "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type CreateActionItem = {
  title: string;
  description?: string;
  priority: Priority;
  workspaceId?: string;
  columnId: string;
  participants: string[];
  subActions: { title: string; description?: string }[];
};

export type CreateActionFormValues = {
  actions: CreateActionItem[];
};

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "NONE", label: "Nenhuma" },
  { value: "LOW", label: "Baixa" },
  { value: "MEDIUM", label: "Média" },
  { value: "HIGH", label: "Alta" },
  { value: "URGENT", label: "Urgente" },
];

const emptyAction = (): CreateActionItem => ({
  title: "",
  description: "",
  priority: "NONE",
  workspaceId: undefined,
  columnId: "",
  participants: [],
  subActions: [],
});

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultValues?: Partial<CreateActionFormValues>;
  onSubmit: (values: CreateActionFormValues) => void;
}

export function CreateActionDialog({
  open,
  onOpenChange,
  defaultValues,
  onSubmit,
}: Props) {
  const form = useForm<CreateActionFormValues>({
    defaultValues: {
      actions:
        defaultValues?.actions && defaultValues.actions.length > 0
          ? defaultValues.actions
          : [emptyAction()],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "actions",
  });

  const handle = (values: CreateActionFormValues) => {
    onSubmit(values);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar ações</DialogTitle>
          <DialogDescription>
            Configure uma ou mais ações que serão criadas na execução.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handle)}>
          <FormProviderlessWrapper form={form}>
            <div className="flex flex-col gap-4">
              {fields.map((field, index) => (
                <ActionItem
                  key={field.id}
                  index={index}
                  canRemove={fields.length > 1}
                  onRemove={() => remove(index)}
                />
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() => append(emptyAction())}
              >
                <PlusIcon className="size-4 mr-2" />
                Adicionar ação
              </Button>
            </div>
          </FormProviderlessWrapper>
          <DialogFooter className="mt-4">
            <Button type="submit">Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { FormProvider, UseFormReturn } from "react-hook-form";

function FormProviderlessWrapper({
  form,
  children,
}: {
  form: UseFormReturn<CreateActionFormValues>;
  children: React.ReactNode;
}) {
  return <FormProvider {...form}>{children}</FormProvider>;
}

function ActionItem({
  index,
  canRemove,
  onRemove,
}: {
  index: number;
  canRemove: boolean;
  onRemove: () => void;
}) {
  const { control } = useFormContext<CreateActionFormValues>();
  const { workspaceId: paramsWorkspaceId } = useParams<{
    workspaceId: string;
  }>();
  const watchedWorkspaceId = useWatch({
    control,
    name: `actions.${index}.workspaceId`,
  }) as string | undefined;
  const watchedTitle = useWatch({
    control,
    name: `actions.${index}.title`,
  }) as string | undefined;
  const effectiveWorkspaceId = watchedWorkspaceId || paramsWorkspaceId;
  const [open, setOpen] = useState(true);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="rounded-lg border bg-card"
    >
      <div className="flex items-center justify-between gap-2 p-3">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex flex-1 items-center gap-2 text-left"
          >
            <ChevronDownIcon
              className={`size-4 shrink-0 transition-transform ${
                open ? "" : "-rotate-90"
              }`}
            />
            <span className="text-sm font-medium">
              Ação {index + 1}
              {watchedTitle ? ` — ${watchedTitle}` : ""}
            </span>
          </button>
        </CollapsibleTrigger>
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRemove}
            aria-label="Remover ação"
          >
            <Trash2Icon className="size-4" />
          </Button>
        )}
      </div>

      <CollapsibleContent className="px-4 pb-4">
        <FieldGroup>
        <Controller
          control={control}
          name={`actions.${index}.title`}
          rules={{ required: true }}
          render={({ field }) => (
            <Field>
              <FieldLabel>Título</FieldLabel>
              <Input
                {...field}
                value={field.value ?? ""}
                placeholder="Ex.: Ligar para o lead"
              />
            </Field>
          )}
        />

        <Controller
          control={control}
          name={`actions.${index}.description`}
          render={({ field }) => (
            <Field>
              <FieldLabel>Descrição</FieldLabel>
              <Textarea
                {...field}
                value={field.value ?? ""}
                placeholder="Detalhes da ação (opcional)"
              />
            </Field>
          )}
        />

        <Controller
          control={control}
          name={`actions.${index}.priority`}
          render={({ field }) => (
            <Field>
              <FieldLabel>Prioridade</FieldLabel>
              <Select
                value={(field.value as string) ?? "NONE"}
                onValueChange={field.onChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Prioridade" />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
        />

        <Controller
          control={control}
          name={`actions.${index}.workspaceId`}
          render={({ field }) => (
            <Field>
              <FieldLabel>Workspace destino</FieldLabel>
              <WorkspaceSelect
                value={field.value as string | undefined}
                onChange={field.onChange}
              />
            </Field>
          )}
        />

        <Controller
          control={control}
          name={`actions.${index}.columnId`}
          rules={{ required: true }}
          render={({ field }) => (
            <Field>
              <FieldLabel>Coluna</FieldLabel>
              <ColumnSelect
                workspaceId={effectiveWorkspaceId}
                value={field.value as string | undefined}
                onChange={field.onChange}
              />
            </Field>
          )}
        />

        <Controller
          control={control}
          name={`actions.${index}.participants`}
          render={({ field }) => (
            <Field>
              <FieldLabel>Participantes</FieldLabel>
              <ParticipantsSelect
                workspaceId={effectiveWorkspaceId}
                value={(field.value as string[]) ?? []}
                onChange={field.onChange}
              />
            </Field>
          )}
        />

          <SubActionsField actionIndex={index} />
        </FieldGroup>
      </CollapsibleContent>
    </Collapsible>
  );
}

function SubActionsField({ actionIndex }: { actionIndex: number }) {
  const { control } = useFormContext<CreateActionFormValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: `actions.${actionIndex}.subActions`,
  });

  return (
    <Field>
      <FieldLabel>Sub-ações</FieldLabel>
      <div className="flex flex-col gap-2">
        {fields.length === 0 && (
          <span className="text-xs text-muted-foreground">
            Nenhuma sub-ação. Adicione para criar junto com a ação.
          </span>
        )}
        {fields.map((field, subIndex) => (
          <div
            key={field.id}
            className="flex items-start gap-2 rounded-md border p-2"
          >
            <div className="flex-1 flex flex-col gap-2">
              <Controller
                control={control}
                name={`actions.${actionIndex}.subActions.${subIndex}.title`}
                rules={{ required: true }}
                render={({ field: f }) => (
                  <Input
                    {...f}
                    value={f.value ?? ""}
                    placeholder="Título da sub-ação"
                  />
                )}
              />
              <Controller
                control={control}
                name={`actions.${actionIndex}.subActions.${subIndex}.description`}
                render={({ field: f }) => (
                  <Textarea
                    {...f}
                    value={f.value ?? ""}
                    placeholder="Descrição (opcional)"
                    rows={2}
                  />
                )}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => remove(subIndex)}
              aria-label="Remover sub-ação"
            >
              <Trash2Icon className="size-4" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ title: "", description: "" })}
        >
          <PlusIcon className="size-4 mr-2" />
          Adicionar sub-ação
        </Button>
      </div>
    </Field>
  );
}

function WorkspaceSelect({
  value,
  onChange,
}: {
  value?: string;
  onChange: (v: string) => void;
}) {
  const { data, isLoading } = useQuery(orpc.workspace.list.queryOptions());
  const workspaces = data?.workspaces ?? [];
  return (
    <Select value={value ?? ""} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue
          placeholder={isLoading ? "Carregando..." : "Workspace atual"}
        />
      </SelectTrigger>
      <SelectContent>
        {workspaces.map((w) => (
          <SelectItem key={w.id} value={w.id}>
            {w.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ColumnSelect({
  workspaceId,
  value,
  onChange,
}: {
  workspaceId?: string;
  value?: string;
  onChange: (v: string) => void;
}) {
  const { columns, isLoading } = useColumnsByWorkspace(workspaceId ?? "");
  return (
    <Select value={value ?? ""} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue
          placeholder={isLoading ? "Carregando..." : "Selecione a coluna"}
        />
      </SelectTrigger>
      <SelectContent>
        {columns.map((c: { id: string; name: string }) => (
          <SelectItem key={c.id} value={c.id}>
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
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

function ParticipantsSelect({
  workspaceId,
  value,
  onChange,
}: {
  workspaceId?: string;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const { members } = useWorkspaceMembers(workspaceId ?? "");
  const [open, setOpen] = useState(false);

  const toggle = (id: string) => {
    if (value.includes(id)) onChange(value.filter((s) => s !== id));
    else onChange([...value, id]);
  };

  const remove = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onChange(value.filter((s) => s !== id));
  };

  const selectedMembers = value
    .map((id) => (members as Member[]).find((m) => memberId(m) === id))
    .filter(Boolean) as Member[];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-auto min-h-10 py-2"
        >
          <div className="flex flex-wrap items-center gap-1.5">
            {selectedMembers.length === 0 ? (
              <span className="text-muted-foreground font-normal text-sm">
                Selecionar participantes...
              </span>
            ) : (
              selectedMembers.map((m) => {
                const id = memberId(m);
                const name = memberName(m);
                return (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 rounded-md bg-muted pl-1 pr-0.5 py-0.5"
                  >
                    <Avatar className="size-5">
                      <AvatarImage src={m.user?.image ?? ""} />
                      <AvatarFallback className="text-[10px]">
                        {name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-medium">{name}</span>
                    <span
                      role="button"
                      tabIndex={-1}
                      onClick={(e) => remove(id, e)}
                      className="rounded-sm hover:bg-muted-foreground/20 p-0.5 cursor-pointer"
                      aria-label={`Remover ${name}`}
                    >
                      <XIcon className="size-3" />
                    </span>
                  </span>
                );
              })
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 w-[--radix-popover-trigger-width]"
        align="start"
      >
        <Command>
          <CommandInput placeholder="Pesquisar membro..." />
          <CommandList>
            <CommandEmpty>Nenhum membro encontrado.</CommandEmpty>
            <CommandGroup>
              {(members as Member[]).map((m) => {
                const id = memberId(m);
                const name = memberName(m);
                const isSelected = value.includes(id);
                return (
                  <CommandItem
                    key={id}
                    value={`${name} ${m.user?.email ?? ""}`}
                    onSelect={() => toggle(id)}
                    className="cursor-pointer"
                  >
                    <Avatar className="size-6 mr-2">
                      <AvatarImage src={m.user?.image ?? ""} />
                      <AvatarFallback>
                        {name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{name}</span>
                      {m.user?.email && (
                        <span className="text-xs text-muted-foreground font-normal">
                          {m.user.email}
                        </span>
                      )}
                    </div>
                    {isSelected && (
                      <span className="ml-auto text-xs">✓</span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
