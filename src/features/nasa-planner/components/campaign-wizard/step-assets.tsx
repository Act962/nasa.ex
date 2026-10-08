"use client";

import { PlusIcon, Trash2Icon, LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ASSET_TYPES, type AssetDraft, type DraftSetter, type WizardProject } from "./wizard-options";

/** Passo 3 do assistente de campanha: materiais de marca. */

interface StepAssetsProps {
  selectedProject: WizardProject | undefined;
  newAsset: AssetDraft;
  setNewAsset: DraftSetter<AssetDraft>;
  assets: AssetDraft[];
  setAssets: DraftSetter<AssetDraft[]>;
  onAddAsset: () => void;
}

export function StepAssets({ selectedProject, newAsset, setNewAsset, assets, setAssets, onAddAsset }: StepAssetsProps) {
  return (
    <div className="space-y-4">
      {selectedProject && (
        <div className="flex items-center gap-2 text-xs text-info bg-info/15 px-3 py-2 rounded-lg">
          <div className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: selectedProject.color ?? "#7c3aed" }} />
          Materiais pré-carregados do projeto <strong>{selectedProject.name}</strong>. Edite ou adicione mais abaixo.
        </div>
      )}
      <p className="text-sm text-muted-foreground">Salve os materiais de identidade visual da campanha.</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Tipo</Label>
          <Select value={newAsset.assetType} onValueChange={(v) => setNewAsset((a) => ({ ...a, assetType: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ASSET_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.emoji} {t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Nome *</Label>
          <Input placeholder="Ex: Logo principal" value={newAsset.name} onChange={(e) => setNewAsset((a) => ({ ...a, name: e.target.value }))} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="flex items-center gap-1"><LinkIcon className="size-3.5" /> URL / Link</Label>
        <Input placeholder="https://..." value={newAsset.url} onChange={(e) => setNewAsset((a) => ({ ...a, url: e.target.value }))} />
      </div>
      <Button variant="outline" size="sm" onClick={onAddAsset} disabled={!newAsset.name} className="gap-1">
        <PlusIcon className="size-3.5" /> Adicionar Material
      </Button>
      {assets.length > 0 && (
        <div className="space-y-2">
          {assets.map((asset, i) => (
            <div key={i} className="flex items-center justify-between text-sm bg-muted/50 px-3 py-2 rounded-lg">
              <span>{ASSET_TYPES.find((t) => t.value === asset.assetType)?.emoji} <span className="font-medium">{asset.name}</span></span>
              <Button variant="ghost" size="icon" className="size-6" onClick={() => setAssets((a) => a.filter((_, j) => j !== i))}>
                <Trash2Icon className="size-3 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
