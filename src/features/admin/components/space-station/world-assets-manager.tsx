"use client";

import { useState } from "react";
import { Plus, Trash2, Edit2, Check, X, Eye, EyeOff } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { WorldGameAsset, WorldAssetType } from "@/features/space-station/types";

const ASSET_TYPE_META: Record<WorldAssetType, { label: string; emoji: string; description: string }> = {
  game_view:  { label: "Visão do Jogo",    emoji: "🗺️", description: "Modos de câmera: aérea, lateral, etc." },
  furniture:  { label: "Mobiliário Geral", emoji: "🪑", description: "Estantes, sofás, decoração" },
  chair:      { label: "Cadeiras",         emoji: "🪑", description: "Modelos de cadeiras de escritório" },
  desk:       { label: "Mesas",            emoji: "🖥️", description: "Mesas de trabalho e reunião" },
  computer:   { label: "Computadores",     emoji: "💻", description: "Monitores, notebooks, setups" },
};

interface AssetFormData {
  type: WorldAssetType;
  name: string;
  imageUrl: string;
  previewUrl: string;
}

const EMPTY_FORM: AssetFormData = {
  type: "furniture",
  name: "",
  imageUrl: "",
  previewUrl: "",
};

interface Props {
  initialAssets: WorldGameAsset[];
}

