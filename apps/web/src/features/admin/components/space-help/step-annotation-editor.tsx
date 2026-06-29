"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { toast } from "sonner";
import { Loader2, RotateCcw, Save, X } from "lucide-react";
import { StepScreenshot } from "@/features/space-help/components/step-screenshot";
import type { StepAnnotation, StepAnnotationMarker } from "@/features/space-help/types";

type Tool = "rocket-right" | "rocket-left" | null;

interface Props {
  open: boolean;
  onClose: () => void;
  step: {
    id: string;
    featureId: string;
    title: string;
    description: string;
    screenshotUrl: string;
    order: number;
    annotations: StepAnnotation[] | null;
  };
}

export function StepAnnotationEditor({ open, onClose, step }: Props) {
  const qc = useQueryClient();
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<Tool>("rocket-right");
  const [items, setItems] = useState<StepAnnotation[]>(step.annotations ?? []);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);

  useEffect(() => {
    if (open) setItems(step.annotations ?? []);
  }, [open, step.annotations]);

  const upsertMut = useMutation({
    ...orpc.spaceHelp.upsertStep.mutationOptions(),
    onSuccess: () => {
      toast.success("Anotações salvas");
      qc.invalidateQueries({ queryKey: orpc.spaceHelp.adminGetFeature.key() });
      qc.invalidateQueries({ queryKey: orpc.spaceHelp.getFeature.key() });
      onClose();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const relCoords = (clientX: number, clientY: number) => {
    const el = imgRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    return { x: clamp(x), y: clamp(y) };
  };

  const handleImgClick = (e: React.MouseEvent) => {
    if (!tool) return;
    if (draggingIdx !== null) return;
    const c = relCoords(e.clientX, e.clientY);
    if (!c) return;
    setItems((prev) => [
      ...prev,
      { x: c.x, y: c.y, angle: 0, label: "Clique para editar", marker: tool },
    ]);
  };

  const handleDragStart = (idx: number) => (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setDraggingIdx(idx);
  };

  useEffect(() => {
    if (draggingIdx === null) return;
    const onMove = (e: MouseEvent) => {
      const c = relCoords(e.clientX, e.clientY);
      if (!c) return;
      setItems((prev) =>
        prev.map((a, i) => (i === draggingIdx ? { ...a, x: c.x, y: c.y } : a)),
      );
    };
    const onUp = () => setDraggingIdx(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [draggingIdx]);

  const updateLabel = (idx: number, label: string) => {
    setItems((prev) => prev.map((a, i) => (i === idx ? { ...a, label } : a)));
  };

  const toggleDir = (idx: number) => {
    setItems((prev) =>
      prev.map((a, i) => {
        if (i !== idx) return a;
        const next: StepAnnotationMarker =
          a.marker === "rocket-left" ? "rocket-right" : "rocket-left";
        return { ...a, marker: next };
      }),
    );
  };

  const removeAt = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    upsertMut.mutate({
      id: step.id,
      featureId: step.featureId,
      title: step.title,
      description: step.description,
      screenshotUrl: step.screenshotUrl,
      order: step.order,
      annotations: items.map((a) => ({
        x: a.x,
        y: a.y,
        angle: a.angle ?? 0,
        label: a.label ?? "",
        marker: a.marker ?? "rocket-right",
      })),
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div>
            <h3 className="text-base font-semibold text-white">Anotar setas — {step.title}</h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Clique na imagem para soltar um foguete. Arraste para reposicionar.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-zinc-800 flex items-center gap-2 flex-wrap">
          <ToolButton
            active={tool === "rocket-right"}
            onClick={() => setTool(tool === "rocket-right" ? null : "rocket-right")}
            label="🚀 Foguete →"
          />
          <ToolButton
            active={tool === "rocket-left"}
            onClick={() => setTool(tool === "rocket-left" ? null : "rocket-left")}
            label="← Foguete 🚀"
          />
          <div className="flex-1" />
          <span className="text-xs text-zinc-500">{items.length} anotação(ões)</span>
          {items.length > 0 && (
            <button
              onClick={() => {
                if (confirm("Remover todas as anotações?")) setItems([]);
              }}
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-red-400 px-3 py-1.5 border border-zinc-800 hover:border-red-500/40 rounded-lg transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Limpar tudo
            </button>
          )}
        </div>

        <div className="flex-1 overflow-auto p-5 bg-zinc-950">
          <div
            ref={containerRef}
            className="relative max-w-4xl mx-auto"
            style={{ cursor: tool ? "crosshair" : "default" }}
          >
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imgRef}
                src={step.screenshotUrl}
                alt={step.title}
                className="block w-full h-auto rounded-lg border border-zinc-800 select-none"
                onClick={handleImgClick}
                draggable={false}
              />
              <StepScreenshot
                src={null}
                annotations={items}
                className="!absolute inset-0 !border-0 !bg-transparent !shadow-none pointer-events-none"
              />
              {items.map((a, i) => (
                <div
                  key={i}
                  className="absolute"
                  style={{
                    left: `${a.x * 100}%`,
                    top: `${a.y * 100}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  <div
                    onMouseDown={handleDragStart(i)}
                    className="w-6 h-6 rounded-full border-2 border-white shadow-lg cursor-move bg-red-600/70 hover:bg-red-500"
                    title="Arrastar"
                  />
                  <div
                    className="absolute left-1/2 -translate-x-1/2 mt-2 flex items-center gap-1 bg-zinc-900/95 border border-zinc-700 rounded-lg shadow-xl p-1 whitespace-nowrap"
                    style={{ top: "100%" }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => toggleDir(i)}
                      className="px-1.5 py-1 text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 rounded"
                      title="Inverter direção"
                    >
                      {a.marker === "rocket-left" ? "←" : "→"}
                    </button>
                    <input
                      value={a.label}
                      onChange={(e) => updateLabel(i, e.target.value)}
                      placeholder="Label"
                      className="w-32 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-red-500/60"
                    />
                    <button
                      type="button"
                      onClick={() => removeAt(i)}
                      className="p-1 text-zinc-400 hover:text-red-400 hover:bg-zinc-800 rounded"
                      title="Remover"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-zinc-800 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={upsertMut.isPending}
            className="px-3.5 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={upsertMut.isPending}
            className="px-3.5 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60 flex items-center gap-2"
          >
            {upsertMut.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

function ToolButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors " +
        (active
          ? "bg-red-600 text-white shadow-md"
          : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700")
      }
    >
      {label}
    </button>
  );
}

function clamp(n: number) {
  return Math.max(0, Math.min(1, n));
}
