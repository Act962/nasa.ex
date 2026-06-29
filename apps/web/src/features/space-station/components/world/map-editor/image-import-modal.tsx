"use client";

/**
 * ImageImportModal — Modal de configuração de imagem personalizada.
 *
 * Permite ao usuário:
 *   - Pré-visualizar a imagem com fundo xadrez (para ver transparência)
 *   - Ativar/desativar remoção de fundo (BFS flood-fill, igual aos sprites)
 *   - Ajustar tolerância da remoção de fundo
 *   - Definir o tamanho inicial (escala) do objeto no mapa
 *   - Confirmar para fazer upload e inserir no mapa
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { X, Loader2, Scissors, Maximize2 } from "lucide-react";
import { removeBackground } from "../../../utils/remove-background";
import type { LibraryItem } from "./categories";

interface Props {
  file:      File | null;
  onClose:   () => void;
  /** Chamado após upload bem-sucedido; item já tem defaultScale definida */
  onConfirm: (item: LibraryItem) => void;
}

/** Dimensão máxima do canvas de preview (preview menor = BFS mais rápido) */
const MAX_PREVIEW_DIM = 560;

/** Cria um canvas redimensionado para preview (preserva aspect ratio) */
function buildPreviewCanvas(bm: ImageBitmap): HTMLCanvasElement {
  const ratio = Math.min(1, MAX_PREVIEW_DIM / Math.max(bm.width, bm.height));
  const w = Math.max(1, Math.round(bm.width  * ratio));
  const h = Math.max(1, Math.round(bm.height * ratio));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bm, 0, 0, w, h);
  return c;
}

/** CSS para background xadrez — deixa transparência visível */
const CHECKERBOARD: React.CSSProperties = {
  backgroundImage: [
    "linear-gradient(45deg,#334155 25%,transparent 25%)",
    "linear-gradient(-45deg,#334155 25%,transparent 25%)",
    "linear-gradient(45deg,transparent 75%,#334155 75%)",
    "linear-gradient(-45deg,transparent 75%,#334155 75%)",
  ].join(","),
  backgroundSize: "14px 14px",
  backgroundPosition: "0 0, 0 7px, 7px -7px, -7px 0",
  backgroundColor: "#1e293b",
};

