"use client";

import { useState, useRef, useCallback } from "react";

export type ImageFormat = "1:1" | "9:16" | "4:5" | "1.91:1";
export type ImageQuality = "standard" | "hd";
export type ImageSourceTab = "ai" | "upload" | "url";

export interface LogoPosition {
  x: number;
  y: number;
}

export interface OverlayConfig {
  headlineX: number;
  headlineY: number;
  headlineFontSize: number;
  headlineColor: string;
  subtextX: number;
  subtextY: number;
  subtextFontSize: number;
  subtextColor: string;
}

const DEFAULT_OVERLAY: OverlayConfig = {
  headlineX: 50,
  headlineY: 75,
  headlineFontSize: 36,
  headlineColor: "#ffffff",
  subtextX: 50,
  subtextY: 85,
  subtextFontSize: 20,
  subtextColor: "#ffffffcc",
};

export const FORMAT_DIMENSIONS: Record<ImageFormat, { width: number; height: number; label: string }> = {
  "1:1":    { width: 1080, height: 1080, label: "1:1 (Feed)" },
  "9:16":   { width: 1080, height: 1920, label: "9:16 (Story/Reel)" },
  "4:5":    { width: 1080, height: 1350, label: "4:5 (Retrato)" },
  "1.91:1": { width: 1200, height: 628,  label: "1.91:1 (Link/Facebook)" },
};

export function useImageEditor(postId: string) {
  const [sourceTab, setSourceTab] = useState<ImageSourceTab>("ai");
  const [format, setFormat] = useState<ImageFormat>("1:1");
  const [quality, setQuality] = useState<ImageQuality>("standard");
  const [headline, setHeadline] = useState("");
  const [subtext, setSubtext] = useState("");
  const [overlay, setOverlay] = useState<OverlayConfig>(DEFAULT_OVERLAY);
  const [logoPosition, setLogoPosition] = useState<LogoPosition>({ x: 20, y: 20 });
  const [logoSize, setLogoSize] = useState(120);
  const [showLogo, setShowLogo] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isRemovingBg, setIsRemovingBg] = useState(false);
  const [currentImageKey, setCurrentImageKey] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const updateOverlay = useCallback((patch: Partial<OverlayConfig>) => {
    setOverlay((prev) => ({ ...prev, ...patch }));
  }, []);

  const reset = useCallback(() => {
    setCurrentImageKey(null);
    setHeadline("");
    setSubtext("");
    setOverlay(DEFAULT_OVERLAY);
    setAiPrompt("");
    setUrlInput("");
    setShowLogo(false);
  }, []);

  return {
    // State
    sourceTab, setSourceTab,
    format, setFormat,
    quality, setQuality,
    headline, setHeadline,
    subtext, setSubtext,
    overlay, updateOverlay,
    logoPosition, setLogoPosition,
    logoSize, setLogoSize,
    showLogo, setShowLogo,
    aiPrompt, setAiPrompt,
    urlInput, setUrlInput,
    isGenerating, setIsGenerating,
    isExporting, setIsExporting,
    isRemovingBg, setIsRemovingBg,
    currentImageKey, setCurrentImageKey,
    canvasRef,
    reset,
  };
}