export function WorldAssetsManager({ initialAssets }: Props) {
  const [assets, setAssets] = useState<WorldGameAsset[]>(initialAssets);
  const [activeTab, setActiveTab] = useState<WorldAssetType>("game_view");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<AssetFormData>({ ...EMPTY_FORM, type: "game_view" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = assets.filter((a) => a.type === activeTab);

  async function handleSave() {
    if (!form.name.trim() || !form.imageUrl.trim()) {
      setError("Nome e URL da imagem são obrigatórios");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const body = {
        type: form.type,
        name: form.name.trim(),
        imageUrl: form.imageUrl.trim(),
        previewUrl: form.previewUrl.trim() || undefined,
      };

      if (editingId) {
        const res = await fetch(`/api/space-station/world-assets/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(await res.text());
        const { asset } = await res.json() as { asset: WorldGameAsset };
        setAssets((prev) => prev.map((a) => a.id === editingId ? asset : a));
      } else {
        const res = await fetch("/api/space-station/world-assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(await res.text());
        const { asset } = await res.json() as { asset: WorldGameAsset };
        setAssets((prev) => [...prev, asset]);
      }
      setShowForm(false);
      setEditingId(null);
      setForm({ ...EMPTY_FORM, type: activeTab });
    } catch (err) {
      setError((err as Error).message || "Erro ao salvar asset");
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(asset: WorldGameAsset) {
    try {
      const res = await fetch(`/api/space-station/world-assets/${asset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !asset.isActive }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { asset: updated } = await res.json() as { asset: WorldGameAsset };
      setAssets((prev) => prev.map((a) => a.id === asset.id ? updated : a));
    } catch (err) {
      setError((err as Error).message || "Erro ao atualizar asset");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Tem certeza que deseja excluir este asset?")) return;
    try {
      const res = await fetch(`/api/space-station/world-assets/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      setAssets((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      setError((err as Error).message || "Erro ao excluir asset");
    }
  }

  function startEdit(asset: WorldGameAsset) {
    setEditingId(asset.id);
    setForm({
      type: asset.type as WorldAssetType,
      name: asset.name,
      imageUrl: asset.imageUrl,
      previewUrl: asset.previewUrl ?? "",
    });
    setShowForm(true);
    setActiveTab(asset.type as WorldAssetType);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...EMPTY_FORM, type: activeTab });
    setError(null);
  }

  return (
    <div className="space-y-6">
      {/* Tabs por tipo */}
      <div className="flex gap-1 flex-wrap bg-panel rounded-full p-1 w-fit max-w-full">
        {(Object.keys(ASSET_TYPE_META) as WorldAssetType[]).map((type) => {
          const meta = ASSET_TYPE_META[type];
          const count = assets.filter((a) => a.type === type).length;
          return (
            <button
              key={type}
              onClick={() => {
                setActiveTab(type);
                if (!showForm) setForm((f) => ({ ...f, type }));
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-all ${
                activeTab === type
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>{meta.emoji}</span>
              <span>{meta.label}</span>
              {count > 0 && (
                <span className="text-xs bg-knob/60 rounded-full px-1.5 py-0.5">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Descrição da aba ativa */}
      <p className="text-sm text-muted-foreground">{ASSET_TYPE_META[activeTab].description}</p>

      {/* Botão adicionar */}
      {!showForm && (
        <Button
          onClick={() => { setForm({ ...EMPTY_FORM, type: activeTab }); setShowForm(true); }}
          className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
        >
          <Plus className="h-4 w-4" />
          Adicionar {ASSET_TYPE_META[activeTab].label}
        </Button>
      )}

      {/* Formulário */}
      {showForm && (
        <div className="rounded-xl border border-info/30 bg-info/5 p-5 space-y-4">
          <p className="text-sm font-semibold text-foreground">
            {editingId ? "Editar Asset" : `Novo ${ASSET_TYPE_META[activeTab].label}`}
          </p>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Tipo</label>
              <select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as WorldAssetType }))}
                className="w-full rounded-lg bg-card border border-line text-foreground text-sm px-3 py-2 focus:outline-none focus:border-info"
              >
                {(Object.keys(ASSET_TYPE_META) as WorldAssetType[]).map((t) => (
                  <option key={t} value={t}>{ASSET_TYPE_META[t].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Nome</label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Mesa Gamer Pro"
                className="bg-card border-line text-foreground"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">URL da Imagem (sprite/ícone)</label>
              <Input
                value={form.imageUrl}
                onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
                placeholder="https://..."
                className="bg-card border-line text-foreground"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">URL do Preview (opcional)</label>
              <Input
                value={form.previewUrl}
                onChange={(e) => setForm((f) => ({ ...f, previewUrl: e.target.value }))}
                placeholder="https://... (imagem de preview)"
                className="bg-card border-line text-foreground"
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* Preview da imagem */}
          {(form.previewUrl || form.imageUrl) && (
            <div className="flex items-center gap-3">
              <p className="text-xs text-muted-foreground">Preview:</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={form.previewUrl || form.imageUrl}
                alt="preview"
                className="w-16 h-16 rounded-lg object-cover border border-line"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="ghost" onClick={cancelForm} className="text-muted-foreground hover:text-foreground gap-1">
              <X className="h-3.5 w-3.5" /> Cancelar
            </Button>
            <Button onClick={handleSave} disabled={loading} className="gap-1">
              {loading ? <OrbitaSpinner className="h-3.5 w-3.5 " /> : <Check className="h-3.5 w-3.5" />}
              {editingId ? "Salvar alterações" : "Adicionar asset"}
            </Button>
          </div>
        </div>
      )}

      {/* Lista de assets */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <span className="text-4xl block mb-3">{ASSET_TYPE_META[activeTab].emoji}</span>
          <p className="text-sm">Nenhum asset de {ASSET_TYPE_META[activeTab].label.toLowerCase()} cadastrado</p>
          <p className="text-xs mt-1">Clique em "Adicionar" para começar</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((asset) => (
            <div
              key={asset.id}
              className={`rounded-xl border p-4 space-y-3 transition-all ${
                asset.isActive ? "border-line bg-card/50" : "border-border bg-background/50 opacity-60"
              }`}
            >
              {/* Preview */}
              <div className="w-full h-28 rounded-lg bg-muted flex items-center justify-center overflow-hidden border border-line">
                {(asset.previewUrl ?? asset.imageUrl) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={asset.previewUrl ?? asset.imageUrl}
                    alt={asset.name}
                    className="w-full h-full object-contain p-2"
                    onError={(e) => {
                      const el = e.target as HTMLImageElement;
                      el.style.display = "none";
                      el.nextElementSibling?.classList.remove("hidden");
                    }}
                  />
                ) : null}
                <span className="text-2xl hidden">{ASSET_TYPE_META[activeTab].emoji}</span>
              </div>

              <div>
                <p className="text-sm font-medium text-foreground truncate">{asset.name}</p>
                <p className="text-xs text-muted-foreground truncate">{asset.imageUrl}</p>
              </div>

              <div className="flex items-center justify-between">
                <span className={`text-xs px-2 py-0.5 rounded-full ${asset.isActive ? "bg-success/10 text-success" : "bg-knob text-muted-foreground"}`}>
                  {asset.isActive ? "Ativo" : "Inativo"}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleToggle(asset)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-knob transition-all"
                    title={asset.isActive ? "Desativar" : "Ativar"}
                  >
                    {asset.isActive ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    onClick={() => startEdit(asset)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-knob transition-all"
                    title="Editar"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(asset.id)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                    title="Excluir"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
