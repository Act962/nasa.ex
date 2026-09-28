"use client";

import { useEffect, useRef } from "react";
import { XIcon, DownloadIcon, ZoomInIcon, ZoomOutIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface ImagePreviewDialogProps {
  open: boolean;
  onClose: () => void;
  src: string;
  fileName?: string;
  onDownload?: () => void;
}

export function ImagePreviewDialog({
  open,
  onClose,
  src,
  fileName,
  onDownload,
}: ImagePreviewDialogProps) {
  const [scale, setScale] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const didDrag = useRef(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Reset do zoom/pan ao abrir ou trocar de imagem. Feito durante o render
  // (padrão "ajustar estado quando a prop muda") em vez de num effect, que
  // provocaria um segundo render a cada abertura.
  const [lastShown, setLastShown] = useState({ open, src });
  if (lastShown.open !== open || lastShown.src !== src) {
    setLastShown({ open, src });
    if (open) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
      // Basta zerar `dragging`: `handleMouseMove` exige esse flag, e
      // `handleMouseDown` sempre reescreve `dragStart` antes de reativá-lo.
      setDragging(false);
    }
  }

  // Abaixo de 100% o arrasto é recusado, então uma posição deslocada herdada
  // do zoom anterior ficaria presa fora da tela sem como voltar.
  if (scale <= 1 && (position.x !== 0 || position.y !== 0)) {
    setPosition({ x: 0, y: 0 });
  }

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Trava o scroll do body enquanto aberto, restaurando o valor anterior —
  // várias instâncias deste dialog podem coexistir (uma por imagem), e
  // zerar para "" faria uma instância fechada destravar a que está aberta.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  // Encerra o arrasto mesmo quando o botão é solto fora do overlay (ou fora
  // da janela) — sem isso `dragging` fica preso e a imagem passa a seguir o
  // cursor sem nenhum botão pressionado.
  useEffect(() => {
    if (!dragging) return;
    const endDrag = () => {
      setDragging(false);
      dragStart.current = null;
    };
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    return () => {
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
    };
  }, [dragging]);

  // React registra `wheel` como passivo, então `preventDefault` num onWheel
  // não faz nada e o zoom acaba rolando o container que hospeda o dialog.
  useEffect(() => {
    if (!open) return;
    const overlay = overlayRef.current;
    if (!overlay) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      setScale((current) =>
        event.deltaY < 0
          ? Math.min(current + 0.1, 4)
          : Math.max(current - 0.1, 0.25),
      );
    };
    overlay.addEventListener("wheel", onWheel, { passive: false });
    return () => overlay.removeEventListener("wheel", onWheel);
  }, [open]);

  const zoomIn = () => setScale((s) => Math.min(s + 0.25, 4));
  const zoomOut = () => setScale((s) => Math.max(s - 0.25, 0.25));

  const handleMouseDown = (e: React.MouseEvent) => {
    didDrag.current = false;
    if (scale <= 1) return;
    setDragging(true);
    dragStart.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging || !dragStart.current) return;
    didDrag.current = true;
    setPosition({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    });
  };

  const handleMouseUp = () => {
    setDragging(false);
    dragStart.current = null;
  };

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-5000 flex items-center justify-center"
      style={{
        backdropFilter: "blur(8px)",
        backgroundColor: "rgba(0,0,0,0.85)",
      }}
      onClick={() => {
        // Um arrasto que termina sobre o header despacha o clique aqui (o
        // ancestral comum), fechando o lightbox no meio do pan.
        if (didDrag.current) {
          didDrag.current = false;
          return;
        }
        onClose();
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Header bar */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 z-10"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-white/80 text-sm font-medium truncate max-w-xs">
          {fileName ?? "Pré-visualização"}
        </span>
        <div className="flex items-center gap-1">
          {/* Zoom out */}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8 text-white/70 hover:text-white hover:bg-white/10"
            onClick={zoomOut}
            title="Diminuir zoom"
          >
            <ZoomOutIcon className="size-4" />
          </Button>

          {/* Zoom level indicator */}
          <span className="text-white/60 text-xs w-12 text-center select-none">
            {Math.round(scale * 100)}%
          </span>

          {/* Zoom in */}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8 text-white/70 hover:text-white hover:bg-white/10"
            onClick={zoomIn}
            title="Aumentar zoom"
          >
            <ZoomInIcon className="size-4" />
          </Button>

          {/* Download */}
          {onDownload && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-8 text-white/70 hover:text-white hover:bg-white/10 ml-1"
              onClick={onDownload}
              title="Baixar arquivo"
            >
              <DownloadIcon className="size-4" />
            </Button>
          )}

          {/* Close */}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8 text-white/70 hover:text-white hover:bg-white/10 ml-1"
            onClick={onClose}
            title="Fechar"
          >
            <XIcon className="size-4" />
          </Button>
        </div>
      </div>

      {/* Image container */}
      <div
        className="relative flex items-center justify-center w-full h-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={src}
          alt={fileName ?? "preview"}
          draggable={false}
          onMouseDown={handleMouseDown}
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transition: dragging ? "none" : "transform 0.15s ease",
            maxWidth: "90vw",
            maxHeight: "85vh",
            objectFit: "contain",
            borderRadius: "6px",
            boxShadow: "0 25px 80px rgba(0,0,0,0.6)",
            userSelect: "none",
            cursor: scale > 1 ? (dragging ? "grabbing" : "grab") : "default",
          }}
        />
      </div>

      {/* Footer hint */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/30 text-xs select-none pointer-events-none">
        Scroll para zoom{scale > 1 ? " · Arraste para mover" : ""} · Clique fora
        para fechar
      </div>
    </div>
  );
}
