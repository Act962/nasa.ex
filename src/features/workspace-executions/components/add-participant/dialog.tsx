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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useWorkspaceMembers } from "@/features/workspace/hooks/use-workspace";
import { CheckIcon, ChevronsUpDown, XIcon } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const formSchema = z.object({
  userIds: z.array(z.string()).min(1, "Selecione ao menos um participante"),
});

export type AddParticipantFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: AddParticipantFormValues) => void;
  defaultValues?: Partial<AddParticipantFormValues>;
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

export const AddParticipantDialog = ({
  open,
  onOpenChange,
  onSubmit,
  defaultValues,
}: Props) => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { members } = useWorkspaceMembers(workspaceId);
  const [openPopover, setOpenPopover] = useState(false);

  const form = useForm<AddParticipantFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { userIds: defaultValues?.userIds ?? [] },
    values: defaultValues?.userIds
      ? { userIds: defaultValues.userIds }
      : undefined,
  });

  const handleSubmit = (values: AddParticipantFormValues) => {
    onSubmit(values);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar participantes</DialogTitle>
          <DialogDescription>
            Adicione um ou mais participantes para esta ação.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <FieldGroup>
            <Field>
              <FieldLabel>Participantes</FieldLabel>
              <Controller
                control={form.control}
                name="userIds"
                render={({ field, fieldState }) => {
                  const selected = field.value ?? [];
                  const toggle = (id: string) => {
                    if (selected.includes(id)) {
                      field.onChange(selected.filter((s) => s !== id));
                    } else {
                      field.onChange([...selected, id]);
                    }
                  };
                  const remove = (id: string, e: React.MouseEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    field.onChange(selected.filter((s) => s !== id));
                  };

                  const selectedMembers = selected
                    .map((id) =>
                      (members as Member[]).find((m) => memberId(m) === id),
                    )
                    .filter(Boolean) as Member[];

                  return (
                    <>
                      <Popover
                        open={openPopover}
                        onOpenChange={setOpenPopover}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={openPopover}
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
                                        <AvatarImage
                                          src={m.user?.image ?? ""}
                                        />
                                        <AvatarFallback className="text-[10px]">
                                          {name.substring(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                      </Avatar>
                                      <span className="text-xs font-medium">
                                        {name}
                                      </span>
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
                              <CommandEmpty>
                                Nenhum membro encontrado.
                              </CommandEmpty>
                              <CommandGroup>
                                {(members as Member[]).map((m) => {
                                  const id = memberId(m);
                                  const name = memberName(m);
                                  const isSelected = selected.includes(id);
                                  return (
                                    <CommandItem
                                      key={id}
                                      value={`${name} ${m.user?.email ?? ""}`}
                                      onSelect={() => toggle(id)}
                                      className="cursor-pointer"
                                    >
                                      <Avatar className="size-6 mr-2">
                                        <AvatarImage
                                          src={m.user?.image ?? ""}
                                        />
                                        <AvatarFallback>
                                          {name.substring(0, 2).toUpperCase()}
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
                                        <CheckIcon className="size-4 ml-auto" />
                                      )}
                                    </CommandItem>
                                  );
                                })}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      {fieldState.error?.message && (
                        <p className="text-destructive text-xs mt-1">
                          {fieldState.error.message}
                        </p>
                      )}
                    </>
                  );
                }}
              />
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-4">
            <Button type="submit">Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
