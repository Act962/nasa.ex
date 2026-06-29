"use client";

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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useWorkspaceMembers } from "@/features/workspace/hooks/use-workspace";
import { ChevronDownIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import {
  Controller,
  FormProvider,
  useFieldArray,
  useForm,
  useFormContext,
  useWatch,
} from "react-hook-form";

export type CreateSubActionItem = {
  title: string;
  description?: string;
  responsibleId?: string;
};

export type CreateSubActionFormValues = {
  subActions: CreateSubActionItem[];
};

const empty = (): CreateSubActionItem => ({
  title: "",
  description: "",
  responsibleId: undefined,
});

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultValues?: Partial<CreateSubActionFormValues>;
  onSubmit: (values: CreateSubActionFormValues) => void;
}

export function CreateSubActionDialog({
  open,
  onOpenChange,
  defaultValues,
  onSubmit,
}: Props) {
  const form = useForm<CreateSubActionFormValues>({
    defaultValues: {
      subActions:
        defaultValues?.subActions && defaultValues.subActions.length > 0
          ? defaultValues.subActions
          : [empty()],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "subActions",
  });

  const handle = (values: CreateSubActionFormValues) => {
    onSubmit(values);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar sub-ações</DialogTitle>
          <DialogDescription>
            Configure uma ou mais sub-ações da ação atual.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handle)}>
          <FormProvider {...form}>
            <div className="flex flex-col gap-3">
              {fields.map((field, index) => (
                <SubActionItem
                  key={field.id}
                  index={index}
                  canRemove={fields.length > 1}
                  onRemove={() => remove(index)}
                />
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() => append(empty())}
              >
                <PlusIcon className="size-4 mr-2" />
                Adicionar sub-ação
              </Button>
            </div>
          </FormProvider>
          <DialogFooter className="mt-4">
            <Button type="submit">Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SubActionItem({
  index,
  canRemove,
  onRemove,
}: {
  index: number;
  canRemove: boolean;
  onRemove: () => void;
}) {
  const { control } = useFormContext<CreateSubActionFormValues>();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { members } = useWorkspaceMembers(workspaceId);
  const watchedTitle = useWatch({
    control,
    name: `subActions.${index}.title`,
  }) as string | undefined;
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
              Sub-ação {index + 1}
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
            aria-label="Remover sub-ação"
          >
            <Trash2Icon className="size-4" />
          </Button>
        )}
      </div>
      <CollapsibleContent className="px-4 pb-4">
        <FieldGroup>
        <Controller
          control={control}
          name={`subActions.${index}.title`}
          rules={{ required: true }}
          render={({ field }) => (
            <Field>
              <FieldLabel>Título</FieldLabel>
              <Input
                {...field}
                value={field.value ?? ""}
                placeholder="Ex.: Enviar e-mail de follow-up"
              />
            </Field>
          )}
        />
        <Controller
          control={control}
          name={`subActions.${index}.description`}
          render={({ field }) => (
            <Field>
              <FieldLabel>Descrição</FieldLabel>
              <Textarea
                {...field}
                value={field.value ?? ""}
                rows={2}
                placeholder="Detalhes da sub-ação (opcional)"
              />
            </Field>
          )}
        />
        <Controller
          control={control}
          name={`subActions.${index}.responsibleId`}
          render={({ field }) => (
            <Field>
              <FieldLabel>Responsável</FieldLabel>
              <Select
                value={(field.value as string) ?? ""}
                onValueChange={(v) =>
                  field.onChange(v === "__none__" ? undefined : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sem responsável" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem responsável</SelectItem>
                  {(members as any[]).map((m) => {
                    const id = m.user?.id ?? m.userId;
                    const name =
                      m.user?.name ?? m.user?.email ?? id;
                    return (
                      <SelectItem key={id} value={id}>
                        {name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </Field>
          )}
        />
        </FieldGroup>
      </CollapsibleContent>
    </Collapsible>
  );
}
