"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  useListTags,
  useCreateTag,
  useUpdateTag,
  useDeleteTag,
} from "@/features/workspace/hooks/use-workspace";

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

export function LabelsTab({ workspaceId }: { workspaceId: string }) {
  const { tags, isLoading } = useListTags(workspaceId);
  const createTag = useCreateTag();
  const updateTag = useUpdateTag();
  const deleteTag = useDeleteTag(workspaceId);

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#7C3AED");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");

  const handleCreate = () => {
    if (!newName.trim()) return;
    createTag.mutate(
      { workspaceId, name: newName.trim(), color: newColor },
      {
        onSuccess: () => {
          setNewName("");
          setNewColor("#7C3AED");
        },
      },
    );
  };

  const handleSaveEdit = () => {
    if (!editingId) return;
    updateTag.mutate(
      { tagId: editingId, name: editName.trim(), color: editColor },
      { onSuccess: () => setEditingId(null) },
    );
  };

  if (isLoading)
    return (
      <div className="text-sm text-muted-foreground">
        Carregando etiquetas...
      </div>
    );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Etiquetas</h3>
        <p className="text-sm text-muted-foreground">
          Gerencie as etiquetas para classificar ações neste workspace.
        </p>
      </div>

      {/* Create */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-3 border rounded-lg bg-muted/30">
        <div className="flex items-center gap-2 flex-wrap">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              className={cn(
                "size-5 rounded-full transition-all",
                newColor === c && "ring-2 ring-offset-1 ring-foreground",
              )}
              style={{ backgroundColor: c }}
              onClick={() => setNewColor(c)}
            />
          ))}
          <Input
            type="color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            className="size-7 p-0.5 cursor-pointer w-7"
          />
        </div>
        <Input
          placeholder="Nome da etiqueta..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="flex-1 h-8"
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
        />
        <Button
          size="sm"
          onClick={handleCreate}
          disabled={!newName.trim() || createTag.isPending}
        >
          <Plus className="size-4 mr-1" />
          Criar
        </Button>
      </div>

      {/* Tag list */}
      <div className="gap-2 ">
        {tags.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhuma etiqueta criada ainda.
          </p>
        )}
        {tags.map((tag: any) => (
          <div
            key={tag.id}
            className="flex items-center gap-3 p-3 border rounded-lg bg-background group flex-col sm:flex-row"
          >
            {editingId === tag.id ? (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      className={cn(
                        "size-4 rounded-full",
                        editColor === c &&
                          "ring-2 ring-offset-1 ring-foreground",
                      )}
                      style={{ backgroundColor: c }}
                      onClick={() => setEditColor(c)}
                    />
                  ))}
                  <Input
                    type="color"
                    value={editColor}
                    onChange={(e) => setEditColor(e.target.value)}
                    className="size-6 p-0.5 cursor-pointer w-6"
                  />
                </div>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex-1 h-8"
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && handleSaveEdit()}
                />
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8 text-emerald-600"
                    onClick={handleSaveEdit}
                  >
                    <Check className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    onClick={() => setEditingId(null)}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <span
                  className="size-4 rounded-full shrink-0"
                  style={{ backgroundColor: tag.color }}
                />
                <span className="flex-1 font-medium text-sm">{tag.name}</span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    onClick={() => {
                      setEditingId(tag.id);
                      setEditName(tag.name);
                      setEditColor(tag.color);
                    }}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7 text-destructive hover:bg-destructive/10"
                    onClick={() =>
                      confirm(`Excluir etiqueta "${tag.name}"?`) &&
                      deleteTag.mutate({ tagId: tag.id })
                    }
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
