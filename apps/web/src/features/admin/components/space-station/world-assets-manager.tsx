"use client";

import { useState } from "react";
import { Plus, Trash2, Edit2, Check, X, Loader2, Eye, EyeOff } from "lucide-react";
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
      <div className="flex gap-2 flex-wrap">
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
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm transition-all ${
                activeTab === type
                  ? "border-violet-500 bg-violet-500/10 text-white"
                  : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
              }`}
            >
              <span>{meta.emoji}</span>
              <span>{meta.label}</span>
              {count > 0 && (
                <span className="text-xs bg-zinc-700 text-zinc-300 rounded-full px-1.5 py-0.5">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Descrição da aba ativa */}
      <p className="text-sm text-zinc-400">{ASSET_TYPE_META[activeTab].description}</p>

      {/* Botão adicionar */}
      {!showForm && (
        <Button
          onClick={() => { setForm({ ...EMPTY_FORM, type: activeTab }); setShowForm(true); }}
          className="bg-violet-600 hover:bg-violet-700 text-white gap-2"
        >
          <Plus className="h-4 w-4" />
          Adicionar {ASSET_TYPE_META[activeTab].label}
        </Button>
      )}

      {/* Formulário */}
      {showForm && (
        <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-5 space-y-4">
          <p className="text-sm font-semibold text-white">
            {editingId ? "Editar Asset" : `Novo ${ASSET_TYPE_META[activeTab].label}`}
          </p>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Tipo</label>
              <select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as WorldAssetType }))}
                className="w-full rounded-lg bg-zinc-900 border border-zinc-700 text-white text-sm px-3 py-2 focus:outline-none focus:border-violet-500"
              >
                {(Object.keys(ASSET_TYPE_META) as WorldAssetType[]).map((t) => (
                  <option key={t} value={t}>{ASSET_TYPE_META[t].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Nome</label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Mesa Gamer Pro"
                className="bg-zinc-900 border-zinc-700 text-white"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">URL da Imagem (sprite/ícone)</label>
              <Input
                value={form.imageUrl}
                onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
                placeholder="https://..."
                className="bg-zinc-900 border-zinc-700 text-white"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">URL do Preview (opcional)</label>
              <Input
                value={form.previewUrl}
                onChange={(e) => setForm((f) => ({ ...f, previewUrl: e.target.value }))}
                placeholder="https://... (imagem de preview)"
                className="bg-zinc-900 border-zinc-700 text-white"
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* Preview da imagem */}
          {(form.previewUrl || form.imageUrl) && (
            <div className="flex items-center gap-3">
              <p className="text-xs text-zinc-500">Preview:</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={form.previewUrl || form.imageUrl}
                alt="preview"
                className="w-16 h-16 rounded-lg object-cover border border-zinc-700"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="ghost" onClick={cancelForm} className="text-zinc-400 hover:text-white gap-1">
              <X className="h-3.5 w-3.5" /> Cancelar
            </Button>
            <Button onClick={handleSave} disabled={loading} className="bg-violet-600 hover:bg-violet-700 gap-1">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              {editingId ? "Salvar alterações" : "Adicionar asset"}
            </Button>
          </div>
        </div>
      )}

      {/* Lista de assets */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-zinc-500">
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
                asset.isActive ? "border-zinc-700 bg-zinc-900/50" : "border-zinc-800 bg-zinc-950/50 opacity-60"
              }`}
            >
              {/* Preview */}
              <div className="w-full h-28 rounded-lg bg-zinc-800 flex items-center justify-center overflow-hidden border border-zinc-700">
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
                <p className="text-sm font-medium text-white truncate">{asset.name}</p>
                <p className="text-xs text-zinc-500 truncate">{asset.imageUrl}</p>
              </div>

              <div className="flex items-center justify-between">
                <span className={`text-xs px-2 py-0.5 rounded-full ${asset.isActive ? "bg-green-500/10 text-green-400" : "bg-zinc-700 text-zinc-500"}`}>
                  {asset.isActive ? "Ativo" : "Inativo"}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleToggle(asset)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all"
                    title={asset.isActive ? "Desativar" : "Ativar"}
                  >
                    {asset.isActive ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    onClick={() => startEdit(asset)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all"
                    title="Editar"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(asset.id)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
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
