"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Globe } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useCreateOrgProject,
  useUpdateOrgProject,
  useToggleOrgProjectPublic,
} from "../hooks/use-org-projects";
import { PublicVisibilityDialog } from "@/components/public-visibility-dialog";

const PROJECT_TYPES = [
  { value: "client",  label: "Cliente" },
  { value: "project", label: "Projeto" },
  { value: "entity",  label: "Entidade" },
  { value: "partner", label: "Parceiro" },
  { value: "supplier",label: "Fornecedor" },
  { value: "other",   label: "Outro" },
];

const COLORS = ["#7c3aed","#0ea5e9","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#f97316","#ec4899","#14b8a6"];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing?: {
    id:               string;
    name:             string;
    type:             string;
    description?:     string | null;
    color?:           string | null;
    isPublicOnSpace?: boolean | null;
  } | null;
}

export function ProjectFormDialog({ open, onOpenChange, editing }: Props) {
  const create = useCreateOrgProject();
  const update = useUpdateOrgProject();
  const togglePublic = useToggleOrgProjectPublic();

  const [name, setName] = useState("");
  const [type, setType] = useState("client");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#7c3aed");
  const [isPublicOnSpace, setIsPublicOnSpace] = useState(false);
  const [publicConfirmOpen, setPublicConfirmOpen] = useState(false);

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setType(editing.type);
      setDescription(editing.description ?? "");
      setColor(editing.color ?? "#7c3aed");
      setIsPublicOnSpace(editing.isPublicOnSpace ?? false);
    } else {
      setName(""); setType("client"); setDescription(""); setColor("#7c3aed");
      setIsPublicOnSpace(false);
    }
  }, [editing, open]);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    if (editing) {
      // `isPublicOnSpace` é persistido separado via togglePublic (com consent).
      // Aqui apenas atualizamos os campos descritivos.
      await update.mutateAsync({
        projectId: editing.id, name, type,
        description: description || null, color,
      });
    } else {
      await create.mutateAsync({ name, type, description: description || undefined, color });
    }
    onOpenChange(false);
  };

  /** Switch público: liga → abre dialog de consentimento; desliga → direto. */
  function handlePublicSwitch(next: boolean) {
    if (!editing) return; // novo projeto: só salva tudo no submit
    if (next) {
      setPublicConfirmOpen(true);
    } else {
      togglePublic.mutate(
        {
          projectId: editing.id,
          isPublicOnSpace: false,
        },
        {
          onSuccess: () => setIsPublicOnSpace(false),
        },
      );
    }
  }

  const isPending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar" : "Novo"} Projeto/Cliente</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome *</Label>
            <Input placeholder="Ex: Empresa XYZ" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PROJECT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea placeholder="Breve descrição..." rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Cor</Label>
            <div className="flex items-center gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="size-7 rounded-full border-2 transition-transform hover:scale-110"
                  style={{ backgroundColor: c, borderColor: color === c ? "#000" : "transparent" }}
                />
              ))}
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-7 w-7 rounded-full cursor-pointer border" title="Cor personalizada" />
            </div>
          </div>

          {/* Visibilidade Spacehome — só faz sentido ao editar (criação não tem ID ainda) */}
          {editing && (
            <div className="space-y-2 rounded-lg border border-border/60 bg-muted/30 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="public-on-space" className="cursor-pointer text-sm font-medium">
                    Exibir na Spacehome pública
                  </Label>
                </div>
                <Switch
                  id="public-on-space"
                  checked={isPublicOnSpace}
                  disabled={togglePublic.isPending}
                  onCheckedChange={handlePublicSwitch}
                />
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {isPublicOnSpace
                  ? "Este projeto aparece em /space/[nick] para qualquer visitante."
                  : "Este projeto fica oculto na Spacehome. Só membros da empresa enxergam."}
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || isPending}>
            {isPending ? "Salvando..." : editing ? "Salvar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Dialog de consentimento de visualização pública */}
      <PublicVisibilityDialog
        open={publicConfirmOpen}
        onOpenChange={setPublicConfirmOpen}
        isPending={togglePublic.isPending}
        onConfirm={() => {
          if (!editing) return;
          togglePublic.mutate(
            {
              projectId: editing.id,
              isPublicOnSpace: true,
              consent: true,
            },
            {
              onSuccess: () => {
                setIsPublicOnSpace(true);
                setPublicConfirmOpen(false);
              },
            },
          );
        }}
      />
    </Dialog>
  );
}
