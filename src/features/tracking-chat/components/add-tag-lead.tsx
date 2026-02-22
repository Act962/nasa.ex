"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useMutationWhatsappTags,
  useTags,
} from "@/features/tags/hooks/use-tags";
import {
  useSyncWhatsappTagsMutation,
  useTag,
} from "@/features/tags/hooks/use-tag";
import { Plus, Tag as TagIcon, Check, ArrowLeftRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { WhatsappIcon } from "@/features/leads/components/whatsapp";

const WA_COLORS = [
  "#FF8B8B",
  "#74B9FF",
  "#FFD93D",
  "#D6B4FC",
  "#C5D1D8",
  "#60E6C5",
  "#F8B4F2",
  "#E9C46A",
  "#7096F8",
  "#E5F27F",
  "#40C4FF",
  "#FFC9C5",
  "#A1E3B9",
  "#F06292",
  "#29B6F6",
  "#8BC34A",
  "#FFA726",
  "#B3E5FC",
  "#9FA8DA",
  "#9575CD",
];

interface AddTagLeadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token?: string | null;
  leadId: string;
  trackingId: string;
  initialSelectedTagIds: string[];
}

export function AddTagLead({
  open,
  onOpenChange,
  leadId,
  trackingId,
  initialSelectedTagIds,
  token,
}: AddTagLeadProps) {
  const { tags, isLoadingTags } = useTags({ trackingId });
  const { createTag } = useTag();
  const updateMutation = useMutationWhatsappTags({ trackingId });
  const syncWhatsappTags = useSyncWhatsappTagsMutation(trackingId);

  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(
    initialSelectedTagIds,
  );
  const [isCreating, setIsCreating] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [selectedColor, setSelectedColor] = useState(WA_COLORS[0]);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const handleToggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId],
    );
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) {
      toast.error("O nome da etiqueta não pode estar vazio.");
      return;
    }

    try {
      await createTag.mutateAsync(
        {
          name: newTagName,
          color: selectedColor,
          trackingId,
        },
        {
          onSuccess: (newTag) => {
            setSelectedTagIds((prev) => [...prev, newTag.tagId]);
            setNewTagName("");
            setIsCreating(false);
            setShowColorPicker(false);
          },
        },
      );
    } catch (error) {}
  };

  function handleSyncWhatsappTags() {
    if (!token) return toast.error("Token não encontrado.");
    syncWhatsappTags.mutate({ apikey: token });
  }

  const handleSave = () => {
    if (!token) return toast.error("Token não encontrado.");
    updateMutation.mutate(
      {
        id: leadId,
        tagIds: selectedTagIds,
        apiKey: token,
      },
      {
        onSuccess: () => {
          toast.success("Tags atualizadas com sucesso!");
          onOpenChange(false);
        },
        onError: (err) => {
          toast.error("Erro ao atualizar tags.");
          console.error(err);
        },
      },
    );
  };

  const handleCancel = () => {
    if (isCreating) {
      setIsCreating(false);
      setNewTagName("");
    } else {
      onOpenChange(false);
    }
  };

  const tagsOrdened = useMemo(() => {
    return [...tags].sort((a, b) => a.name.localeCompare(b.name));
  }, [tags]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 sm:max-w-[400px] bg-background border-none shadow-2xl overflow-hidden rounded-2xl">
        <DialogHeader className="p-4 flex flex-row items-center gap-4 space-y-0 border-b border-border/10">
          <DialogTitle>Etiquetar itens</DialogTitle>
          <Button
            variant="outline"
            size={"xs"}
            onClick={handleSyncWhatsappTags}
            disabled={syncWhatsappTags.isPending}
          >
            {syncWhatsappTags.isPending ? (
              <Spinner />
            ) : (
              <ArrowLeftRightIcon className="size-4 text-accent-foreground" />
            )}
            <span className="text-base font-medium">Sincronizar</span>
          </Button>
        </DialogHeader>

        <div className="flex flex-col max-h-[70vh]">
          {/* Create Tag Section */}
          <div className="p-4">
            {!isCreating ? (
              <Button
                variant="ghost"
                className="w-full justify-start gap-4 px-2 h-auto hover:bg-accent/5"
                disabled={syncWhatsappTags.isPending}
                onClick={() => setIsCreating(true)}
              >
                <div className="size-10 rounded-full bg-accent/20 flex items-center justify-center">
                  <Plus className="size-5 text-accent-foreground" />
                </div>
                <span className="text-base font-medium">Nova etiqueta</span>
              </Button>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Popover
                    open={showColorPicker}
                    onOpenChange={setShowColorPicker}
                  >
                    <PopoverTrigger>
                      <div
                        className="size-10 rounded-full flex items-center justify-center cursor-pointer shadow-sm"
                        style={{ backgroundColor: selectedColor }}
                      >
                        <TagIcon className="size-4 text-white drop-shadow-sm font-bold fill-white" />
                      </div>
                    </PopoverTrigger>
                    <PopoverContent align="start">
                      <div className="bg-accent/5 rounded-xl animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="grid grid-cols-5 gap-3 justify-items-center">
                          {WA_COLORS.map((color) => (
                            <div
                              key={color}
                              className={cn(
                                "size-8 rounded-full cursor-pointer transition-all hover:scale-110 border-2",
                                selectedColor === color
                                  ? "border-white ring-2 ring-emerald-500/50 scale-110"
                                  : "border-transparent",
                              )}
                              style={{ backgroundColor: color }}
                              onClick={() => setSelectedColor(color)}
                            />
                          ))}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                  <div className="flex-1 relative group flex items-center">
                    <Input
                      placeholder="Nova etiqueta"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      className="border-0 border-b-2 border-emerald-500 rounded-none bg-transparent focus-visible:ring-0 px-0 text-base placeholder:text-muted-foreground/50 h-10"
                      autoFocus
                    />
                    <div className="flex items-center gap-2 absolute right-0">
                      <Check
                        className={cn(
                          "size-5 cursor-pointer transition-colors",
                          newTagName.trim()
                            ? "text-emerald-500 hover:text-emerald-600"
                            : "text-muted-foreground/30 pointer-events-none",
                        )}
                        onClick={handleCreateTag}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <ScrollArea className="flex-1 px-4 pb-4 overflow-y-auto">
            <div className="space-y-1">
              {tagsOrdened.map((tag) => (
                <div
                  key={tag.id}
                  className="flex items-center justify-between group px-2 py-3 rounded-xl hover:bg-accent/5 cursor-pointer transition-colors"
                  onClick={() => handleToggleTag(tag.id)}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="size-10 rounded-full flex items-center justify-center shadow-sm"
                      style={{ backgroundColor: tag.color || "#ccc" }}
                    >
                      <TagIcon className="size-5 text-white fill-white" />
                    </div>
                    <span className="text-base font-medium">{tag.name}</span>
                    {tag.whatsappId && (
                      <WhatsappIcon className="size-4 text-[#25D366]" />
                    )}
                  </div>
                  <Checkbox
                    checked={selectedTagIds.includes(tag.id)}
                    onCheckedChange={() => handleToggleTag(tag.id)}
                    className="size-5 rounded-md border-2 border-muted-foreground/30 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500 transition-all"
                  />
                </div>
              ))}
              {isLoadingTags && (
                <div className="p-8 text-center text-muted-foreground">
                  Carregando etiquetas...
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        <div className="p-4 flex items-center justify-end gap-3 border-t border-border/10 bg-[#121212]/50">
          <Button variant="ghost" onClick={handleCancel}>
            Cancelar
          </Button>
          <Button
            disabled={
              updateMutation.isPending ||
              (!isCreating &&
                selectedTagIds.length === initialSelectedTagIds.length &&
                selectedTagIds.every((id) =>
                  initialSelectedTagIds.includes(id),
                ))
            }
            onClick={handleSave}
          >
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
