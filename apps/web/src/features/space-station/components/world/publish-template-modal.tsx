"use client";

import { useEffect, useRef, useState } from "react";
import { X, Share2 } from "lucide-react";
import { usePublishWorldTemplate } from "../../hooks/use-station";
import type { WorldMapData } from "../../types";

interface Props {
  stationId:   string;
  worldConfig: { mapData?: unknown };
}

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

export function PublishTemplateModal({ stationId, worldConfig }: Props) {
  const [open, setOpen]           = useState(false);
  const [name, setName]           = useState("");
  const [desc, setDesc]           = useState("");
  const [category, setCategory]   = useState<TemplateCategory>("OTHER");
  const [isPublic, setIsPublic]   = useState(true);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [saving, setSaving]       = useState(false);
  const [done, setDone]           = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { mutateAsync: publish } = usePublishWorldTemplate();

  // Listen for the open event dispatched by MapEditor's "Publicar Template" button
  useEffect(() => {
    const handler = () => {
      setDone(false);
      setThumbnail(null);
      setOpen(true);
      // Capture Phaser canvas snapshot asynchronously
      captureSnapshot();
    };
    window.addEventListener("space-station:publish-template-open", handler);
    return () => window.removeEventListener("space-station:publish-template-open", handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      form.append("file", blob, "template-preview.png");
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
    setSaving(true);
    try {
      let previewUrl: string | null = null;
      if (thumbnail) previewUrl = await uploadThumbnail(thumbnail);

      await publish({
        name:        name.trim(),
        description: desc.trim() || undefined,
        category,
        mapData:     worldConfig.mapData as WorldMapData,
        previewUrl,
        isPublic,
        stationId,
      });
      setDone(true);
    } catch {
      alert("Erro ao publicar template. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md bg-slate-950 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Share2 className="h-4 w-4 text-indigo-400" />
            <h2 className="text-white font-semibold text-sm">Publicar Template</h2>
          </div>
          <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        {done ? (
          <div className="p-8 text-center space-y-3">
            <div className="text-4xl">🎉</div>
            <p className="text-white font-semibold">Template publicado!</p>
            <p className="text-slate-400 text-sm">Outros usuários já podem encontrá-lo na galeria da Comunidade.</p>
            <button
              onClick={() => setOpen(false)}
              className="mt-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm transition-colors"
            >
              Fechar
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Thumbnail preview */}
            {thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumbnail} alt="Preview" className="w-full h-36 object-cover rounded-xl border border-white/10" />
            ) : (
              <div className="w-full h-36 bg-indigo-900/20 rounded-xl border border-white/10 flex items-center justify-center text-3xl">
                🗺️
              </div>
            )}
            <canvas ref={canvasRef} className="hidden" />

            <div className="space-y-1">
              <label className="text-xs text-slate-400">Nome do template *</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ex: Escritório Futurista"
                required
                maxLength={80}
                className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-400">Descrição (opcional)</label>
              <textarea
                value={desc}
                onChange={e => setDesc(e.target.value)}
                placeholder="Descreva seu mundo..."
                rows={2}
                maxLength={500}
                className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-slate-400">Categoria</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value as TemplateCategory)}
                  className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                >
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-400">Visibilidade</label>
                <label className="flex items-center gap-2 mt-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={e => setIsPublic(e.target.checked)}
                    className="accent-indigo-500"
                  />
                  <span className="text-sm text-slate-300">Público</span>
                </label>
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
                disabled={saving || !name.trim()}
                className="flex-1 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium flex items-center justify-center gap-1.5 transition-colors"
              >
                <Share2 className="h-3.5 w-3.5" />
                {saving ? "Publicando..." : "Publicar"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
