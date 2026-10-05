"use client";

import { useRef, useState } from "react";
import { ExternalLink, FileText, Paperclip, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { useAddPlannerBrandKitAsset, useRemovePlannerBrandKitAsset } from "../../hooks/use-planner-brand-kit";
import { brandFileUrl, uploadBrandFile } from "./brand-file-upload";
import type { PlannerBrandKitAsset } from "./brand-kit-types";

/** Lista de itens do kit: fundos, produtos/serviços, materiais e posts de referência (spec 0063, RF-1). */

type AssetKind = PlannerBrandKitAsset["kind"];

const KIND_COPY: Record<AssetKind, { addLabel: string; titlePlaceholder: string; descriptionPlaceholder: string; hasPrice: boolean; isVisual: boolean }> = {
  BACKGROUND: { addLabel: "Fundo ou textura", titlePlaceholder: "Nome do fundo", descriptionPlaceholder: "Quando usar (opcional)", hasPrice: false, isVisual: true },
  PRODUCT: { addLabel: "Produto ou serviço", titlePlaceholder: "Nome do produto ou serviço", descriptionPlaceholder: "O que é e para quem", hasPrice: true, isVisual: true },
  MATERIAL: { addLabel: "Release, site ou material", titlePlaceholder: "Nome (ex.: Release de lançamento)", descriptionPlaceholder: "Resumo (opcional)", hasPrice: false, isVisual: false },
  REFERENCE_POST: { addLabel: "Post de referência", titlePlaceholder: "Ex.: Carrossel de dicas que performou bem", descriptionPlaceholder: "Por que ele é referência", hasPrice: false, isVisual: true },
};

function AssetRow({ organizationId, asset, canEdit }: { organizationId: string; asset: PlannerBrandKitAsset; canEdit: boolean }) {
  const removeAsset = useRemovePlannerBrandKitAsset();
  const fileUrl = brandFileUrl(asset.fileKey);
  const isImage = Boolean(fileUrl && /\.(png|jpe?g|webp|gif|svg|avif)(\?|$)/i.test(fileUrl));
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-card p-2">
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={fileUrl} alt="" className="size-10 shrink-0 rounded-lg object-cover" />
      ) : (
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-panel">
          <FileText className="size-4 text-muted-foreground" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {asset.title}
          {asset.price && <span className="ml-1.5 text-xs font-normal text-muted-foreground">{asset.price}</span>}
        </p>
        {asset.description && <p className="truncate text-xs text-muted-foreground">{asset.description}</p>}
      </div>
      {(asset.url || (fileUrl && !isImage)) && (
        <a href={asset.url ?? fileUrl} target="_blank" rel="noreferrer" aria-label="Abrir" className="text-muted-foreground hover:text-foreground">
          <ExternalLink className="size-4" />
        </a>
      )}
      {canEdit && (
        <button
          type="button"
          aria-label="Remover"
          onClick={() => removeAsset.mutate({ organizationId, assetId: asset.id }, { onError: (error) => toast.error(error.message) })}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </button>
      )}
    </div>
  );
}

function AddAssetForm({ organizationId, brandKitId, kind, onDone }: { organizationId: string; brandKitId: string | null; kind: AssetKind; onDone: () => void }) {
  const copy = KIND_COPY[kind];
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [url, setUrl] = useState("");
  const [fileKey, setFileKey] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addAsset = useAddPlannerBrandKitAsset();

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    setIsUploading(true);
    try {
      setFileKey(await uploadBrandFile(file));
      if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não deu para enviar o arquivo.");
    } finally {
      setIsUploading(false);
    }
  };

  const save = () =>
    addAsset.mutate(
      { organizationId, brandKitId, kind, title, description: description || null, price: price || null, url: url || null, fileKey },
      { onSuccess: onDone, onError: (error) => toast.error(error.message) },
    );

  return (
    <div className="space-y-2 rounded-xl bg-card p-2.5">
      <Input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder={copy.titlePlaceholder} className="h-8 rounded-full text-xs" />
      <Input value={description} onChange={(event) => setDescription(event.target.value)} placeholder={copy.descriptionPlaceholder} className="h-8 rounded-full text-xs" />
      <div className="flex gap-2">
        {copy.hasPrice && <Input value={price} onChange={(event) => setPrice(event.target.value)} placeholder="Preço (opcional)" className="h-8 w-36 rounded-full text-xs" />}
        <Input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="Link (opcional)" className="h-8 flex-1 rounded-full text-xs" />
      </div>
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          {isUploading ? <OrbitaSpinner className="size-3" /> : <Paperclip className="size-3" />}
          {fileKey ? "Arquivo anexado" : copy.isVisual ? "Anexar imagem" : "Anexar arquivo"}
        </button>
        <div className="flex gap-2">
          <button type="button" onClick={onDone} className="rounded-full bg-panel px-3 py-1 text-xs">Cancelar</button>
          <button type="button" disabled={!title.trim() || addAsset.isPending || isUploading} onClick={save} className="rounded-full bg-foreground px-3 py-1 text-xs font-semibold text-background disabled:opacity-40">
            {addAsset.isPending ? "Salvando…" : "Adicionar"}
          </button>
        </div>
      </div>
      <input ref={fileInputRef} type="file" accept={copy.isVisual ? "image/*" : undefined} className="hidden" onChange={(event) => void pickFile(event.target.files?.[0])} />
    </div>
  );
}

export function BrandKitAssetList({ organizationId, brandKitId, kind, assets, canEdit }: { organizationId: string; brandKitId: string | null; kind: AssetKind; assets: PlannerBrandKitAsset[]; canEdit: boolean }) {
  const [isAdding, setIsAdding] = useState(false);
  return (
    <div className="space-y-2">
      {assets.map((asset) => (
        <AssetRow key={asset.id} organizationId={organizationId} asset={asset} canEdit={canEdit} />
      ))}
      {assets.length === 0 && !isAdding && <p className="text-xs text-muted-foreground">Nada ainda.</p>}
      {canEdit &&
        (isAdding ? (
          <AddAssetForm organizationId={organizationId} brandKitId={brandKitId} kind={kind} onDone={() => setIsAdding(false)} />
        ) : (
          <button type="button" onClick={() => setIsAdding(true)} className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
            <Plus className="size-3" /> {KIND_COPY[kind].addLabel}
          </button>
        ))}
    </div>
  );
}
