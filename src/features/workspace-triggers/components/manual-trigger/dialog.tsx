"use client";

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
import { useSearchActions } from "@/features/actions/hooks/use-search-actions";
import {
  useColumnsByWorkspace,
  useListTags,
} from "@/features/workspace/hooks/use-workspace";
import { useDebouncedValue } from "@/hooks/use-debounced";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckIcon } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

export const wsManualTriggerSchema = z.object({
  actionId: z.string().min(1, "Selecione uma ação"),
  columnId: z.string().optional(),
  tagId: z.string().optional(),
});

export type WsManualTriggerFormValues = z.infer<typeof wsManualTriggerSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: WsManualTriggerFormValues) => void;
  defaultValues?: Partial<WsManualTriggerFormValues>;
  workspaceId: string;
}

export const WsManualTriggerDialog = ({
  open,
  onOpenChange,
  onSubmit,
  defaultValues,
  workspaceId,
}: Props) => {
  const [openPopover, setOpenPopover] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const debouncedSearch = useDebouncedValue(searchValue, 5000);

  const form = useForm<WsManualTriggerFormValues>({
    resolver: zodResolver(wsManualTriggerSchema),
    defaultValues: defaultValues ?? {
      actionId: "",
      columnId: "",
      tagId: "",
    },
  });

  const columnId = form.watch("columnId");
  const tagId = form.watch("tagId");
  const actionId = form.watch("actionId");

  const { columns, isLoading: isLoadingColumns } =
    useColumnsByWorkspace(workspaceId);
  const { tags, isLoading: isLoadingTags } = useListTags(workspaceId);

  const { actions, isFetching: isFetchingActions } = useSearchActions({
    workspaceId,
    search: debouncedSearch || undefined,
    columnIds: columnId ? [columnId] : [],
    tagIds: tagId ? [tagId] : [],
    enabled: open,
  });

  const handleSubmit = (values: WsManualTriggerFormValues) => {
    onSubmit(values);
    onOpenChange(false);
  };

  const selectedAction = actions.find((a) => a.id === actionId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Gatilho manual</DialogTitle>
          <DialogDescription>
            Escolha a ação na qual o fluxo de automação será executado.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <FieldGroup>
            <Controller
              name="columnId"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel>Coluna (opcional)</FieldLabel>
                  <Select
                    onValueChange={(val) => {
                      field.onChange(val === "__all__" ? "" : val);
                      form.setValue("actionId", "");
                    }}
                    value={field.value || "__all__"}
                    disabled={isLoadingColumns}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todas as colunas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Todas as colunas</SelectItem>
                      {columns?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />

            <Controller
              name="tagId"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel>Etiqueta (opcional)</FieldLabel>
                  <Select
                    onValueChange={(val) => {
                      field.onChange(val === "__all__" ? "" : val);
                      form.setValue("actionId", "");
                    }}
                    value={field.value || "__all__"}
                    disabled={isLoadingTags}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todas as etiquetas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">
                        Todas as etiquetas
                      </SelectItem>
                      {tags?.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />

            <Controller
              name="actionId"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel>Ação</FieldLabel>
                  <Popover open={openPopover} onOpenChange={setOpenPopover}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={openPopover}
                        className="w-full justify-between font-normal"
                      >
                        {field.value
                          ? selectedAction?.title || "Ação selecionada"
                          : "Procurar ação..."}
                        {isFetchingActions ? <Spinner /> : null}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput
                          placeholder="Buscar pelo nome da ação..."
                          value={searchValue}
                          onValueChange={setSearchValue}
                        />
                        <CommandList>
                          <CommandEmpty>
                            {isFetchingActions
                              ? "Buscando ações..."
                              : "Nenhuma ação encontrada."}
                          </CommandEmpty>
                          <CommandGroup>
                            {actions.map((action) => (
                              <CommandItem
                                key={action.id}
                                value={action.id}
                                onSelect={() => {
                                  field.onChange(action.id);
                                  setOpenPopover(false);
                                }}
                              >
                                <CheckIcon
                                  className={cn(
                                    "mr-2 size-4",
                                    field.value === action.id
                                      ? "opacity-100"
                                      : "opacity-0",
                                  )}
                                />
                                <div className="flex flex-col">
                                  <span>{action.title}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {action.column?.name ?? "Sem coluna"}
                                  </span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </Field>
              )}
            />
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="submit" disabled={!actionId}>
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
