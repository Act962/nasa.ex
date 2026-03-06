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
  FieldDescription,
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
import { useTags } from "@/features/tags/hooks/use-tags";
import { useQueryStatus } from "@/features/trackings/hooks/use-trackings";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, PlusIcon, Trash2Icon, X } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import z from "zod";

const conditionTypeSchema = z.enum(["CONTAINS_TAG", "NOT_CONTAINS_TAG"]);

const conditionSchema = z.object({
  type: conditionTypeSchema,
  tagIds: z.array(z.string()).min(1, "Selecione ao menos uma tag"),
});

const formSchema = z.object({
  statusId: z.string().min(1, "Selecione um status"),
  conditions: z.array(conditionSchema).max(5, "Máximo de 5 condições"),
});

export type MoveLeadStatusTriggerFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: MoveLeadStatusTriggerFormValues) => void;
  defaultValues?: Partial<MoveLeadStatusTriggerFormValues>;
}

export const MoveLeadStatusTriggerDialog = ({
  open,
  onOpenChange,
  onSubmit,
  defaultValues,
}: Props) => {
  const { trackingId } = useParams<{ trackingId: string }>();

  const form = useForm<MoveLeadStatusTriggerFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      statusId: defaultValues?.statusId ?? "",
      conditions: defaultValues?.conditions ?? [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "conditions",
  });

  const { tags } = useTags({ trackingId });

  const handleAddCondition = () => {
    if (fields.length >= 5) {
      toast.error("O limite máximo é de 5 condições");
      return;
    }
    append({ type: "CONTAINS_TAG", tagIds: [] });
  };

  const handleSubmit = (values: MoveLeadStatusTriggerFormValues) => {
    onSubmit(values);
    onOpenChange(false);
  };

  const { status } = useQueryStatus({ trackingId });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Mover Lead para Status</DialogTitle>
          <DialogDescription>
            Configure o status de gatilho e condições opcionais para o lead.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          <FieldGroup>
            <Field>
              <FieldLabel>Status de Ativação</FieldLabel>
              <Controller
                control={form.control}
                name="statusId"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um status" />
                    </SelectTrigger>
                    <SelectContent>
                      {status?.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldDescription>
                O fluxo iniciará quando o lead chegar a este status.
              </FieldDescription>
            </Field>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <FieldLabel className="text-base">Condicionais</FieldLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddCondition}
                  disabled={fields.length >= 5}
                >
                  <PlusIcon className="mr-2 h-4 w-4" />
                  Adicionar Condição
                </Button>
              </div>

              {fields.length === 0 && (
                <div className="rounded-lg border border-dashed p-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    Nenhuma condição adicionada. O fluxo executará para todos os
                    leads neste status.
                  </p>
                </div>
              )}

              <div className="space-y-3">
                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="flex flex-col gap-3 rounded-lg border p-4 bg-muted/30 relative group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <Controller
                            control={form.control}
                            name={`conditions.${index}.type`}
                            render={({ field: typeField }) => (
                              <Select
                                onValueChange={typeField.onChange}
                                value={typeField.value}
                              >
                                <SelectTrigger className="bg-background">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="CONTAINS_TAG">
                                    Contém a tag
                                  </SelectItem>
                                  <SelectItem value="NOT_CONTAINS_TAG">
                                    Não contém a tag
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          />

                          <div className="col-span-3">
                            <Controller
                              control={form.control}
                              name={`conditions.${index}.tagIds`}
                              render={({ field: tagField }) => (
                                <TagMultiSelect
                                  selectedTagIds={tagField.value}
                                  onChange={tagField.onChange}
                                  tags={tags as any[]}
                                  placeholder="Tags..."
                                />
                              )}
                            />
                          </div>
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => remove(index)}
                      >
                        <Trash2Icon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              {fields.length > 0 && (
                <p className="text-[12px] text-muted-foreground italic">
                  * O fluxo só prosseguirá se TODAS as condições acima forem
                  verdadeiras.
                </p>
              )}
            </div>
          </FieldGroup>

          <DialogFooter>
            <Button type="submit">Salvar Gatilho</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

interface TagMultiSelectProps {
  selectedTagIds: string[];
  onChange: (ids: string[]) => void;
  tags: any[];
  placeholder?: string;
}

const TagMultiSelect = ({
  selectedTagIds,
  onChange,
  tags,
  placeholder,
}: TagMultiSelectProps) => {
  const [open, setOpen] = useState(false);

  const handleToggleTag = (tagId: string) => {
    const newIds = selectedTagIds.includes(tagId)
      ? selectedTagIds.filter((id) => id !== tagId)
      : [...selectedTagIds, tagId];
    onChange(newIds);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          className={cn(
            "flex flex-wrap gap-1 min-h-10 p-2 border rounded-md cursor-pointer bg-background hover:bg-accent/50 transition-colors",
            open && "ring-1 ring-ring border-primary",
          )}
        >
          {selectedTagIds.length === 0 && (
            <span className="text-sm text-muted-foreground px-1">
              {placeholder || "Selecionar tags..."}
            </span>
          )}
          {selectedTagIds.map((tagId) => {
            const tag = tags.find((t) => t.id === tagId);
            if (!tag) return null;
            return (
              <Badge
                key={tagId}
                className="text-[11px] h-6 gap-1 pr-1"
                style={{
                  backgroundColor: tag.color || "",
                  color: "white",
                }}
              >
                {tag.name}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleTag(tagId);
                  }}
                  className="hover:bg-foreground/10 rounded-full p-0.5"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar tag..." className="h-9" />
          <CommandList>
            <CommandEmpty>Nenhuma tag encontrada.</CommandEmpty>
            <CommandGroup>
              {tags.map((tag) => (
                <CommandItem
                  key={tag.id}
                  value={tag.id}
                  onSelect={() => handleToggleTag(tag.id)}
                  className="text-sm"
                >
                  <div
                    className={cn(
                      "mr-2 flex size-4 items-center justify-center rounded-sm border border-primary",
                      selectedTagIds.includes(tag.id)
                        ? "bg-primary text-primary-foreground"
                        : "opacity-50 [&_svg]:invisible",
                    )}
                  >
                    <Check className={cn("h-3 w-3")} />
                  </div>
                  <div
                    className="w-2.5 h-2.5 rounded-full mr-2"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span>{tag.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
