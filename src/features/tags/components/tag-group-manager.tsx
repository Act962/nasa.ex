"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { FolderIcon, PlusIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEFAULT_UI_COLORS } from "@/utils/whatsapp-utils";
import { getContrastColor } from "@/utils/get-contrast-color";
import {
  useTagGroups,
  useCreateTagGroup,
  useUpdateTagGroup,
  useDeleteTagGroup,
} from "../hooks/use-tag-groups";

/**
 * Dialog inline pra gerenciar TagGroups (criar, renomear, mudar cor, deletar).
 * Aberto via botão "Gerenciar grupos" no TagSheet. Delete usa confirmação
 * dupla via ConfirmDialog quando o grupo tem tags ativas (elas vão pra
 * "Sem categoria" com SET NULL).
 */
export function TagGroupManager({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: groupsData, isLoading } = useTagGroups();
  const createGroup = useCreateTagGroup();
  const updateGroup = useUpdateTagGroup();
  const deleteGroup = useDeleteTagGroup();

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(DEFAULT_UI_COLORS[0]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const groups = groupsData?.groups ?? [];

  const handleCreate = () => {
    if (!newName.trim()) return;
    createGroup.mutate(
      { name: newName.trim(), color: newColor },
      {
        onSuccess: () => {
          setNewName("");
          setNewColor(DEFAULT_UI_COLORS[0]);
        },
      },
    );
  };

  const groupToDelete = groups.find((g) => g.id === confirmDeleteId);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Grupos de tags</DialogTitle>
            <DialogDescription>
              Crie seções pra organizar tags por contexto (ex:
              &ldquo;Estética&rdquo; em azul, &ldquo;Mecânica&rdquo; em
              laranja).
            </DialogDescription>
          </DialogHeader>

          {/* Criar novo grupo */}
          <div className="space-y-2 border rounded-md p-3 bg-muted/30">
            <Label className="text-xs">Novo grupo</Label>
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="size-9 rounded-md cursor-pointer shrink-0"
                    style={{ backgroundColor: newColor }}
                    aria-label="Cor do grupo"
                  />
                </PopoverTrigger>
                <PopoverContent>
                  <div className="flex flex-wrap gap-1.5">
                    {DEFAULT_UI_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={cn(
                          "size-5 rounded-sm cursor-pointer hover:scale-110 transition-transform",
                          newColor === c && "ring-1 ring-offset-1 ring-primary",
                        )}
                        style={{ backgroundColor: c }}
                        onClick={() => setNewColor(c)}
                      />
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              <Input
                placeholder="Nome do grupo"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleCreate();
                  }
                }}
              />
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={!newName.trim() || createGroup.isPending}
              >
                <PlusIcon className="size-4" />
                Criar
              </Button>
            </div>
          </div>

          {/* Lista de grupos */}
          <div className="space-y-1 max-h-72 overflow-y-auto scroll-cols-tracking">
            {isLoading && (
              <p className="text-xs text-muted-foreground p-2">Carregando...</p>
            )}
            {!isLoading && groups.length === 0 && (
              <p className="text-xs text-muted-foreground p-2 text-center">
                Nenhum grupo criado ainda.
              </p>
            )}
            {groups.map((g) => (
              <GroupRow
                key={g.id}
                group={g}
                onSave={(name, color) =>
                  updateGroup.mutate({ id: g.id, name, color })
                }
                onDelete={() => setConfirmDeleteId(g.id)}
              />
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirma delete */}
      <Dialog
        open={!!confirmDeleteId}
        onOpenChange={(o) => !o && setConfirmDeleteId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Excluir grupo &ldquo;{groupToDelete?.name}&rdquo;?
            </DialogTitle>
            <DialogDescription>
              {groupToDelete && groupToDelete.activeTagCount > 0 ? (
                <>
                  As <b>{groupToDelete.activeTagCount}</b> tag(s) deste grupo
                  vão pra &ldquo;Sem categoria&rdquo;. Você pode movê-las pra
                  outro grupo depois sem perder histórico.
                </>
              ) : (
                "Grupo vazio — exclusão segura."
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!confirmDeleteId) return;
                deleteGroup.mutate(
                  { id: confirmDeleteId },
                  { onSuccess: () => setConfirmDeleteId(null) },
                );
              }}
              disabled={deleteGroup.isPending}
            >
              {deleteGroup.isPending ? "Excluindo..." : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Linha de um grupo (editável inline) ──────────────────────────────────────
function GroupRow({
  group,
  onSave,
  onDelete,
}: {
  group: {
    id: string;
    name: string;
    color: string;
    activeTagCount: number;
  };
  onSave: (name: string, color: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(group.name);
  const [color, setColor] = useState(group.color);

  const handleSave = () => {
    if (!name.trim()) return;
    if (name === group.name && color === group.color) {
      setEditing(false);
      return;
    }
    onSave(name.trim(), color);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-2 p-2 border rounded-md bg-card">
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="size-8 rounded-md cursor-pointer shrink-0"
              style={{ backgroundColor: color }}
            />
          </PopoverTrigger>
          <PopoverContent>
            <div className="flex flex-wrap gap-1.5">
              {DEFAULT_UI_COLORS.map((c) => (
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
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSave();
            }
            if (e.key === "Escape") setEditing(false);
          }}
          className="flex-1"
          autoFocus
        />
        <Button size="sm" onClick={handleSave}>
          Salvar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/40 group/row">
      <Badge
        className="font-medium gap-1.5"
        style={{
          backgroundColor: group.color,
          color: getContrastColor(group.color),
        }}
      >
        <FolderIcon className="size-3" />
        {group.name}
      </Badge>
      <span className="text-[10px] text-muted-foreground">
        {group.activeTagCount} tag(s)
      </span>
      <div className="ml-auto flex items-center gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => setEditing(true)}
          title="Editar"
        >
          <PencilIcon className="size-3.5" />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={onDelete}
          className="text-destructive hover:text-destructive"
          title="Excluir grupo"
        >
          <Trash2Icon className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
