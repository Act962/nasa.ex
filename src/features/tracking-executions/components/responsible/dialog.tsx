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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQueryParticipants } from "@/features/trackings/hooks/use-trackings";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckIcon, ChevronsUpDown } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

const formSchema = z.object({
  type: z.enum(["ADD", "REMOVE"]),
  responsible: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .nullable(),
});

export type ResponsibleFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: ResponsibleFormValues) => void;
  defaultValues?: Partial<ResponsibleFormValues>;
}

export const ResponsibleDialog = ({
  open,
  onOpenChange,
  onSubmit,
  defaultValues,
}: Props) => {
  const { trackingId } = useParams<{ trackingId: string }>();
  const [openPopover, setOpenPopover] = useState(false);
  const { participants } = useQueryParticipants({ trackingId });

  const form = useForm<ResponsibleFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaultValues ?? {
      type: "ADD",
      responsible: null,
    },
  });

  const handleSubmit = (values: ResponsibleFormValues) => {
    onSubmit(values);
    onOpenChange(false);
  };

  const selectedResponsible = form.watch("responsible");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Responsável</DialogTitle>
          <DialogDescription>
            Atribua o responsável por este lead.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <FieldGroup>
            <Field>
              <FieldLabel>Ação</FieldLabel>
              <Controller
                control={form.control}
                name="type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADD">Adicionar</SelectItem>
                      <SelectItem value="REMOVE">Remover</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field>
              <FieldLabel>Responsável</FieldLabel>
              <Controller
                control={form.control}
                name="responsible"
                render={({ field }) => (
                  <Popover open={openPopover} onOpenChange={setOpenPopover}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openPopover}
                        className="w-full justify-between h-auto min-h-10 py-2"
                      >
                        <div className="flex items-center gap-2">
                          {field.value ? (
                            <>
                              <Avatar className="size-6">
                                <AvatarImage
                                  src={
                                    participants.find(
                                      (p) => p.user.id === field.value?.id,
                                    )?.user.image ?? ""
                                  }
                                />
                                <AvatarFallback className="text-[10px]">
                                  {field.value.name
                                    .substring(0, 2)
                                    .toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm font-medium">
                                {field.value.name}
                              </span>
                            </>
                          ) : (
                            <span className="text-muted-foreground font-normal text-sm">
                              Selecionar responsável...
                            </span>
                          )}
                        </div>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Pesquisar participante..." />
                        <CommandList>
                          <CommandEmpty>
                            Nenhum participante encontrado.
                          </CommandEmpty>
                          <CommandGroup>
                            {participants.map((participant) => {
                              const isSelected =
                                field.value?.id === participant.user.id;
                              return (
                                <CommandItem
                                  className="cursor-pointer"
                                  key={participant.user.id}
                                  onSelect={() => {
                                    field.onChange({
                                      id: participant.user.id,
                                      name: participant.user.name,
                                    });
                                    setOpenPopover(false);
                                  }}
                                >
                                  <Avatar className="size-6 mr-2">
                                    <AvatarImage
                                      src={participant.user.image ?? ""}
                                    />
                                    <AvatarFallback>
                                      {participant.user.name
                                        .substring(0, 2)
                                        .toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex flex-col">
                                    <span className="text-sm font-medium">
                                      {participant.user.name}
                                    </span>
                                    <span className="text-xs text-muted-foreground font-normal">
                                      {participant.user.email}
                                    </span>
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
                )}
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
