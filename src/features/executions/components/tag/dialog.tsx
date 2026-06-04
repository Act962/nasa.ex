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
import { AlertTriangle, Check, X } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import {
  Controller,
  useForm,
  useWatch,
  type Control,
} from "react-hook-form";
import { z } from "zod";

/**
 * Detecta IDs que não são tags reais — placeholders deixados por presets
 * agent-mode (ex: `<<TAG_OPCAO_X_ID>>`) ou IDs órfãos. Esses IDs precisam
 * ser removíveis no dialog mesmo não aparecendo no popover de seleção
 * (que só lista tags do banco), senão o user fica preso ao placeholder.
 */
const PLACEHOLDER_TAG_ID_RX = /^<<.+>>$/;
export const isPlaceholderTagId = (id: string) =>
  PLACEHOLDER_TAG_ID_RX.test(id);

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

/**
 * Aviso renderizado abaixo do field de tags quando há IDs que não casam
 * com nenhuma tag real do banco. Mostra os badges com botão "Limpar
 * tudo" pro user resolver o problema rapidamente em workflows herdados
 * de presets agent-mode.
 */
function PlaceholderWarning({
  control,
  tags,
}: {
  control: Control<TagFormValues>;
  tags: Array<{ id: string; name: string }>;
}) {
  const selectedIds = useWatch({ control, name: "tagsIds" }) ?? [];
  const orphanIds = selectedIds.filter(
    (id) => !tags.find((t) => t.id === id),
  );
  if (orphanIds.length === 0) return null;

  const onlyPlaceholders = orphanIds.every((id) => isPlaceholderTagId(id));
  return (
    <div className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs space-y-1.5">
      <div className="flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-300">
        <AlertTriangle className="size-3.5" />
        {onlyPlaceholders
          ? `${orphanIds.length} placeholder(s) não resolvido(s)`
          : `${orphanIds.length} ID(s) inválido(s) ou tag(s) inexistente(s)`}
      </div>
      <p className="text-muted-foreground leading-snug">
        Esses IDs vieram de um preset do sistema e precisam ser substituídos
        por tags reais. Clique no <span className="font-mono">X</span> do
        badge acima pra remover cada um, depois escolha uma tag real no
        campo.
      </p>
    </div>
  );
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
                render={({ field }) => {
                  // IDs que estão no array mas não existem na lista do banco
                  // = placeholders de preset agent-mode (`<<TAG_OPCAO_X_ID>>`)
                  // ou tags deletadas hard. Precisam ser removíveis aqui
                  // pois o popover só lista tags reais — sem essa UI, ficam
                  // grudados e quebram o workflow no executor.
                  const selectedIds = field.value ?? [];
                  const orphanIds = selectedIds.filter(
                    (id) => !tags.find((t) => t.id === id),
                  );
                  const removeId = (id: string) => {
                    field.onChange(selectedIds.filter((x) => x !== id));
                  };
                  return (
                  <Popover open={openPopover} onOpenChange={setOpenPopover}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openPopover}
                        className="w-full justify-start h-auto min-h-10 py-2"
                      >
                        <div className="min-h-0 max-h-60 overflow-y-auto scroll-cols-tracking flex flex-wrap gap-1">
                          {selectedIds.length > 0 ? (
                            <>
                              {selectedIds.slice(0, 5).map((id) => {
                                const tag = tags.find((t) => t.id === id);
                                const isPlaceholder = isPlaceholderTagId(id);
                                const isOrphan = !tag;
                                return (
                                  <Badge
                                    key={id}
                                    variant="secondary"
                                    className={cn(
                                      "font-normal gap-1 pr-1",
                                      isPlaceholder &&
                                        "bg-amber-500/15 text-amber-700 border border-amber-500/40 dark:text-amber-300",
                                      isOrphan &&
                                        !isPlaceholder &&
                                        "bg-red-500/15 text-red-700 border border-red-500/40 dark:text-red-300",
                                    )}
                                    style={
                                      tag && !isOrphan
                                        ? {
                                            backgroundColor: tag.color || undefined,
                                            color: tag.color ? "#fff" : undefined,
                                          }
                                        : undefined
                                    }
                                  >
                                    {tag?.name || id}
                                    {/* X clicável remove a tag direto sem
                                        precisar abrir o popover. Essencial
                                        pra placeholders/órfãos que não têm
                                        item correspondente no popover. */}
                                    <span
                                      role="button"
                                      tabIndex={0}
                                      aria-label={`Remover ${tag?.name ?? id}`}
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        removeId(id);
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          removeId(id);
                                        }
                                      }}
                                      className="ml-0.5 inline-flex items-center justify-center rounded-sm hover:bg-black/20 dark:hover:bg-white/20 cursor-pointer"
                                    >
                                      <X className="size-3" />
                                    </span>
                                  </Badge>
                                );
                              })}
                              {selectedIds.length > 5 && (
                                <Badge
                                  variant="outline"
                                  className="font-normal"
                                >
                                  +{selectedIds.length - 5}
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
                  );
                }}
              />
              <FieldError>{form.formState.errors.tagsIds?.message}</FieldError>
              {/* Warning + lista clicável de placeholders/órfãos. Mostra
                  quando há IDs no array que não casam com nenhuma tag do
                  banco — caso clássico de preset agent-mode com
                  `<<TAG_*>>` literal ou tag deletada hard. Render dentro
                  do Controller pra ter acesso ao field via useWatch. */}
              <PlaceholderWarning control={form.control} tags={tags} />
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
