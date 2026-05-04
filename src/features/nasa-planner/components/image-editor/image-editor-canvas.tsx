"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { type OverlayConfig, type LogoPosition, FORMAT_DIMENSIONS, type ImageFormat } from "./use-image-editor";

const S3_BASE = process.env.NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL
  ? `https://${process.env.NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL}`
  : "";

function resolveUrl(key: string) {
  return key.startsWith("http") ? key : `${S3_BASE}/${key}`;
}

interface Props {
  imageKey: string | null;
  logoKey: string | null;
  headline: string;
  subtext: string;
  overlay: OverlayConfig;
  format: ImageFormat;
  showLogo: boolean;
  logoPosition: LogoPosition;
  logoSize: number;
  onLogoPositionChange: (pos: LogoPosition) => void;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

export function ImageEditorCanvas({
  imageKey,
  logoKey,
  headline,
  subtext,
  overlay,
  format,
  showLogo,
  logoPosition,
  logoSize,
  onLogoPositionChange,
  canvasRef,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const logoImageRef = useRef<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1);

  const { width: canvasW, height: canvasH } = FORMAT_DIMENSIONS[format];

  // Compute display scale to fit container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => {
      const containerW = el.clientWidth;
      const containerH = el.clientHeight;
      const s = Math.min(containerW / canvasW, containerH / canvasH, 1);
      setScale(s);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [canvasW, canvasH]);

  // Draw canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvasW, canvasH);

    // Background
    if (imageRef.current) {
      ctx.drawImage(imageRef.current, 0, 0, canvasW, canvasH);
    } else {
      ctx.fillStyle = "#1e1e2e";
      ctx.fillRect(0, 0, canvasW, canvasH);
    }

    // Logo overlay
    if (showLogo && logoImageRef.current) {
      ctx.drawImage(logoImageRef.current, logoPosition.x, logoPosition.y, logoSize, logoSize);
    }

    // Headline
    if (headline) {
      ctx.font = `bold ${overlay.headlineFontSize}px sans-serif`;
      ctx.fillStyle = overlay.headlineColor;
      ctx.textAlign = "center";
      ctx.shadowColor = "rgba(0,0,0,0.7)";
      ctx.shadowBlur = 8;
      const x = (overlay.headlineX / 100) * canvasW;
      const y = (overlay.headlineY / 100) * canvasH;
      ctx.fillText(headline, x, y);
      ctx.shadowBlur = 0;
    }

    // Subtext
    if (subtext) {
      ctx.font = `${overlay.subtextFontSize}px sans-serif`;
      ctx.fillStyle = overlay.subtextColor;
      ctx.textAlign = "center";
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 4;
      const x = (overlay.subtextX / 100) * canvasW;
      const y = (overlay.subtextY / 100) * canvasH;
      ctx.fillText(subtext, x, y);
      ctx.shadowBlur = 0;
    }
  }, [canvasW, canvasH, headline, subtext, overlay, showLogo, logoPosition, logoSize, canvasRef]);

  // Load main image
  useEffect(() => {
    if (!imageKey) { imageRef.current = null; draw(); return; }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => { imageRef.current = img; draw(); };
    img.onerror = () => { imageRef.current = null; draw(); };
    img.src = resolveUrl(imageKey);
  }, [imageKey, draw]);

  // Load logo
  useEffect(() => {
    if (!logoKey) { logoImageRef.current = null; draw(); return; }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => { logoImageRef.current = img; draw(); };
    img.onerror = () => { logoImageRef.current = null; draw(); };
    img.src = resolveUrl(logoKey);
  }, [logoKey, draw]);

  // Redraw on changes
  useEffect(() => { draw(); }, [draw]);

  // Logo drag & drop
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const handleLogoMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    isDragging.current = true;
    dragOffset.current = {
      x: e.clientX - logoPosition.x * scale,
      y: e.clientY - logoPosition.y * scale,
    };
  }, [logoPosition, scale]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const offsetX = e.clientX - rect.left - dragOffset.current.x;
      const offsetY = e.clientY - rect.top - dragOffset.current.y;
      const newX = Math.max(0, Math.min(canvasW - logoSize, offsetX / scale));
      const newY = Math.max(0, Math.min(canvasH - logoSize, offsetY / scale));
      onLogoPositionChange({ x: newX, y: newY });
    };
    const onUp = () => { isDragging.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [canvasW, canvasH, logoSize, scale, onLogoPositionChange]);

  const displayW = canvasW * scale;
  const displayH = canvasH * scale;

  return (
    <div
      ref={containerRef}
      className="relative flex items-center justify-center w-full overflow-hidden rounded-xl bg-zinc-900"
      style={{ minHeight: 200, maxHeight: "60vh", height: "100%" }}
    >
      {/* Hidden native canvas for export */}
      <canvas
        ref={canvasRef}
        width={canvasW}
        height={canvasH}
        className="hidden"
      />

      {/* Visible scaled preview */}
      <div
        className="relative overflow-hidden rounded-lg shadow-2xl"
        style={{ width: displayW, height: displayH }}
      >
        {/* Base image */}
        {imageKey ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resolveUrl(imageKey)}
            alt="Post"
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900">
            <p className="text-zinc-500 text-sm">Sem imagem</p>
          </div>
        )}

        {/* Text overlay preview */}
        {headline && (
          <div
            className="absolute text-white font-bold drop-shadow-lg text-center w-full px-4 pointer-events-none"
            style={{
              top: `${overlay.headlineY}%`,
              left: `${overlay.headlineX}%`,
              transform: "translate(-50%, -50%)",
              fontSize: overlay.headlineFontSize * scale,
              color: overlay.headlineColor,
            }}
          >
            {headline}
          </div>
        )}
        {subtext && (
          <div
            className="absolute text-white drop-shadow-md text-center w-full px-4 pointer-events-none"
            style={{
              top: `${overlay.subtextY}%`,
              left: `${overlay.subtextX}%`,
              transform: "translate(-50%, -50%)",
              fontSize: overlay.subtextFontSize * scale,
              color: overlay.subtextColor,
            }}
          >
            {subtext}
          </div>
        )}

        {/* Logo overlay (draggable) */}
        {showLogo && logoKey && (
          <div
            ref={logoRef}
            className={cn(
              "absolute cursor-move select-none rounded-lg overflow-hidden ring-2 ring-white/30",
              "hover:ring-white/70 transition-all",
            )}
            style={{
              left: logoPosition.x * scale,
              top: logoPosition.y * scale,
              width: logoSize * scale,
              height: logoSize * scale,
            }}
            onMouseDown={handleLogoMouseDown}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={resolveUrl(logoKey)} alt="Logo" className="w-full h-full object-contain" />
          </div>
        )}

        {/* Format badge */}
        <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full backdrop-blur-sm pointer-events-none">
          {format}
        </div>
      </div>
    </div>
  );
}
