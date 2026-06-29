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
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  useCreateTag,
  useListTags,
} from "@/features/workspace/hooks/use-workspace";
import { cn } from "@/lib/utils";
import { PlusIcon } from "lucide-react";

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
                          <CommandGroup className="max-h-72 overflow-y-auto scroll-cols-tracking">
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
                    {workspaceId && (
                      <CreateActionTagInline
                        workspaceId={workspaceId}
                        onCreated={(tagId) => {
                          setError(null);
                          setSelected((prev) =>
                            prev.includes(tagId) ? prev : [...prev, tagId],
                          );
                        }}
                      />
                    )}
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

const PRESET_COLORS = [
  "#7C3AED",
  "#DB2777",
  "#DC2626",
  "#D97706",
  "#16A34A",
  "#0891B2",
  "#2563EB",
  "#9333EA",
  "#374151",
  "#6B7280",
];

interface CreateActionTagInlineProps {
  workspaceId: string;
  onCreated: (tagId: string) => void;
}

const CreateActionTagInline = ({
  workspaceId,
  onCreated,
}: CreateActionTagInlineProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const createTag = useCreateTag();

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    createTag.mutate(
      { workspaceId, name: trimmed, color },
      {
        onSuccess: (data) => {
          onCreated(data.tag.id);
          setName("");
          setColor(PRESET_COLORS[0]);
          setIsOpen(false);
        },
      },
    );
  };

  if (!isOpen) {
    return (
      <div className="border-t p-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full justify-start font-normal"
          onClick={() => setIsOpen(true)}
        >
          <PlusIcon className="mr-2 h-4 w-4" />
          Criar nova etiqueta
        </Button>
      </div>
    );
  }

  return (
    <div className="border-t p-2 space-y-2">
      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="size-7 shrink-0 rounded-sm border cursor-pointer"
              style={{ backgroundColor: color }}
              aria-label="Selecionar cor"
            />
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="start">
            <div className="flex flex-wrap gap-1.5 max-w-[200px]">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={cn(
                    "size-5 rounded-sm cursor-pointer hover:scale-110 transition-transform",
                    color === c && "ring-1 ring-offset-1 ring-primary",
                  )}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleCreate();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              setIsOpen(false);
            }
          }}
          placeholder="Nome da etiqueta"
          className="h-8"
        />
      </div>
      <div className="flex items-center justify-end gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen(false)}
        >
          Cancelar
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleCreate}
          disabled={!name.trim() || createTag.isPending}
        >
          {createTag.isPending ? <Spinner /> : "Criar"}
        </Button>
      </div>
    </div>
  );
};