export function ImageImportModal({ file, onClose, onConfirm }: Props) {
  const [removeBg,   setRemoveBg]   = useState(true);
  const [tolerance,  setTolerance]  = useState(32);
  const [scale,      setScale]      = useState(1);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [uploading,  setUploading]  = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const bitmapRef   = useRef<ImageBitmap | null>(null);
  const prevUrlRef  = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Renderiza o preview no canvas, aplica remoção de fundo se ligada */
  const renderPreview = useCallback((bm: ImageBitmap, doRemove: boolean, tol: number) => {
    setProcessing(true);
    // yield ao browser antes do BFS (pesado) para o spinner aparecer
    setTimeout(() => {
      try {
        const canvas = buildPreviewCanvas(bm);
        if (doRemove) removeBackground(canvas, tol);
        canvas.toBlob(blob => {
          if (!blob) { setProcessing(false); return; }
          const url = URL.createObjectURL(blob);
          if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
          prevUrlRef.current = url;
          setPreviewUrl(url);
          setProcessing(false);
        }, "image/png");
      } catch {
        setProcessing(false);
      }
    }, 0);
  }, []);

  /* Carrega o bitmap uma única vez ao trocar de arquivo */
  useEffect(() => {
    if (!file) return;
    setProcessing(true);
    setPreviewUrl(null);
    setError(null);

    createImageBitmap(file)
      .then(bm => {
        bitmapRef.current = bm;
        renderPreview(bm, removeBg, tolerance);
      })
      .catch(() => {
        setError("Não foi possível carregar a imagem.");
        setProcessing(false);
      });

    return () => {
      if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  /* Re-renderiza com debounce ao trocar removeBg ou tolerance */
  useEffect(() => {
    const bm = bitmapRef.current;
    if (!bm) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => renderPreview(bm, removeBg, tolerance), 180);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [removeBg, tolerance]);

  async function handleConfirm() {
    if (!file || !bitmapRef.current) return;
    setUploading(true);
    setError(null);
    try {
      const bm = bitmapRef.current;
      // Processa na resolução COMPLETA para o upload (não o preview reduzido)
      const canvas = document.createElement("canvas");
      canvas.width  = bm.width;
      canvas.height = bm.height;
      const ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(bm, 0, 0);
      if (removeBg) removeBackground(canvas, tolerance);

      const blob = await new Promise<Blob>((res, rej) =>
        canvas.toBlob(b => (b ? res(b) : rej(new Error("toBlob falhou"))), "image/png"),
      );

      const fd = new FormData();
      const baseName = file.name.replace(/\.[^.]+$/, "");
      fd.append("file", blob, `${baseName}.png`);

      const res = await fetch("/api/upload-local", { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json() as { url: string };

      const item: LibraryItem = {
        id:           `upload-${Date.now()}`,
        name:         baseName,
        url:          data.url,
        tags:         ["upload", "custom"],
        defaultScale: scale,
      };
      onConfirm(item);
    } catch (e) {
      console.error("[ImageImportModal]", e);
      setError("Falha ao enviar. Tente novamente.");
    } finally {
      setUploading(false);
    }
  }

  if (!file) return null;

  /* SVGs não têm pixels raster — remoção de fundo não se aplica */
  const isRaster = !file.type.includes("svg");

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-[400px] flex flex-col overflow-hidden">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-white">Configurar imagem</h2>
            <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-[280px]">{file.name}</p>
          </div>
          <button
            onClick={onClose}
            className="ml-3 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Preview xadrez ── */}
        <div className="px-5 pt-4 pb-2 flex justify-center">
          <div
            className="relative rounded-xl overflow-hidden flex items-center justify-center"
            style={{ width: 220, height: 220, ...CHECKERBOARD }}
          >
            {previewUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="preview"
                className="max-w-full max-h-full object-contain"
              />
            )}
            {!previewUrl && !processing && (
              <div className="text-slate-500 text-xs">Carregando…</div>
            )}
            {processing && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900/70 rounded-xl">
                <Loader2 className="h-6 w-6 text-indigo-400 animate-spin" />
              </div>
            )}
          </div>
        </div>

        <div className="px-5 pt-2 pb-4 space-y-3">

          {/* ── Remover fundo (apenas raster) ── */}
          {isRaster && (
            <div className="bg-slate-800/60 rounded-xl p-3.5 space-y-3">
              {/* Toggle row */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={removeBg}
                  onClick={() => setRemoveBg(v => !v)}
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                    removeBg ? "bg-indigo-600" : "bg-slate-600"
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                      removeBg ? "translate-x-[19px]" : "translate-x-[2px]"
                    }`}
                  />
                </button>
                <div>
                  <div className="flex items-center gap-1.5">
                    <Scissors className="h-3.5 w-3.5 text-indigo-400" />
                    <span className="text-sm font-medium text-white">Remover fundo</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">Remove o fundo sólido automaticamente</p>
                </div>
              </div>

              {/* Tolerância (visível só quando ligado) */}
              {removeBg && (
                <div>
                  <div className="flex items-center justify-between text-[11px] mb-1.5">
                    <span className="text-slate-400">Tolerância</span>
                    <span className="text-slate-200 font-mono tabular-nums">{tolerance}</span>
                  </div>
                  <input
                    type="range" min={5} max={80} step={1}
                    value={tolerance}
                    onChange={e => setTolerance(Number(e.target.value))}
                    className="w-full accent-indigo-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-600 mt-0.5">
                    <span>Preciso</span>
                    <span>Agressivo</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Tamanho inicial ── */}
          <div className="bg-slate-800/60 rounded-xl p-3.5">
            <div className="flex items-center gap-1.5 mb-2.5">
              <Maximize2 className="h-3.5 w-3.5 text-indigo-400" />
              <span className="text-sm font-medium text-white">Tamanho inicial</span>
              <span className="ml-auto text-slate-200 font-mono tabular-nums text-xs">
                {Math.round(scale * 100)}%
              </span>
            </div>
            <input
              type="range" min={0.1} max={4} step={0.05}
              value={scale}
              onChange={e => setScale(parseFloat(e.target.value))}
              className="w-full accent-indigo-500"
            />
            <div className="flex justify-between text-[10px] text-slate-600 mt-0.5">
              <span>10%</span>
              <span>100%</span>
              <span>400%</span>
            </div>
          </div>

          {error && (
            <p className="text-xs text-rose-400 px-1">{error}</p>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-5 pb-5 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm text-slate-300 hover:text-white border border-white/10 hover:bg-white/5 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={uploading || processing || !previewUrl}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {uploading
              ? <><Loader2 className="h-4 w-4 animate-spin" />Enviando…</>
              : "Adicionar ao mapa"
            }
          </button>
        </div>
      </div>
    </div>
  );
}
