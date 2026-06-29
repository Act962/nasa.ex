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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useParams } from "next/navigation";
import { ReactNode } from "react";
import {
  Controller,
  useForm,
  DefaultValues,
  FieldValues,
  FormProvider,
  useFormContext,
  useWatch,
} from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import {
  useColumnsByWorkspace,
  useListTags,
  useWorkspaceMembers,
} from "@/features/workspace/hooks/use-workspace";

type FieldDef<T> =
  | {
      kind: "text";
      name: keyof T & string;
      label: string;
      placeholder?: string;
    }
  | {
      kind: "textarea";
      name: keyof T & string;
      label: string;
      placeholder?: string;
    }
  | {
      kind: "number";
      name: keyof T & string;
      label: string;
      min?: number;
      max?: number;
    }
  | {
      kind: "select";
      name: keyof T & string;
      label: string;
      options: { value: string; label: string }[];
    }
  | {
      kind: "column";
      name: keyof T & string;
      label: string;
      optional?: boolean;
      workspaceIdFrom?: string;
    }
  | {
      kind: "tag";
      name: keyof T & string;
      label: string;
      optional?: boolean;
    }
  | {
      kind: "member";
      name: keyof T & string;
      label: string;
      optional?: boolean;
    }
  | {
      kind: "workspace";
      name: keyof T & string;
      label: string;
      optional?: boolean;
    };

export type SimpleField<T> = FieldDef<T>;

interface Props<T extends FieldValues> {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  fields: FieldDef<T>[];
  defaultValues?: Partial<T>;
  onSubmit: (values: T) => void;
  footer?: ReactNode;
}

function WorkspaceSelect({
  value,
  onChange,
  placeholder,
}: {
  value?: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const { data, isLoading } = useQuery(orpc.workspace.list.queryOptions());
  const workspaces = data?.workspaces ?? [];
  return (
    <Select value={value ?? ""} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={isLoading ? "Carregando..." : (placeholder ?? "Selecione o workspace")} />
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
  value,
  onChange,
  placeholder,
  workspaceId: workspaceIdProp,
}: {
  value?: string;
  onChange: (v: string) => void;
  placeholder?: string;
  workspaceId?: string;
}) {
  const { workspaceId: paramsWorkspaceId } = useParams<{ workspaceId: string }>();
  const workspaceId = workspaceIdProp || paramsWorkspaceId;
  const { columns, isLoading } = useColumnsByWorkspace(workspaceId);
  return (
    <Select value={value ?? ""} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={isLoading ? "Carregando..." : placeholder} />
      </SelectTrigger>
      <SelectContent>
        {columns.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ColumnSelectField({
  value,
  onChange,
  workspaceIdFrom,
  optional,
}: {
  value?: string;
  onChange: (v: string) => void;
  workspaceIdFrom?: string;
  optional?: boolean;
}) {
  const { control } = useFormContext();
  const watched = useWatch({ control, name: workspaceIdFrom ?? "__none__" }) as string | undefined;
  return (
    <ColumnSelect
      value={value}
      onChange={onChange}
      workspaceId={workspaceIdFrom ? watched : undefined}
      placeholder={optional ? "Qualquer coluna" : "Selecione a coluna"}
    />
  );
}

function TagSelect({
  value,
  onChange,
  placeholder,
}: {
  value?: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { tags, isLoading } = useListTags(workspaceId);
  return (
    <Select value={value ?? ""} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={isLoading ? "Carregando..." : placeholder} />
      </SelectTrigger>
      <SelectContent>
        {tags.map((t) => (
          <SelectItem key={t.id} value={t.id}>
            <span
              className="inline-block size-2 rounded-full mr-2"
              style={{ background: t.color }}
            />
            {t.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function MemberSelect({
  value,
  onChange,
  placeholder,
}: {
  value?: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { members, isLoading } = useWorkspaceMembers(workspaceId);
  return (
    <Select value={value ?? ""} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={isLoading ? "Carregando..." : placeholder} />
      </SelectTrigger>
      <SelectContent>
        {members.map((m: any) => (
          <SelectItem key={m.userId ?? m.user?.id} value={m.userId ?? m.user?.id}>
            {m.user?.name ?? m.user?.email ?? m.userId}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function SimpleDialog<T extends FieldValues>({
  open,
  onOpenChange,
  title,
  description,
  fields,
  defaultValues,
  onSubmit,
}: Props<T>) {
  const form = useForm<T>({
    defaultValues: (defaultValues ?? {}) as DefaultValues<T>,
  });

  const handle = (v: T) => {
    onSubmit(v);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(handle)}>
            <FieldGroup>
              {fields.map((f) => (
                <Controller
                  key={f.name}
                  control={form.control}
                  name={f.name as any}
                  render={({ field }) => (
                    <Field>
                      <FieldLabel>{f.label}</FieldLabel>
                      {f.kind === "text" && (
                        <Input
                          {...field}
                          value={(field.value as string) ?? ""}
                          placeholder={f.placeholder}
                        />
                      )}
                      {f.kind === "textarea" && (
                        <Textarea
                          {...field}
                          value={(field.value as string) ?? ""}
                          placeholder={f.placeholder}
                        />
                      )}
                      {f.kind === "number" && (
                        <Input
                          type="number"
                          value={(field.value as number) ?? ""}
                          min={f.min}
                          max={f.max}
                          onChange={(e) =>
                            field.onChange(Number(e.target.value))
                          }
                        />
                      )}
                      {f.kind === "select" && (
                        <Select
                          value={(field.value as string) ?? ""}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={f.label} />
                          </SelectTrigger>
                          <SelectContent>
                            {f.options.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {f.kind === "column" && (
                        <ColumnSelectField
                          value={field.value as string}
                          onChange={field.onChange}
                          workspaceIdFrom={f.workspaceIdFrom}
                          optional={f.optional}
                        />
                      )}
                      {f.kind === "tag" && (
                        <TagSelect
                          value={field.value as string}
                          onChange={field.onChange}
                          placeholder={f.optional ? "Qualquer etiqueta" : "Selecione a etiqueta"}
                        />
                      )}
                      {f.kind === "member" && (
                        <MemberSelect
                          value={field.value as string}
                          onChange={field.onChange}
                          placeholder={f.optional ? "Qualquer participante" : "Selecione o participante"}
                        />
                      )}
                      {f.kind === "workspace" && (
                        <WorkspaceSelect
                          value={field.value as string}
                          onChange={field.onChange}
                          placeholder={f.optional ? "Workspace atual" : "Selecione o workspace"}
                        />
                      )}
                    </Field>
                  )}
                />
              ))}
            </FieldGroup>
            <DialogFooter className="mt-4">
              <Button type="submit">Salvar</Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
