"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Uploader } from "@/components/file-uploader/uploader";
import { useUpdateWorkspace } from "@/features/workspace/hooks/use-workspace";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQueryTrackings } from "@/features/trackings/hooks/use-trackings";

// O Select do shadcn não aceita item com value vazio, então "sem vínculo"
// vira um sentinel traduzido pra `null` no submit (que desvincula).
const NO_TRACKING = "none";

interface GeneralTabWorkspace {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  coverImage?: string | null;
  trackingId?: string | null;
}

export function GeneralTab({ workspace }: { workspace: GeneralTabWorkspace }) {
  const updateWorkspace = useUpdateWorkspace();
  const { trackings, isLoading: isLoadingTrackings } = useQueryTrackings();
  const [name, setName] = useState(workspace.name);
  const [description, setDescription] = useState(workspace.description || "");
  const [color, setColor] = useState(workspace.color || "#1447e6");
  const [coverImage, setCoverImage] = useState<string | null>(
    workspace.coverImage || null,
  );
  const [trackingId, setTrackingId] = useState(
    workspace.trackingId ?? NO_TRACKING,
  );

  const handleSave = () => {
    updateWorkspace.mutate({
      workspaceId: workspace.id,
      name,
      description,
      color,
      coverImage,
      trackingId: trackingId === NO_TRACKING ? null : trackingId,
    });
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
          <Label>Tracking vinculado</Label>
          <p className="text-xs text-muted-foreground">
            Um tracking pode ter vários workspaces. O vínculo é opcional e não
            altera quem tem acesso a este workspace.
          </p>
          <Select
            value={trackingId}
            onValueChange={setTrackingId}
            disabled={isLoadingTrackings}
          >
            <SelectTrigger className="w-full sm:max-w-[320px]">
              <SelectValue placeholder="Nenhum tracking" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_TRACKING}>Nenhum tracking</SelectItem>
              {trackings.map((tracking) => (
                <SelectItem key={tracking.id} value={tracking.id}>
                  {tracking.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
