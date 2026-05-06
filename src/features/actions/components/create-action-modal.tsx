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
import dayjs from "dayjs";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { CheckIcon, UserPlusIcon, XIcon } from "lucide-react";
import { useWorkspaceMembers } from "@/features/workspace/hooks/use-workspace";
import { authClient } from "@/lib/auth-client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  defaultColumnId?: string;
  presetPublic?: boolean;
  /** Override do startDate default (hoje 00h). Útil ao criar a partir do calendário. */
  defaultStartDate?: Date;
  /** Override do dueDate default (amanhã 00h). Útil ao criar a partir do calendário. */
  defaultDueDate?: Date;
}

type WorkspaceMemberOption = {
  user: {
    id: string;
    name: string | null;
    image: string | null;
    email: string;
  };
};

const formSchema = z.object({
  title: z.string().min(1, "Título é obrigatório"),
  description: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  dueDate: z.date().optional(),
  startDate: z.date().optional(),
  workspaceId: z.string().min(1, "Workspace é obrigatório"),
  columnId: z.string().min(1, "Coluna é obrigatória"),
  orgProjectId: z.string().optional(),
  isPublic: z.boolean().optional(),
  participantIds: z.array(z.string()).optional(),
});

type FormValues = z.infer<typeof formSchema>;

export const CreateActionModal = ({
  open,
  onOpenChange,
  workspaceId,
  defaultColumnId,
  presetPublic,
  defaultStartDate,
  defaultDueDate,
}: Props) => {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      workspaceId,
      priority: "MEDIUM",
      title: "",
      description: "",
      startDate: defaultStartDate ?? dayjs().startOf("day").toDate(),
      dueDate:
        defaultDueDate ??
        (defaultStartDate
          ? dayjs(defaultStartDate).endOf("day").toDate()
          : dayjs().add(1, "day").startOf("day").toDate()),
      columnId: defaultColumnId ?? "",
      isPublic: presetPublic ?? false,
      participantIds: [],
    },
  });

  // Re-sincroniza datas se o prop mudar (cada click numa data abre o modal
  // com defaults novos).
  useEffect(() => {
    if (open && defaultStartDate) {
      form.setValue("startDate", defaultStartDate);
      form.setValue(
        "dueDate",
        defaultDueDate ?? dayjs(defaultStartDate).endOf("day").toDate(),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultStartDate?.getTime(), defaultDueDate?.getTime()]);

  const createAction = useCreateTask();
  const { data } = useSuspenseColumnsByWorkspace(workspaceId);
  const { data: projectsData } = useQuery(
    orpc.orgProjects.list.queryOptions({ input: {} }),
  );
  const projects = projectsData?.projects ?? [];

  const columns = data.columns;

  const { data: session } = authClient.useSession();
  const currentUserId = session?.user?.id;
  const { members } = useWorkspaceMembers(workspaceId);
  const selectableMembers = (members as WorkspaceMemberOption[]).filter(
    (m) => m.user.id !== currentUserId,
  );

  useEffect(() => {
    if (columns.length > 0 && !form.getValues("columnId")) {
      form.setValue("columnId", defaultColumnId ?? columns[0].id);
    }
  }, [columns, defaultColumnId, form]);

  const onSubmit = (values: FormValues) => {
    const normalizedDescription = values.description?.trim();

    createAction.mutate(
      {
        ...values,
        description: normalizedDescription
          ? JSON.stringify({
              type: "doc",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: normalizedDescription }],
                },
              ],
            })
          : undefined,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          form.reset();
        },
      },
    );
  };

  const isPending = createAction.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-125">
        <DialogHeader>
          <DialogTitle>
            {presetPublic ? "Criar evento público 🚀" : "Criar uma nova ação"}
          </DialogTitle>
          <DialogDescription>
            {presetPublic
              ? "Este evento será exibido no Calendário Público da NASA. Depois de criar, você pode adicionar cidade, categoria e link de inscrição no painel lateral."
              : "Preencha os campos abaixo para criar uma nova ação no seu workspace."}
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

            <Field>
              <FieldLabel>Projetos/Clientes (opcional)</FieldLabel>
              <Controller
                control={form.control}
                name="orgProjectId"
                render={({ field }) => (
                  <Select
                    onValueChange={(v) =>
                      field.onChange(v === "none" ? undefined : v)
                    }
                    value={field.value ?? "none"}
                    disabled={isPending}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um projeto/cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem projeto</SelectItem>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <Field>
              <FieldLabel>Participantes (opcional)</FieldLabel>
              <Controller
                control={form.control}
                name="participantIds"
                render={({ field }) => {
                  const selected = field.value ?? [];
                  const toggle = (userId: string) => {
                    const next = selected.includes(userId)
                      ? selected.filter((id) => id !== userId)
                      : [...selected, userId];
                    field.onChange(next);
                  };
                  const selectedMembers = selectableMembers.filter((m) =>
                    selected.includes(m.user.id),
                  );
                  return (
                    <div className="space-y-2">
                      {selectedMembers.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {selectedMembers.map((m) => (
                            <div
                              key={m.user.id}
                              className="flex items-center gap-1.5 rounded-full border bg-muted/50 pl-1 pr-2 py-0.5"
                            >
                              <Avatar className="size-5">
                                <AvatarImage src={m.user.image ?? undefined} />
                                <AvatarFallback className="text-[10px]">
                                  {m.user.name?.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-xs">{m.user.name}</span>
                              <button
                                type="button"
                                onClick={() => toggle(m.user.id)}
                                disabled={isPending}
                                className="text-muted-foreground hover:text-foreground"
                              >
                                <XIcon className="size-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full justify-start gap-2 font-normal"
                            disabled={isPending}
                          >
                            <UserPlusIcon className="size-3.5" />
                            <span className="text-muted-foreground">
                              {selected.length === 0
                                ? "Adicionar participantes"
                                : `${selected.length} participante${selected.length > 1 ? "s" : ""} selecionado${selected.length > 1 ? "s" : ""}`}
                            </span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-[--radix-popover-trigger-width] p-0"
                          align="start"
                        >
                          <Command>
                            <CommandInput placeholder="Buscar membro..." />
                            <CommandList>
                              <CommandEmpty>Nenhum membro encontrado.</CommandEmpty>
                              <CommandGroup>
                                {selectableMembers.map((m) => {
                                  const checked = selected.includes(m.user.id);
                                  return (
                                    <CommandItem
                                      key={m.user.id}
                                      value={m.user.name ?? m.user.id}
                                      onSelect={() => toggle(m.user.id)}
                                    >
                                      <Avatar className="size-5 mr-2">
                                        <AvatarImage
                                          src={m.user.image ?? undefined}
                                        />
                                        <AvatarFallback className="text-[10px]">
                                          {m.user.name?.charAt(0).toUpperCase()}
                                        </AvatarFallback>
                                      </Avatar>
                                      <span className="flex-1 truncate">
                                        {m.user.name}
                                      </span>
                                      {checked && (
                                        <CheckIcon className="size-3.5 text-primary shrink-0" />
                                      )}
                                    </CommandItem>
                                  );
                                })}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                  );
                }}
              />
            </Field>

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
