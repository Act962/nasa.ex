"use client";

import { useEffect, useState } from "react";
import { X, Save, Lock, Globe2 } from "lucide-react";
import { usePublishWorldTemplate } from "../../../hooks/use-station";
import type { TileLayer, PlacedMapObject } from "../../../types";

type TemplateCategory = "OFFICE" | "SPACE" | "NATURE" | "FANTASY" | "TECH" | "OTHER";

const CATEGORIES: TemplateCategory[] = ["OFFICE", "SPACE", "NATURE", "FANTASY", "TECH", "OTHER"];
const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  OFFICE:  "Escritório",
  SPACE:   "Espaço",
  NATURE:  "Natureza",
  FANTASY: "Fantasia",
  TECH:    "Tecnologia",
  OTHER:   "Outro",
};

interface Props {
  stationId:     string;
  tileLayer:     TileLayer | null;
  placedObjects: PlacedMapObject[];
}

/**
 * Modal dedicado para salvar o estado atual (tileLayer + placedObjects)
 * como um "Ambiente" reutilizável — visível no TilePainter > aba Ambientes.
 */
export function SaveTileTemplateModal({ stationId, tileLayer, placedObjects }: Props) {
  const [open, setOpen]           = useState(false);
  const [name, setName]           = useState("");
  const [desc, setDesc]           = useState("");
  const [category, setCategory]   = useState<TemplateCategory>("OTHER");
  const [isPublic, setIsPublic]   = useState(false);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [saving, setSaving]       = useState(false);
  const [done, setDone]           = useState(false);

  const { mutateAsync: publish } = usePublishWorldTemplate();

  // Aguarda evento disparado pelo botão "Salvar ambiente" no MapEditor
  useEffect(() => {
    const handler = () => {
      setDone(false);
      setName("");
      setDesc("");
      setCategory("OTHER");
      setIsPublic(false);
      setThumbnail(null);
      setOpen(true);
      captureSnapshot();
    };
    window.addEventListener("space-station:save-tile-template-open", handler);
    return () => window.removeEventListener("space-station:save-tile-template-open", handler);
  }, []);

  // Recebe resultado do snapshot via Phaser (game.renderer.snapshot)
  useEffect(() => {
    const onResult = (e: Event) => {
      const { dataUrl } = (e as CustomEvent).detail as { dataUrl: string | null };
      if (dataUrl) setThumbnail(dataUrl);
    };
    window.addEventListener("space-station:snapshot-result", onResult);
    return () => window.removeEventListener("space-station:snapshot-result", onResult);
  }, []);

  function captureSnapshot() {
    // Usa a API nativa do Phaser (game.renderer.snapshot) via CustomEvent.
    // O fallback com canvas.toDataURL() não funcionava porque Phaser usa WebGL
    // sem preserveDrawingBuffer → framebuffer é descartado após cada render.
    window.dispatchEvent(new CustomEvent("space-station:capture-snapshot"));
  }

  async function uploadThumbnail(dataUrl: string): Promise<string | null> {
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const form = new FormData();
      form.append("file", blob, "tile-template.png");
      const res = await fetch("/api/upload-local", { method: "POST", body: form });
      const data = await res.json() as { url?: string };
      return data.url ?? null;
    } catch {
      return null;
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const cellCount = tileLayer ? Object.keys(tileLayer.cells).length : 0;
    if (cellCount === 0 && placedObjects.length === 0) {
      alert("Adicione tiles ou objetos antes de salvar o ambiente.");
      return;
    }
    setSaving(true);
    try {
      let previewUrl: string | null = null;
      if (thumbnail) previewUrl = await uploadThumbnail(thumbnail);

      // mapData só com tileLayer + placedObjects (Opção 3b)
      const mapData = {
        tileLayer,
        placedObjects: placedObjects ?? [],
        scenario: "custom" as const,
      };

      await publish({
        name:        name.trim(),
        description: desc.trim() || undefined,
        category,
        mapData,
        previewUrl,
        isPublic,
        stationId,
      });
      setDone(true);
    } catch (err) {
      console.error("[SaveTileTemplate] error:", err);
      alert("Erro ao salvar ambiente. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const cellCount = tileLayer ? Object.keys(tileLayer.cells).length : 0;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 pointer-events-auto select-auto">
      <div className="relative w-full max-w-md bg-slate-950 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Save className="h-4 w-4 text-emerald-400" />
            <h2 className="text-white font-semibold text-sm">Salvar como Ambiente</h2>
          </div>
          <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        {done ? (
          <div className="p-8 text-center space-y-3">
            <div className="text-4xl">💾</div>
            <p className="text-white font-semibold">Ambiente salvo!</p>
            <p className="text-slate-400 text-sm">
              {isPublic
                ? "Ele aparece em 'Meus Salvos' e também em 'Comunidade' para outros usuários."
                : "Ele aparece em 'Meus Salvos' — somente você pode vê-lo."}
            </p>
            <button
              onClick={() => setOpen(false)}
              className="mt-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm transition-colors"
            >
              Fechar
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumbnail} alt="Preview" className="w-full h-36 object-cover rounded-xl border border-white/10" />
            ) : (
              <div className="w-full h-36 bg-emerald-900/20 rounded-xl border border-white/10 flex items-center justify-center text-3xl">
                🗺️
              </div>
            )}

            <div className="text-[11px] text-slate-400 flex items-center justify-between">
              <span>{cellCount} tiles · {placedObjects.length} objetos</span>
              <span className="text-slate-600">Incluso no ambiente</span>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-400">Nome do ambiente *</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ex: Meu Quarto Gamer"
                required
                maxLength={80}
                className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-400">Descrição (opcional)</label>
              <textarea
                value={desc}
                onChange={e => setDesc(e.target.value)}
                placeholder="Descreva o ambiente..."
                rows={2}
                maxLength={500}
                className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 resize-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-400">Categoria</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as TemplateCategory)}
                className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
              >
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </div>

            {/* Privacidade */}
            <div className="space-y-2">
              <label className="text-xs text-slate-400">Visibilidade</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIsPublic(false)}
                  className={[
                    "flex flex-col items-center gap-1 px-3 py-2.5 rounded-lg border text-[11px] transition-colors",
                    !isPublic
                      ? "bg-indigo-950/40 border-indigo-500 text-indigo-200"
                      : "bg-slate-900 border-white/10 text-slate-400 hover:bg-white/5",
                  ].join(" ")}
                >
                  <Lock className="h-3.5 w-3.5" />
                  <span className="font-medium">Privado</span>
                  <span className="text-[10px] opacity-70">Só você vê</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPublic(true)}
                  className={[
                    "flex flex-col items-center gap-1 px-3 py-2.5 rounded-lg border text-[11px] transition-colors",
                    isPublic
                      ? "bg-emerald-950/40 border-emerald-500 text-emerald-200"
                      : "bg-slate-900 border-white/10 text-slate-400 hover:bg-white/5",
                  ].join(" ")}
                >
                  <Globe2 className="h-3.5 w-3.5" />
                  <span className="font-medium">Público</span>
                  <span className="text-[10px] opacity-70">Comunidade vê</span>
                </button>
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 px-3 py-2 rounded-lg border border-white/10 text-slate-300 hover:text-white hover:bg-white/5 text-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving || !name.trim() || (cellCount === 0 && placedObjects.length === 0)}
                className="flex-1 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium flex items-center justify-center gap-1.5 transition-colors"
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? "Salvando..." : "Salvar ambiente"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
