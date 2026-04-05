"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, Check, Pencil, Upload } from "lucide-react";

interface LayoutElement {
  id: string;
  type: "name" | "title" | "message" | "hide" | "link" | "image";
  label: string;
  x: number;
  y: number;
  visible: boolean;
  fontSize?: number;
  color?: string;
  imageUrl?: string;
  imageSize?: number;
  boxWidth?: number;
  boxHeight?: number;
  href?: string;       // URL to open when element is clicked
  hrefTarget?: string; // "_blank" | "_self"
  isHide?: boolean;    // closes popup when clicked
}

const RESIZE_HANDLES = [
  { id: "nw", left: "0%",   top: "0%",   cursor: "nw-resize" },
  { id: "n",  left: "50%",  top: "0%",   cursor: "n-resize"  },
  { id: "ne", left: "100%", top: "0%",   cursor: "ne-resize" },
  { id: "w",  left: "0%",   top: "50%",  cursor: "w-resize"  },
  { id: "e",  left: "100%", top: "50%",  cursor: "e-resize"  },
  { id: "sw", left: "0%",   top: "100%", cursor: "sw-resize" },
  { id: "s",  left: "50%",  top: "100%", cursor: "s-resize"  },
  { id: "se", left: "100%", top: "100%", cursor: "se-resize" },
] as const;

const HANDLE_SIGNS: Record<string, [number, number]> = {
  nw: [-1, -1], n: [0, -1], ne: [1, -1],
  w:  [-1,  0],              e: [1,  0],
  sw: [-1,  1], s: [0,  1], se: [1,  1],
};

interface PopupTemplate {
  id?: string;
  name: string;
  type: "achievement" | "stars_reward" | "level_up";
  title: string;
  message: string;
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  iconUrl?: string;
  enableConfetti: boolean;
  enableSound: boolean;
  dismissDuration: number;
  customJson?: Record<string, unknown>;
}

interface PopupTemplateModalProps {
  template: PopupTemplate;
  isOpen: boolean;
  isCreating?: boolean;
  onClose: () => void;
  onSave: (template: PopupTemplate) => Promise<void>;
  onLiveChange?: (template: PopupTemplate) => void;
  globalPatterns?: { id: string; label: string; url: string }[];
  isLoading?: boolean;
}

const DEFAULT_SVG_PATTERNS = [
  { id: "padrao", label: "Padrão NASA", url: "/popup-patterns/padrao.svg" },
];

const COLOR_PRESETS = [
  // NASA / Space
  { label: "NASA Purple",  primary: "#7a1fe7", accent: "#a855f7", bg: "#1a0a3d", text: "#ffffff" },
  { label: "Deep Space",   primary: "#3b82f6", accent: "#60a5fa", bg: "#0f172a", text: "#e2e8f0" },
  { label: "Nebula",       primary: "#ec4899", accent: "#f472b6", bg: "#1e0533", text: "#fce7f3" },
  { label: "Aurora",       primary: "#10b981", accent: "#34d399", bg: "#022c22", text: "#d1fae5" },
  { label: "Solar Flare",  primary: "#f59e0b", accent: "#fbbf24", bg: "#1c1100", text: "#fef3c7" },
  { label: "Red Planet",   primary: "#ef4444", accent: "#f87171", bg: "#1f0707", text: "#fee2e2" },
  { label: "Ice Giant",    primary: "#06b6d4", accent: "#22d3ee", bg: "#042330", text: "#cffafe" },
  { label: "Midnight",     primary: "#6366f1", accent: "#818cf8", bg: "#0f0f23", text: "#e0e7ff" },
];

interface ColorPaletteProps {
  values: { primaryColor: string; accentColor: string; backgroundColor: string; textColor: string };
  onChange: (field: string, value: string) => void;
  disabled?: boolean;
}

