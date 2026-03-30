import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCreateTask } from "../hooks/use-tasks";
import { useSuspenseColumnsByWorkspace } from "@/features/workspace/hooks/use-workspace";
import { z } from "zod";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "./data-picker";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  defaultColumnId?: string;
}

const formSchema = z.object({
  title: z.string().min(1, "Título é obrigatório"),
  description: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  dueDate: z.date().optional(),
  startDate: z.date().optional(),
  workspaceId: z.string().min(1, "Workspace é obrigatório"),
  columnId: z.string().min(1, "Coluna é obrigatória"),
});

type FormValues = z.infer<typeof formSchema>;

export const CreateActionModal = ({
  open,
  onOpenChange,
  workspaceId,
  defaultColumnId,
}: Props) => {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      workspaceId,
      priority: "MEDIUM",
      title: "",
      description: "",
      dueDate: undefined,
      startDate: undefined,
      columnId: defaultColumnId ?? "",
    },
  });

  const createAction = useCreateTask();
  const { data } = useSuspenseColumnsByWorkspace(workspaceId);

  const columns = data.columns;

  useEffect(() => {
    if (columns.length > 0 && !form.getValues("columnId")) {
      form.setValue("columnId", defaultColumnId ?? columns[0].id);
    }
  }, [columns, defaultColumnId, form]);

  const onSubmit = (values: FormValues) => {
    createAction.mutate(values, {
      onSuccess: () => {
        onOpenChange(false);
        form.reset();
      },
    });
  };

  const isPending = createAction.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-125">
        <DialogHeader>
          <DialogTitle>Criar uma nova ação</DialogTitle>
          <DialogDescription>
            Preencha os campos abaixo para criar uma nova ação no seu workspace.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel>Título</FieldLabel>
              <Input
                placeholder="Ex: Finalizar relatório"
                {...form.register("title")}
                disabled={isPending}
              />
              <FieldError errors={[form.formState.errors.title]} />
            </Field>

            <Field>
              <FieldLabel>Descrição (opcional)</FieldLabel>
              <Textarea
                placeholder="Adicione mais detalhes sobre esta ação"
                {...form.register("description")}
                disabled={isPending}
              />
              <FieldError errors={[form.formState.errors.description]} />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel>Prioridade</FieldLabel>
                <Controller
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={isPending}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a prioridade" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LOW">
                          <div className="size-2 rounded-full bg-emerald-500 mr-2" />
                          Baixa
                        </SelectItem>
                        <SelectItem value="MEDIUM">
                          <div className="size-2 rounded-full bg-yellow-500 mr-2" />
                          Média
                        </SelectItem>
                        <SelectItem value="HIGH">
                          <div className="size-2 rounded-full bg-orange-500 mr-2" />
                          Alta
                        </SelectItem>
                        <SelectItem value="URGENT">
                          <div className="size-2 rounded-full bg-red-600 mr-2" />
                          Urgente
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError errors={[form.formState.errors.priority]} />
              </Field>

              <Field>
                <FieldLabel>Status (Coluna)</FieldLabel>
                <Controller
                  control={form.control}
                  name="columnId"
                  render={({ field }) => (
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={isPending}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a coluna" />
                      </SelectTrigger>
                      <SelectContent>
                        {columns.map((column) => (
                          <SelectItem key={column.id} value={column.id}>
                            {column.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError errors={[form.formState.errors.columnId]} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel>Data de início</FieldLabel>
                <Controller
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <DatePicker
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Início"
                    />
                  )}
                />
                <FieldError errors={[form.formState.errors.startDate]} />
              </Field>

              <Field>
                <FieldLabel>Data de entrega</FieldLabel>
                <Controller
                  control={form.control}
                  name="dueDate"
                  render={({ field }) => (
                    <DatePicker
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Entrega"
                    />
                  )}
                />
                <FieldError errors={[form.formState.errors.dueDate]} />
              </Field>
            </div>
          </FieldGroup>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Spinner className="size-4 mr-2" />}
              Criar ação
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

