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
  const positionRef = useRef(position);
  positionRef.current = position;

  // Reset state when opening a new image
  useEffect(() => {
    if (open) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  }, [open, src]);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const zoomIn = () => setScale((s) => Math.min(s + 0.25, 4));
  const zoomOut = () => setScale((s) => Math.max(s - 0.25, 0.25));

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setScale((s) => Math.min(s + 0.1, 4));
    } else {
      setScale((s) => Math.max(s - 0.1, 0.25));
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    setDragging(true);
    dragStart.current = {
      x: e.clientX - positionRef.current.x,
      y: e.clientY - positionRef.current.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging || !dragStart.current) return;
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
      className="fixed inset-0 z-5000 flex items-center justify-center"
      style={{
        backdropFilter: "blur(8px)",
        backgroundColor: "rgba(0,0,0,0.85)",
      }}
      onClick={onClose}
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
        onWheel={handleWheel}
        style={{}}
      >
        <img
          src={src}
          alt={fileName ?? "preview"}
          draggable={false}
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transition: dragging ? "none" : "transform 0.15s ease",
            maxWidth: "90vw",
            maxHeight: "85vh",
            objectFit: "contain",
            borderRadius: "6px",
            boxShadow: "0 25px 80px rgba(0,0,0,0.6)",
            userSelect: "none",
          }}
        />
      </div>

      {/* Footer hint */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/30 text-xs select-none pointer-events-none">
        Scroll para zoom · Clique fora para fechar
      </div>
    </div>
  );
}