function ColorPalette({ values, onChange, disabled }: ColorPaletteProps) {
  const [openPicker, setOpenPicker] = useState<string | null>(null);

  const fields = [
    { label: "Cor Primária",  field: "primaryColor",     key: "primary" as const },
    { label: "Cor Acento",    field: "accentColor",      key: "accent"  as const },
    { label: "Cor Fundo",     field: "backgroundColor",  key: "bg"      as const },
    { label: "Cor Texto",     field: "textColor",        key: "text"    as const },
  ];

  const applyPreset = (preset: typeof COLOR_PRESETS[0]) => {
    onChange("primaryColor",    preset.primary);
    onChange("accentColor",     preset.accent);
    onChange("backgroundColor", preset.bg);
    onChange("textColor",       preset.text);
  };

  return (
    <div className="space-y-4">
      {/* Presets */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">Paletas de cores</label>
        <div className="flex flex-wrap gap-2">
          {COLOR_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              title={p.label}
              onClick={() => applyPreset(p)}
              disabled={disabled}
              className="group relative flex items-center gap-1 px-2 py-1.5 rounded-lg border border-zinc-700 hover:border-violet-500/60 bg-zinc-800 hover:bg-zinc-700 transition-all"
            >
              <span className="flex gap-0.5">
                {[p.primary, p.accent, p.bg, p.text].map((c, i) => (
                  <span key={i} className="w-3 h-3 rounded-full border border-white/10" style={{ backgroundColor: c }} />
                ))}
              </span>
              <span className="text-[10px] text-zinc-400 group-hover:text-white transition-colors">{p.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Individual pickers */}
      <div className="grid grid-cols-2 gap-4">
        {fields.map(({ label, field }) => {
          const value = values[field as keyof typeof values];
          const isOpen = openPicker === field;
          return (
            <div key={field} className="relative">
              <label className="block text-sm font-medium text-zinc-300 mb-2">{label}</label>
              <button
                type="button"
                disabled={disabled}
                onClick={() => setOpenPicker(isOpen ? null : field)}
                className="w-full flex items-center gap-2 bg-zinc-800 border border-zinc-700 hover:border-violet-500/60 rounded-lg px-3 py-2 transition-all"
              >
                <span className="w-5 h-5 rounded-md border border-white/20 shrink-0" style={{ backgroundColor: value }} />
                <span className="text-sm text-white font-mono flex-1 text-left">{value}</span>
              </button>

              {isOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setOpenPicker(null)} />
                  <div className="absolute z-50 top-full left-0 mt-1 w-64 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl p-3 space-y-3">
                  {/* Native color picker */}
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={value}
                      onChange={(e) => onChange(field, e.target.value)}
                      className="w-10 h-10 rounded-lg cursor-pointer border border-zinc-700 bg-zinc-800"
                    />
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => /^#[0-9a-fA-F]{0,6}$/.test(e.target.value) && onChange(field, e.target.value)}
                      className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-violet-500/60"
                    />
                    <button
                      type="button"
                      onClick={() => setOpenPicker(null)}
                      className="text-zinc-500 hover:text-white transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Swatches per field */}
                  <div>
                    <p className="text-[10px] text-zinc-500 mb-1.5">Sugestões</p>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        "#7a1fe7","#a855f7","#3b82f6","#06b6d4","#10b981",
                        "#f59e0b","#ef4444","#ec4899","#6366f1","#ffffff",
                        "#e2e8f0","#fbbf24","#34d399","#f472b6","#818cf8",
                        "#1a0a3d","#0f172a","#022c22","#042330","#000000",
                      ].map((c) => (
                        <button
                          key={c}
                          type="button"
                          title={c}
                          onClick={() => onChange(field, c)}
                          className={`w-6 h-6 rounded-md border-2 transition-all hover:scale-110 ${value === c ? "border-white" : "border-transparent hover:border-white/40"}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const POPUP_FUNCTIONS = [
  { value: "STAR", label: "STAR" },
  { value: "SPACE_POINT", label: "SPACE POINT" },
  { value: "NOTIFICATIONS", label: "NOTIFICAÇÕES" },
  { value: "GUIDED_TOUR", label: "TOUR GUIADO" },
  { value: "APP_ACTIONS", label: "AÇÕES EM APLICATIVOS" },
];

export function PopupTemplateModal({
  template: initialTemplate,
  isOpen,
  isCreating = false,
  onClose,
  onSave,
  onLiveChange,
  globalPatterns = [],
  isLoading = false,
}: PopupTemplateModalProps) {
  const [template, setTemplate] = useState(initialTemplate);

  const setTemplateAndNotify = useCallback((next: typeof initialTemplate) => {
    setTemplate(next);
  }, []);
  const [svgPattern, setSvgPattern] = useState<string>(
    (initialTemplate.customJson?.svgPattern as string) ?? ""
  );
  const [popupFunction, setPopupFunction] = useState<string>(
    (initialTemplate.customJson?.popupFunction as string) ?? "STAR"
  );
  const [clickUrl, setClickUrl] = useState<string>(
    (initialTemplate.customJson?.clickUrl as string) ?? ""
  );
  const [clickUrlTarget, setClickUrlTarget] = useState<string>(
    (initialTemplate.customJson?.clickUrlTarget as string) ?? "_blank"
  );
  const [prizeValue, setPrizeValue] = useState<string>(
    (initialTemplate.customJson?.prizeValue as string) ?? ""
  );
  const [mascots, setMascots] = useState<{ key: string; url: string; label: string }[]>([]);
  const [layoutElements, setLayoutElements] = useState<LayoutElement[]>(
    (initialTemplate.customJson?.layoutElements as LayoutElement[]) ?? [
      { id: "name",    type: "name",    label: "Nome",      x: 60, y: 20, visible: true,  fontSize: 20, color: "#ffffff", boxWidth: 35, boxHeight: 12 },
      { id: "title",   type: "title",   label: "Título",    x: 60, y: 40, visible: true,  fontSize: 14, color: "#ffffff", boxWidth: 35, boxHeight: 10 },
      { id: "message", type: "message", label: "Mensagem",  x: 60, y: 65, visible: true,  fontSize: 11, color: "#ffffff", boxWidth: 40, boxHeight: 22 },
      { id: "hide",    type: "hide",    label: "Hide",      x: 92, y: 12, visible: false, fontSize: 22, color: "#ffffff" },
      { id: "link",    type: "link",    label: "Link",      x: 80, y: 96, visible: false, fontSize: 11, color: "#ffffff", boxWidth: 15, boxHeight:  8 },
    ]
  );
  const [draggingElement, setDraggingElement] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const resizingRef = useRef<{
    id: string; handle: string;
    startMx: number; startMy: number;
    startEl: LayoutElement;
    containerW: number; containerH: number;
  } | null>(null);
  const [colorizedPatternUrl, setColorizedPatternUrl] = useState<string | null>(null);
  const svgCacheRef = useRef<Record<string, string>>({});
  const blobUrlRef = useRef<string | null>(null);

  const applyColorsToSvg = useCallback(async (patternUrl: string) => {
    try {
      if (!svgCacheRef.current[patternUrl]) {
        const res = await fetch(patternUrl);
        svgCacheRef.current[patternUrl] = await res.text();
      }
      let svg = svgCacheRef.current[patternUrl];
      // Replace known base colors with template colors
      svg = svg
        .replace(/#7a1fe7/gi, template.primaryColor)
        .replace(/#29125b/gi, template.primaryColor + "88")
        .replace(/#1a0a3d/gi, template.backgroundColor)
        .replace(/#ff00ff/gi, template.accentColor)
        .replace(/#fff2e6/gi, template.textColor);

      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      const blob = new Blob([svg], { type: "image/svg+xml" });
      blobUrlRef.current = URL.createObjectURL(blob);
      setColorizedPatternUrl(blobUrlRef.current);
    } catch {
      setColorizedPatternUrl(patternUrl);
    }
  }, [template.primaryColor, template.backgroundColor, template.accentColor, template.textColor]);

  useEffect(() => {
    const pat = SVG_PATTERNS.find((p) => p.id === svgPattern);
    if (pat) {
      applyColorsToSvg(pat.url);
    } else {
      setColorizedPatternUrl(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svgPattern, template.primaryColor, template.backgroundColor, template.accentColor, template.textColor, applyColorsToSvg]);
  const [customPatterns, setCustomPatterns] = useState<{ id: string; label: string; url: string }[]>(
    (initialTemplate.customJson?.customPatterns as { id: string; label: string; url: string }[]) ?? []
  );
  const [patternUrlOverrides, setPatternUrlOverrides] = useState<Record<string, string>>(
    (initialTemplate.customJson?.patternUrlOverrides as Record<string, string>) ?? {}
  );
  const [editingPatternId, setEditingPatternId] = useState<string | null>(null);
  const [uploadingPattern, setUploadingPattern] = useState(false);

  // Emit full merged template to parent on any relevant state change
  useEffect(() => {
    if (!onLiveChange) return;
    onLiveChange({
      ...template,
      customJson: {
        ...(template.customJson ?? {}),
        svgPattern,
        popupFunction,
        prizeValue,
        clickUrl,
        clickUrlTarget,
        layoutElements,
        customPatterns,
        patternUrlOverrides,
      },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template, svgPattern, clickUrl, clickUrlTarget, layoutElements, customPatterns, patternUrlOverrides]);

  const SVG_PATTERNS = [...DEFAULT_SVG_PATTERNS, ...globalPatterns, ...customPatterns].map((p) => ({
    ...p,
    url: patternUrlOverrides[p.id] ?? p.url,
  }));

  const handlePatternUpload = async (file: File, replaceId?: string) => {
    setUploadingPattern(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "popup-patterns");
      const res = await fetch("/api/upload-local", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro no upload");
      const url = `${window.location.origin}${data.url}?t=${Date.now()}`;
      if (replaceId) {
        const isDefault = DEFAULT_SVG_PATTERNS.some((p) => p.id === replaceId);
        if (isDefault) {
          setPatternUrlOverrides((prev) => ({ ...prev, [replaceId]: url }));
        } else {
          setCustomPatterns((prev) =>
            prev.map((p) => p.id === replaceId ? { ...p, url } : p)
          );
        }
        setSvgPattern(replaceId);
      } else {
        const newId = `custom-${Date.now()}`;
        const newPattern = { id: newId, label: file.name.replace(/\.[^.]+$/, ""), url };
        setCustomPatterns((prev) => [...prev, newPattern]);
        setSvgPattern(newId);
      }
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setUploadingPattern(false);
      setEditingPatternId(null);
    }
  };

  // Fetch uploaded mascots
  useEffect(() => {
    fetch("/api/admin/assets/mascots")
      .then((r) => r.json())
      .then((data) => setMascots(data ?? []))
      .catch(() => {});
  }, []);

  // ── Resize via document mouse events ─────────────────────────────────────
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const r = resizingRef.current;
      if (!r) return;
      const dx = ((e.clientX - r.startMx) / r.containerW) * 100;
      const dy = ((e.clientY - r.startMy) / r.containerH) * 100;
      const [sx, sy] = HANDLE_SIGNS[r.handle] ?? [0, 0];
      const dw = dx * sx, dh = dy * sy;
      const newW = Math.max(8, (r.startEl.boxWidth ?? 30) + dw);
      const newH = Math.max(4, (r.startEl.boxHeight ?? 12) + dh);
      setLayoutElements((prev) =>
        prev.map((el) =>
          el.id === r.id
            ? { ...el, x: r.startEl.x + dw / 2, y: r.startEl.y + dh / 2, boxWidth: newW, boxHeight: newH }
            : el
        )
      );
    };
    const onUp = () => { resizingRef.current = null; };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, []);

  const handleResizeMouseDown = (e: React.MouseEvent, elementId: string, handle: string) => {
    e.preventDefault();
    e.stopPropagation();
    const el = layoutElements.find((el) => el.id === elementId);
    if (!el || !previewRef.current) return;
    const rect = previewRef.current.getBoundingClientRect();
    resizingRef.current = {
      id: elementId, handle,
      startMx: e.clientX, startMy: e.clientY,
      startEl: { ...el },
      containerW: rect.width, containerH: rect.height,
    };
  };

  const handleElementDragStart = (e: React.DragEvent, elementId: string) => {
    if (resizingRef.current) { e.preventDefault(); return; }
    setDraggingElement(elementId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handlePreviewDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handlePreviewDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggingElement) return;

    const preview = e.currentTarget as HTMLElement;
    const rect = preview.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

    setLayoutElements(
      layoutElements.map((el) =>
        el.id === draggingElement ? { ...el, x, y } : el
      )
    );
    setDraggingElement(null);
  };

  const toggleElementVisibility = (elementId: string) => {
    setLayoutElements(
      layoutElements.map((el) =>
        el.id === elementId ? { ...el, visible: !el.visible } : el
      )
    );
  };

  const removeElement = (elementId: string) => {
    setLayoutElements((prev) => prev.filter((el) => el.id !== elementId));
  };

  const addImageElement = (mascot: { key: string; url: string; label: string }) => {
    const newEl: LayoutElement = {
      id: `image-${mascot.key}-${Date.now()}`,
      type: "image",
      label: mascot.label,
      x: 50,
      y: 50,
      visible: true,
      imageUrl: mascot.url,
      imageSize: 20,
    };
    setLayoutElements((prev) => [...prev, newEl]);
  };

  const handleSave = async () => {
    if (!template.name || !template.title) {
      alert("Por favor, preencha o nome e título do template");
      return;
    }
    if (popupFunction === "SPACE_POINT" && !prizeValue) {
      alert("Por favor, preencha o campo de Prêmio");
      return;
    }
    const merged: PopupTemplate = {
      ...template,
      customJson: {
        ...(template.customJson ?? {}),
        svgPattern,
        popupFunction,
        prizeValue,
        clickUrl,
        clickUrlTarget,
        layoutElements,
        customPatterns,
        patternUrlOverrides,
      },
    };
    await onSave(merged);
    onClose();
  };

  if (!isOpen) return null;

  const selectedPattern = SVG_PATTERNS.find((p) => p.id === svgPattern);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800 sticky top-0 bg-zinc-900 z-10">
          <h2 className="text-xl font-bold text-white">{isCreating ? "Novo Template" : "Editar Template"}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white" disabled={isLoading}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Nome</label>
            <input
              type="text"
              value={template.name}
              onChange={(e) => setTemplate({ ...template, name: e.target.value })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-violet-500/60"
              disabled={isLoading}
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Tipo</label>
            <select
              value={template.type}
              onChange={(e) => setTemplate({ ...template, type: e.target.value as PopupTemplate["type"] })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-violet-500/60"
              disabled={isLoading}
            >
              <option value="achievement">Conquista</option>
              <option value="stars_reward">Recompensa Stars</option>
              <option value="level_up">Novo Nível</option>
            </select>
          </div>

          {/* Popup Function */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Função</label>
            <select
              value={popupFunction}
              onChange={(e) => setPopupFunction(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-violet-500/60"
              disabled={isLoading}
            >
              {POPUP_FUNCTIONS.map((fn) => (
                <option key={fn.value} value={fn.value}>
                  {fn.label}
                </option>
              ))}
            </select>
          </div>

          {/* Global click URL */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Link do popup{" "}
              <span className="text-zinc-500 font-normal text-xs">(clicar em qualquer lugar abre o link)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={clickUrl}
                onChange={(e) => setClickUrl(e.target.value)}
                placeholder="https://... ou /ranking"
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500/60"
                disabled={isLoading}
              />
              <select
                value={clickUrlTarget}
                onChange={(e) => setClickUrlTarget(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-2 text-white text-xs focus:outline-none focus:border-violet-500/60"
                disabled={isLoading}
              >
                <option value="_blank">Nova aba</option>
                <option value="_self">Mesma aba</option>
              </select>
              {clickUrl && (
                <button type="button" onClick={() => setClickUrl("")} className="px-2 text-zinc-500 hover:text-red-400 transition-colors text-xs">
                  ×
                </button>
              )}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Título</label>
            <input
              type="text"
              value={template.title}
              onChange={(e) => setTemplate({ ...template, title: e.target.value })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-violet-500/60"
              disabled={isLoading}
            />
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Mensagem</label>
            <textarea
              value={template.message}
              onChange={(e) => setTemplate({ ...template, message: e.target.value })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-violet-500/60 resize-none h-20"
              disabled={isLoading}
            />
          </div>

          {/* Prize Value - Conditional */}
          {popupFunction === "SPACE_POINT" && (
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Prêmio</label>
              <input
                type="text"
                value={prizeValue}
                onChange={(e) => setPrizeValue(e.target.value)}
                placeholder="Ex: 10 STARS"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-violet-500/60"
                disabled={isLoading}
              />
            </div>
          )}

          {/* SVG Pattern */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-zinc-300">Padrão do Banner</label>
              <label className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs cursor-pointer transition-all ${uploadingPattern ? "opacity-50 pointer-events-none" : "bg-zinc-700 hover:bg-zinc-600 text-zinc-300"}`}>
                <Upload className="w-3 h-3" />
                {uploadingPattern ? "Enviando..." : "Novo padrão"}
                <input
                  type="file"
                  accept="image/svg+xml,image/png,image/jpeg,image/webp"
                  className="hidden"
                  disabled={isLoading || uploadingPattern}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handlePatternUpload(file);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {/* No pattern option */}
              <button
                type="button"
                onClick={() => setSvgPattern("")}
                className={`relative border-2 rounded-xl p-3 flex flex-col items-center gap-2 transition-all ${
                  !svgPattern ? "border-violet-500 bg-violet-600/10" : "border-zinc-700 hover:border-zinc-600"
                }`}
              >
                <div className="w-full h-12 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-500 text-xs">
                  Sem padrão
                </div>
                {!svgPattern && <Check className="absolute top-1.5 right-1.5 w-4 h-4 text-violet-400" />}
              </button>

              {SVG_PATTERNS.map((p) => (
                <div
                  key={p.id}
                  className={`relative border-2 rounded-xl p-2 flex flex-col items-center gap-2 transition-all cursor-pointer ${
                    svgPattern === p.id ? "border-violet-500 bg-violet-600/10" : "border-zinc-700 hover:border-zinc-600"
                  }`}
                  onClick={() => setSvgPattern(p.id)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={p.label} className="w-full h-16 object-cover rounded-lg" />
                  <span className="text-xs text-zinc-300 truncate w-full text-center">{p.label}</span>
                  {svgPattern === p.id && <Check className="absolute top-1.5 right-1.5 w-4 h-4 text-violet-400" />}
                  {/* Edit button */}
                  <label
                    className="absolute bottom-1.5 right-1.5 w-6 h-6 bg-zinc-800/90 hover:bg-violet-600 rounded-md flex items-center justify-center cursor-pointer transition-colors"
                    title="Substituir imagem"
                    onClick={(e) => { e.stopPropagation(); setEditingPatternId(p.id); }}
                  >
                    <Pencil className="w-3 h-3 text-white" />
                    {editingPatternId === p.id && (
                      <input
                        type="file"
                        accept="image/svg+xml,image/png,image/jpeg,image/webp"
                        className="hidden"
                        autoFocus
                        disabled={isLoading || uploadingPattern}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handlePatternUpload(file, p.id);
                          e.target.value = "";
                        }}
                        onBlur={() => setEditingPatternId(null)}
                      />
                    )}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Elements — add as draggable to preview */}
          {mascots.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">
                Elementos arrastáveis{" "}
                <span className="text-zinc-500 font-normal text-xs">(clique para adicionar na Prévia)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {mascots.map((m) => {
                  const alreadyAdded = layoutElements.some(
                    (el) => el.type === "image" && el.imageUrl === m.url
                  );
                  return (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => !alreadyAdded && addImageElement(m)}
                      disabled={isLoading || alreadyAdded}
                      title={alreadyAdded ? `${m.label} já adicionado` : `Adicionar ${m.label} à prévia`}
                      className={`relative flex items-center gap-2 px-2 py-1.5 rounded-xl border-2 transition-all ${
                        alreadyAdded
                          ? "border-emerald-500/50 bg-emerald-600/10 opacity-60 cursor-default"
                          : "border-zinc-700 hover:border-violet-500 bg-zinc-800 hover:bg-violet-600/10 cursor-pointer"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={m.url} alt={m.label} className="w-7 h-7 object-contain rounded" />
                      <span className="text-xs text-zinc-300">{m.label}</span>
                      {alreadyAdded && <Check className="w-3 h-3 text-emerald-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Colors */}
          <ColorPalette
            values={{
              primaryColor: template.primaryColor,
              accentColor: template.accentColor,
              backgroundColor: template.backgroundColor,
              textColor: template.textColor,
            }}
            onChange={(field, value) => setTemplateAndNotify({ ...template, [field]: value })}
            disabled={isLoading}
          />

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Duração (ms)</label>
            <input
              type="number"
              value={template.dismissDuration}
              onChange={(e) => setTemplate({ ...template, dismissDuration: Number(e.target.value) })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-violet-500/60"
              disabled={isLoading}
            />
          </div>

          {/* Toggles */}
          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={template.enableConfetti}
                onChange={(e) => setTemplate({ ...template, enableConfetti: e.target.checked })}
                className="rounded border-zinc-700"
                disabled={isLoading}
              />
              <span className="text-sm text-zinc-300">Confete</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={template.enableSound}
                onChange={(e) => setTemplate({ ...template, enableSound: e.target.checked })}
                className="rounded border-zinc-700"
                disabled={isLoading}
              />
              <span className="text-sm text-zinc-300">Som</span>
            </label>
          </div>

          {/* Preview */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-3">Prévia (Arraste os elementos)</label>
            <div
              ref={previewRef}
              className="relative w-full rounded-xl overflow-hidden popup-cq"
              style={{
                aspectRatio: "768/391",
                background: "transparent",
              }}
              onDragOver={handlePreviewDragOver}
              onDrop={handlePreviewDrop}
              onClick={() => setSelectedId(null)}
            >
              {colorizedPatternUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={colorizedPatternUrl} alt="padrão" className="absolute inset-0 w-full h-full object-cover" />
              )}
              {/* Draggable elements */}
              {layoutElements.map((el) => {
                if (!el.visible) return null;
                if (el.type === "image" && el.imageUrl) {
                  return (
                    <div
                      key={el.id}
                      draggable
                      onDragStart={(e) => handleElementDragStart(e, el.id)}
                      className="absolute cursor-move"
                      style={{
                        left: `${el.x}%`,
                        top: `${el.y}%`,
                        width: `${el.imageSize ?? 20}%`,
                        opacity: draggingElement === el.id ? 0.4 : 1,
                        transform: "translate(-50%, -50%)",
                        filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.5))",
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={el.imageUrl} alt={el.label} className="w-full h-auto object-contain pointer-events-none" />
                    </div>
                  );
                }
                const isSelected = selectedId === el.id;
                const circleSize = `${((el.fontSize ?? 22) * 2.6 / 768) * 100}cqw`;
                if (el.type === "hide") {
                  return (
                    <div
                      key={el.id}
                      draggable
                      onDragStart={(e) => handleElementDragStart(e, el.id)}
                      onClick={(e) => { e.stopPropagation(); setSelectedId(el.id); }}
                      className="absolute cursor-move"
                      style={{
                        left: `${el.x}%`,
                        top: `${el.y}%`,
                        width: circleSize,
                        height: circleSize,
                        transform: "translate(-50%, -50%)",
                        opacity: draggingElement === el.id ? 0.5 : 1,
                        borderRadius: "50%",
                        background: isSelected ? `${template.accentColor}55` : `${template.accentColor}33`,
                        border: isSelected
                          ? `2px solid ${template.accentColor}`
                          : `2px solid ${el.color ?? template.accentColor}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: el.color ?? "#ffffff",
                        fontSize: `${((el.fontSize ?? 22) / 768) * 100}cqw`,
                        boxSizing: "border-box",
                        flexShrink: 0,
                      }}
                    >
                      <span className="pointer-events-none select-none leading-none">✕</span>
                    </div>
                  );
                }
                return (
                  <div
                    key={el.id}
                    draggable
                    onDragStart={(e) => handleElementDragStart(e, el.id)}
                    onClick={(e) => { e.stopPropagation(); setSelectedId(el.id); }}
                    className="absolute cursor-move"
                    style={{
                      left: `${el.x}%`,
                      top: `${el.y}%`,
                      width: `${el.boxWidth ?? 30}%`,
                      minHeight: `${el.boxHeight ?? 12}%`,
                      transform: "translate(-50%, -50%)",
                      opacity: draggingElement === el.id ? 0.5 : 1,
                      color: el.color ?? template.textColor,
                      fontFamily: "var(--font-bungee), sans-serif",
                      fontSize: `${((el.fontSize ?? 12) / 768) * 100}cqw`,
                      textShadow: "0 1px 3px rgba(0,0,0,0.6)",
                      padding: "2px 6px",
                      boxSizing: "border-box",
                      wordBreak: "break-word",
                      whiteSpace: "normal",
                      overflow: "hidden",
                      border: isSelected ? "1px solid rgba(139,92,246,0.9)" : "1px dashed rgba(255,255,255,0.3)",
                      background: isSelected ? "rgba(139,92,246,0.12)" : "rgba(255,255,255,0.06)",
                      borderRadius: "4px",
                    }}
                  >
                    {el.type === "link" ? (
                      <span
                        className="pointer-events-none select-none flex items-center justify-center gap-1"
                        style={{
                          background: "rgba(139,92,246,0.18)",
                          border: "1px solid rgba(139,92,246,0.5)",
                          borderRadius: "6px",
                          padding: "2px 10px",
                          color: el.color ?? "#ffffff",
                          fontSize: `${((el.fontSize ?? 12) / 768) * 100}cqw`,
                          fontFamily: "var(--font-bungee), sans-serif",
                          width: "100%",
                          display: "flex",
                        }}
                      >
                        ↗ Ver mais
                      </span>
                    ) : (
                      <span className="pointer-events-none select-none">
                        {el.type === "name"    && (template.name    || "Nome")}
                        {el.type === "title"   && (template.title   || "Título")}
                        {el.type === "message" && (template.message || "Mensagem")}
                      </span>
                    )}
                    {/* Resize handles */}
                    {isSelected && RESIZE_HANDLES.map((h) => (
                      <div
                        key={h.id}
                        onMouseDown={(e) => handleResizeMouseDown(e, el.id, h.id)}
                        style={{
                          position: "absolute",
                          left: h.left,
                          top: h.top,
                          transform: "translate(-50%, -50%)",
                          width: 8,
                          height: 8,
                          background: "#8b5cf6",
                          border: "1.5px solid #fff",
                          borderRadius: 2,
                          cursor: h.cursor,
                          zIndex: 20,
                          pointerEvents: "auto",
                        }}
                      />
                    ))}
                  </div>
                );
              })}
            </div>

            {/* Element controls */}
            <div className="mt-3 space-y-2">
              {layoutElements.map((el) => (
                <div key={el.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleElementVisibility(el.id)}
                    className={`w-24 shrink-0 px-2 py-1 text-xs rounded transition-all text-left truncate ${
                      el.visible
                        ? "bg-violet-600 text-white"
                        : "bg-zinc-700 text-zinc-400 hover:bg-zinc-600"
                    }`}
                    disabled={isLoading}
                    title={el.label}
                  >
                    {el.label}
                  </button>

                  {el.type === "image" ? (
                    /* Image element controls */
                    <div className="flex items-center gap-1 flex-1">
                      {el.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={el.imageUrl} alt={el.label} className="w-6 h-6 object-contain rounded border border-zinc-700 shrink-0" />
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setLayoutElements(layoutElements.map((e) =>
                            e.id === el.id ? { ...e, imageSize: Math.max(5, (e.imageSize ?? 20) - 5) } : e
                          ))
                        }
                        className="w-6 h-6 bg-zinc-700 hover:bg-zinc-600 text-white rounded text-xs flex items-center justify-center"
                        disabled={isLoading}
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={5}
                        max={100}
                        value={el.imageSize ?? 20}
                        onChange={(e) =>
                          setLayoutElements(layoutElements.map((item) =>
                            item.id === el.id
                              ? { ...item, imageSize: Math.max(5, Math.min(100, Number(e.target.value))) }
                              : item
                          ))
                        }
                        className="w-12 bg-zinc-800 border border-zinc-700 rounded text-white text-xs text-center px-1 py-1 focus:outline-none focus:border-violet-500/60"
                        disabled={isLoading}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setLayoutElements(layoutElements.map((e) =>
                            e.id === el.id ? { ...e, imageSize: Math.min(100, (e.imageSize ?? 20) + 5) } : e
                          ))
                        }
                        className="w-6 h-6 bg-zinc-700 hover:bg-zinc-600 text-white rounded text-xs flex items-center justify-center"
                        disabled={isLoading}
                      >
                        +
                      </button>
                      <span className="text-zinc-500 text-xs">%</span>
                      <button
                        type="button"
                        onClick={() => removeElement(el.id)}
                        className="ml-auto w-6 h-6 bg-red-500/20 hover:bg-red-500/40 text-red-400 hover:text-red-300 rounded text-xs flex items-center justify-center"
                        disabled={isLoading}
                        title="Remover elemento"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    /* Text element controls */
                    <div className="flex items-center gap-1 flex-1">
                      <button
                        type="button"
                        onClick={() =>
                          setLayoutElements(layoutElements.map((e) =>
                            e.id === el.id ? { ...e, fontSize: Math.max(8, (e.fontSize ?? 12) - 1) } : e
                          ))
                        }
                        className="w-6 h-6 bg-zinc-700 hover:bg-zinc-600 text-white rounded text-xs flex items-center justify-center"
                        disabled={isLoading}
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={8}
                        max={72}
                        value={el.fontSize ?? 12}
                        onChange={(e) =>
                          setLayoutElements(layoutElements.map((item) =>
                            item.id === el.id
                              ? { ...item, fontSize: Math.max(8, Math.min(72, Number(e.target.value))) }
                              : item
                          ))
                        }
                        className="w-12 bg-zinc-800 border border-zinc-700 rounded text-white text-xs text-center px-1 py-1 focus:outline-none focus:border-violet-500/60"
                        disabled={isLoading}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setLayoutElements(layoutElements.map((e) =>
                            e.id === el.id ? { ...e, fontSize: Math.min(72, (e.fontSize ?? 12) + 1) } : e
                          ))
                        }
                        className="w-6 h-6 bg-zinc-700 hover:bg-zinc-600 text-white rounded text-xs flex items-center justify-center"
                        disabled={isLoading}
                      >
                        +
                      </button>
                      <span className="text-zinc-500 text-xs">px</span>
                      <input
                        type="color"
                        value={el.color ?? "#ffffff"}
                        onChange={(e) =>
                          setLayoutElements(layoutElements.map((item) =>
                            item.id === el.id ? { ...item, color: e.target.value } : item
                          ))
                        }
                        className="w-7 h-7 rounded cursor-pointer border border-zinc-700 bg-zinc-800 shrink-0"
                        title={`Cor de ${el.label}`}
                        disabled={isLoading}
                      />
                    </div>
                  )}

                  {/* Link — for non-hide elements */}
                  {el.type !== "hide" && (
                    <div className="w-full flex items-center gap-1 mt-1 ml-[6.5rem]">
                      <input
                        type="url"
                        value={el.href ?? ""}
                        onChange={(e) =>
                          setLayoutElements(layoutElements.map((item) =>
                            item.id === el.id ? { ...item, href: e.target.value || undefined } : item
                          ))
                        }
                        placeholder="Link (ex: /ranking)"
                        className="flex-1 bg-zinc-800 border border-zinc-700 rounded text-white text-[10px] px-2 py-1 focus:outline-none focus:border-violet-500/60"
                        disabled={isLoading}
                      />
                      <select
                        value={el.hrefTarget ?? "_blank"}
                        onChange={(e) =>
                          setLayoutElements(layoutElements.map((item) =>
                            item.id === el.id ? { ...item, hrefTarget: e.target.value } : item
                          ))
                        }
                        className="bg-zinc-800 border border-zinc-700 rounded text-white text-[10px] px-1 py-1 focus:outline-none focus:border-violet-500/60"
                        disabled={isLoading || !el.href}
                      >
                        <option value="_blank">↗ nova aba</option>
                        <option value="_self">→ mesma aba</option>
                      </select>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* System Variables */}
            <div className="mt-4">
              <p className="text-xs font-medium text-zinc-400 mb-2">Variáveis do sistema <span className="text-zinc-600">(clique para copiar)</span></p>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "Nome do usuário",         value: "{{nome_usuario}}" },
                  { label: "Qtd. de Stars",            value: "{{quantidade_stars}}" },
                  { label: "Nome do plano",            value: "{{nome_plano}}" },
                  { label: "Qtd. de Space Points",     value: "{{quantidade_space_points}}" },
                  { label: "Nova conquista",           value: "{{nova_conquista}}" },
                  { label: "Meu ranking",              value: "{{meu_ranking}}" },
                ].map((v) => (
                  <button
                    key={v.value}
                    type="button"
                    onClick={() => navigator.clipboard.writeText(v.value).catch(() => {})}
                    title={`Copiar ${v.value}`}
                    className="px-2 py-1 bg-zinc-800 hover:bg-violet-600/20 border border-zinc-700 hover:border-violet-500/50 text-zinc-300 hover:text-violet-300 text-xs rounded-lg transition-all font-mono"
                  >
                    {v.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-zinc-600 mt-1.5">Use nas mensagens, ex: <span className="text-zinc-500">Parabéns, {`{{nome_usuario}}`}! Você ganhou {`{{quantidade_stars}}`}⭐</span></p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-zinc-800 sticky bottom-0 bg-zinc-900">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-zinc-800 text-zinc-300 font-medium rounded-lg hover:bg-zinc-700 transition-colors disabled:opacity-50"
            disabled={isLoading}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-violet-600 text-white font-medium rounded-lg hover:bg-violet-500 transition-colors disabled:opacity-50"
            disabled={isLoading}
          >
            {isLoading ? (isCreating ? "Criando..." : "Salvando...") : (isCreating ? "Criar" : "Salvar")}
          </button>
        </div>
      </div>
    </div>
  );
}
