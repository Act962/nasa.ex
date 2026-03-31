"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Uploader } from "@/components/file-uploader/uploader";
import { useUpdateWorkspace } from "@/features/workspace/hooks/use-workspace";

export function GeneralTab({ workspace }: { workspace: any }) {
  const updateWorkspace = useUpdateWorkspace();
  const [name, setName] = useState(workspace.name);
  const [description, setDescription] = useState(workspace.description || "");
  const [color, setColor] = useState(workspace.color || "#1447e6");
  const [coverImage, setCoverImage] = useState<string | null>(workspace.coverImage || null);

  const handleSave = () => {
    updateWorkspace.mutate({ workspaceId: workspace.id, name, description, color, coverImage });
  };

  return (
    <div className="w-full space-y-6">
      <div>
        <h3 className="text-lg font-medium">Informações do Workspace</h3>
        <p className="text-sm text-muted-foreground">
          Atualize as informações básicas do seu espaço de trabalho.
        </p>
      </div>

      <div className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="name">Nome do Workspace</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Marketing, Vendas, etc." />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="description">Descrição</Label>
          <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descreva o propósito deste workspace..." />
        </div>

        <div className="grid gap-2">
          <Label>Cor de Identificação</Label>
          <div className="flex items-center gap-2">
            <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="size-10 p-1 cursor-pointer" />
            <Input value={color} onChange={(e) => setColor(e.target.value)} className="font-mono text-sm uppercase max-w-[120px]" />
          </div>
        </div>

        <div className="grid gap-2">
          <Label>Imagem de Capa</Label>
          <p className="text-xs text-muted-foreground">A imagem será exibida como fundo do workspace com baixa opacidade.</p>
          <Uploader value={coverImage ?? ""} onConfirm={(val) => setCoverImage(val || null)} />
        </div>
      </div>

      <Button onClick={handleSave} disabled={updateWorkspace.isPending} className="w-full sm:w-auto">
        {updateWorkspace.isPending ? "Salvando..." : "Salvar alterações"}
      </Button>
    </div>
  );
}
