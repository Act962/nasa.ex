"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateOrgProject, useUpdateOrgProject } from "../hooks/use-org-projects";

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
  editing?: { id: string; name: string; type: string; description?: string | null; color?: string | null } | null;
}

export function ProjectFormDialog({ open, onOpenChange, editing }: Props) {
  const create = useCreateOrgProject();
  const update = useUpdateOrgProject();

  const [name, setName] = useState("");
  const [type, setType] = useState("client");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#7c3aed");

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setType(editing.type);
      setDescription(editing.description ?? "");
      setColor(editing.color ?? "#7c3aed");
    } else {
      setName(""); setType("client"); setDescription(""); setColor("#7c3aed");
    }
  }, [editing, open]);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    if (editing) {
      await update.mutateAsync({ projectId: editing.id, name, type, description: description || null, color });
    } else {
      await create.mutateAsync({ name, type, description: description || undefined, color });
    }
    onOpenChange(false);
  };

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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || isPending}>
            {isPending ? "Salvando..." : editing ? "Salvar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
