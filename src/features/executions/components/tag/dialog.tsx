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
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
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
import { useTags } from "@/features/tags/hooks/use-tags";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

const formSchema = z.object({
  type: z.enum(["ADD", "REMOVE"]),
  tagsIds: z.array(z.string()).min(1, "Campo obrigatório"),
});

export type TagFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: TagFormValues) => void;
  defaultValues?: Partial<TagFormValues>;
}

export const TagDialog = ({
  open,
  onOpenChange,
  onSubmit,
  defaultValues,
}: Props) => {
  const { trackingId } = useParams<{ trackingId: string }>();
  const [openPopover, setOpenPopover] = useState(false);
  const form = useForm<TagFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaultValues ?? {
      type: "ADD",
      tagsIds: [],
    },
  });

  // Inclui arquivadas pra continuar mostrando tags já selecionadas em
  // workflows existentes (não confundir o user). A UI marca arquivadas
  // visualmente + bloqueia novo pick. Default não-arquivada já vem
  // selecionável e marcável normalmente.
  const { tags, isLoadingTags } = useTags({
    trackingId: "ALL",
    includeArchived: true,
  });

  const handleSubmit = (values: TagFormValues) => {
    onSubmit(values);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gerenciar Tags</DialogTitle>
          <DialogDescription>
            Selecione as tags que deseja adicionar ou remover do lead.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="type">Ação</FieldLabel>
              <Controller
                name="type"
                control={form.control}
                render={({ field }) => (
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <SelectTrigger id="type" className="w-full">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADD">Adicionar</SelectItem>
                      <SelectItem value="REMOVE">Remover</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError>{form.formState.errors.type?.message}</FieldError>
            </Field>

            <Field>
              <FieldLabel>Tag</FieldLabel>
              <Controller
                name="tagsIds"
                control={form.control}
                render={({ field }) => (
                  <Popover open={openPopover} onOpenChange={setOpenPopover}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openPopover}
                        className="w-full justify-start h-auto min-h-10 py-2"
                      >
                        <div className="min-h-0 max-h-60 overflow-y-auto scroll-cols-tracking flex flex-wrap gap-1">
                          {field.value && field.value.length > 0 ? (
                            <>
                              {field.value.slice(0, 5).map((id) => {
                                const tag = tags.find((t) => t.id === id);
                                return (
                                  <Badge
                                    key={id}
                                    variant="secondary"
                                    className="font-normal"
                                    style={{
                                      backgroundColor: tag?.color || undefined,
                                      color: tag?.color ? "#fff" : undefined,
                                    }}
                                  >
                                    {tag?.name || id}
                                  </Badge>
                                );
                              })}
                              {field.value.length > 5 && (
                                <Badge
                                  variant="outline"
                                  className="font-normal"
                                >
                                  +{field.value.length - 5}
                                </Badge>
                              )}
                            </>
                          ) : (
                            <span className="text-muted-foreground">
                              Selecione as tags...
                            </span>
                          )}
                        </div>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 " align="start">
                      <Command>
                        <CommandInput placeholder="Pesquisar tag..." />
                        <CommandList onWheel={(e)=>e.stopPropagation()} className="min-h-0 max-h-60 overflow-y-auto scroll-cols-tracking">
                          {isLoadingTags ? (
                            <div className="flex items-center justify-center p-4">
                              <Spinner />
                            </div>
                          ) : (
                            <>
                              <CommandEmpty>
                                Nenhuma tag encontrada.
                              </CommandEmpty>
                              <CommandGroup>
                                {/* Ordena: ativas primeiro, arquivadas depois.
                                    Arquivadas ficam visíveis (pra mostrar
                                    quando já estão selecionadas em workflow
                                    existente) mas são bloqueadas pra novos
                                    picks. */}
                                {[...tags]
                                  .sort((a, b) =>
                                    Number(a.isArchived ?? false) -
                                    Number(b.isArchived ?? false),
                                  )
                                  .map((tag) => {
                                    const isSelected = field.value?.includes(
                                      tag.id,
                                    );
                                    const isArchived = tag.isArchived ?? false;
                                    // Arquivada NÃO selecionada = não pode picar.
                                    // Arquivada já selecionada = pode desmarcar (limpa workflow).
                                    const disabled = isArchived && !isSelected;
                                    return (
                                      <CommandItem
                                        key={tag.id}
                                        value={`${tag.id}-${tag.name}`}
                                        disabled={disabled}
                                        onSelect={() => {
                                          if (disabled) return;
                                          const current = field.value || [];
                                          const next = isSelected
                                            ? current.filter(
                                                (id) => id !== tag.id,
                                              )
                                            : [...current, tag.id];
                                          field.onChange(next);
                                        }}
                                        className={cn(
                                          isArchived && "opacity-60",
                                        )}
                                      >
                                        <div
                                          className={cn(
                                            "flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                            isSelected
                                              ? "bg-primary text-primary-foreground"
                                              : "opacity-50 [&_svg]:invisible",
                                          )}
                                        >
                                          <Check className="h-4 w-4" />
                                        </div>

                                        <span className={cn(isArchived && "line-through")}>
                                          {tag.name}
                                        </span>
                                        {isArchived && (
                                          <span className="ml-auto text-[10px] text-amber-600 font-medium">
                                            arquivada
                                          </span>
                                        )}
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
                )}
              />
              <FieldError>{form.formState.errors.tagsIds?.message}</FieldError>
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
