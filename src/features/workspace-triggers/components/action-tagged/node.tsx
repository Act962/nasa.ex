"use client";

import { Node, NodeProps, useReactFlow } from "@xyflow/react";
import { memo, useEffect, useState } from "react";
import { Check, TagsIcon } from "lucide-react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { WsBaseTriggerNode } from "@/features/workspace-triggers/components/base-trigger-node";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Spinner } from "@/components/ui/spinner";
import { useListTags } from "@/features/workspace/hooks/use-workspace";
import { cn } from "@/lib/utils";

type Values = { tagIds: string[] };
type Data = { action?: Partial<Values> & { tagId?: string } };

export const WsActionTaggedNode = memo((props: NodeProps<Node<Data>>) => {
  const [open, setOpen] = useState(false);
  const [openPopover, setOpenPopover] = useState(false);
  const { setNodes } = useReactFlow();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { tags, isLoading } = useListTags(workspaceId);

  const initialTagIds: string[] =
    props.data?.action?.tagIds ??
    (props.data?.action?.tagId ? [props.data.action.tagId] : []);

  const [selected, setSelected] = useState<string[]>(initialTagIds);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSelected(initialTagIds);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toggle = (id: string) => {
    setError(null);
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );
  };

  const save = () => {
    if (selected.length === 0) {
      setError("Selecione ao menos uma etiqueta");
      toast.error("Selecione ao menos uma etiqueta para o gatilho.");
      return;
    }
    setNodes((nodes) =>
      nodes.map((n) =>
        n.id === props.id
          ? { ...n, data: { ...(n.data as any), action: { tagIds: selected } } }
          : n,
      ),
    );
    setOpen(false);
  };

  const configuredCount = initialTagIds.length;
  const description =
    configuredCount === 0
      ? "Nenhuma etiqueta configurada"
      : configuredCount === 1
        ? "1 etiqueta configurada"
        : `${configuredCount} etiquetas configuradas`;

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ação recebe etiqueta</DialogTitle>
            <DialogDescription>
              Selecione uma ou mais etiquetas. O gatilho dispara quando qualquer
              uma delas for adicionada.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup>
            <Field>
              <FieldLabel>Etiquetas</FieldLabel>
              <Popover open={openPopover} onOpenChange={setOpenPopover}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openPopover}
                    className="w-full justify-start h-auto min-h-10 py-2"
                  >
                    <div className="flex flex-wrap gap-1">
                      {selected.length > 0 ? (
                        <>
                          {selected.slice(0, 5).map((id) => {
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
                          {selected.length > 5 && (
                            <Badge variant="outline" className="font-normal">
                              +{selected.length - 5}
                            </Badge>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground">
                          Selecione as etiquetas...
                        </span>
                      )}
                    </div>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Pesquisar etiqueta..." />
                    <CommandList>
                      {isLoading ? (
                        <div className="flex items-center justify-center p-4">
                          <Spinner />
                        </div>
                      ) : (
                        <>
                          <CommandEmpty>
                            Nenhuma etiqueta encontrada.
                          </CommandEmpty>
                          <CommandGroup>
                            {tags.map((tag) => {
                              const isSelected = selected.includes(tag.id);
                              return (
                                <CommandItem
                                  key={tag.id}
                                  value={`${tag.id}-${tag.name}`}
                                  onSelect={() => toggle(tag.id)}
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
                                  <span
                                    className="inline-block size-2 rounded-full"
                                    style={{ background: tag.color }}
                                  />
                                  <span>{tag.name}</span>
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
              {error && <FieldError>{error}</FieldError>}
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button
              type="button"
              onClick={save}
              disabled={selected.length === 0}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <WsBaseTriggerNode
        {...props}
        icon={TagsIcon}
        name="Ação etiquetada"
        description={description}
        onSettings={() => setOpen(true)}
        onDoubleClick={() => setOpen(true)}
      />
    </>
  );
});
WsActionTaggedNode.displayName = "WsActionTaggedNode";
