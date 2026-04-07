"use client";

import { useState, useEffect, useRef } from "react";
import { useAdminToast } from "@/features/admin/hooks/use-admin-toast";
import { usePopupTemplates } from "@/features/admin/hooks/use-popup-templates";
import { Trash2, Edit2, Plus, Eye, X, Upload, ImageIcon } from "lucide-react";
import { createPortal } from "react-dom";
import { PopupTemplateModal } from "./popup-template-modal";
import { useConfirm } from "@/features/admin/hooks/use-confirm";
import "@/features/admin/styles/animations.css";

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
  isActive?: boolean;
}

interface PopupTemplatesManagerProps {
  templates: PopupTemplate[];
}

const typeLabels = {
  achievement: "Conquista",
  stars_reward: "Recompensa Stars",
  level_up: "Novo Nível",
};

const DEFAULT_SVG_PATTERNS: Record<string, string> = {
  padrao: "/popup-patterns/padrao.svg",
};

function resolvePatternUrl(
  customJson: Record<string, unknown> | undefined,
  globalPatterns: { id: string; url: string }[] = [],
): string | null {
  if (!customJson) return null;
  const svgPattern = customJson.svgPattern as string | undefined;
  if (!svgPattern) return null;

  const overrides = customJson.patternUrlOverrides as
    | Record<string, string>
    | undefined;
  if (overrides?.[svgPattern]) return overrides[svgPattern];

  const customs = customJson.customPatterns as
    | { id: string; url: string }[]
    | undefined;
  const custom = customs?.find((p) => p.id === svgPattern);
  if (custom) return custom.url;

  const global = globalPatterns.find((p) => p.id === svgPattern);
  if (global) return global.url;

  return DEFAULT_SVG_PATTERNS[svgPattern] ?? null;
}

interface LayoutElement {
  id: string;
  type: "name" | "title" | "message" | "hide" | "link" | "image";
  label?: string;
  x: number;
  y: number;
  visible: boolean;
  fontSize?: number;
  color?: string;
  imageUrl?: string;
  imageSize?: number;
  boxWidth?: number;
  boxHeight?: number;
  href?: string;
  hrefTarget?: string;
  isHide?: boolean;
}

function useColorizedSvg(
  patternUrl: string | null,
  primary: string,
  bg: string,
  accent: string,
  text: string,
) {
  const [colorizedUrl, setColorizedUrl] = useState<string | null>(null);
  const cacheRef = useRef<Record<string, string>>({});
  const blobRef = useRef<string | null>(null);

  useEffect(() => {
    if (!patternUrl) {
      setColorizedUrl(null);
      return;
    }
    let cancelled = false;
    const run = async () => {
      try {
        if (!cacheRef.current[patternUrl]) {
          const res = await fetch(patternUrl);
          cacheRef.current[patternUrl] = await res.text();
        }
        if (cancelled) return;
        let svg = cacheRef.current[patternUrl];
        svg = svg
          .replace(/#7a1fe7/gi, primary)
          .replace(/#29125b/gi, primary + "88")
          .replace(/#1a0a3d/gi, bg)
          .replace(/#ff00ff/gi, accent)
          .replace(/#fff2e6/gi, text);
        if (blobRef.current) URL.revokeObjectURL(blobRef.current);
        const blob = new Blob([svg], { type: "image/svg+xml" });
        blobRef.current = URL.createObjectURL(blob);
        setColorizedUrl(blobRef.current);
      } catch {
        setColorizedUrl(patternUrl);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [patternUrl, primary, bg, accent, text]);

  return colorizedUrl;
}

function TemplatePreview({
  template,
  globalPatterns = [],
  interactive = false,
  onClose,
}: {
  template: PopupTemplate;
  globalPatterns?: { id: string; label: string; url: string }[];
  interactive?: boolean;
  onClose?: () => void;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setScale(entry.contentRect.width / 768);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const cj = template.customJson as Record<string, unknown> | undefined;
  const rawPatternUrl = resolvePatternUrl(cj, globalPatterns);
  const patternUrl = useColorizedSvg(
    rawPatternUrl,
    template.primaryColor,
    template.backgroundColor,
    template.accentColor,
    template.textColor,
  );
  const mascotUrl = cj?.mascotUrl as string | undefined;
  const mascotX = (cj?.mascotX as number | undefined) ?? 15;
  const mascotY = (cj?.mascotY as number | undefined) ?? 80;
  const mascotSize = (cj?.mascotSize as number | undefined) ?? 28;
  const layoutElements =
    (cj?.layoutElements as LayoutElement[] | undefined) ?? [];
  const prizeValue = cj?.prizeValue as string | undefined;
  const clickUrl = cj?.clickUrl as string | undefined;
  const clickUrlTarget = (cj?.clickUrlTarget as string | undefined) ?? "_blank";

  const PREVIEW_VARS: Record<string, string> = {
    nome_usuario: "Astronauta",
    quantidade_stars: "250",
    nome_plano: "NASA Pro",
    quantidade_space_points: "1.200",
    nova_conquista: template.name || "Nova conquista",
    meu_ranking: "12º",
  };

  const interpolate = (text: string) =>
    text.replace(
      /\{\{(\w+)\}\}/g,
      (_, key) => PREVIEW_VARS[key] ?? `{{${key}}}`,
    );

  const elementText = (el: LayoutElement): string => {
    if (el.type === "name") return interpolate(template.name);
    if (el.type === "title") return interpolate(template.title);
    if (el.type === "message") return interpolate(template.message);
    return "";
  };

  const handleElClick = (el: LayoutElement) => (e: React.MouseEvent) => {
    if (!interactive) return;
    e.stopPropagation();
    if (el.type === "hide" || el.isHide) {
      onClose?.();
      return;
    }
    if (el.href) {
      window.open(el.href, el.hrefTarget ?? "_blank", "noopener,noreferrer");
      return;
    }
    if (el.type === "link") {
      onClose?.();
    }
  };

  const handleBgClick = () => {
    if (!interactive) return;
    if (clickUrl) window.open(clickUrl, clickUrlTarget, "noopener,noreferrer");
    else onClose?.();
  };

  if (rawPatternUrl || layoutElements.length > 0) {
    return (
      <div
        ref={wrapperRef}
        className={`relative w-full rounded-lg overflow-hidden ${interactive ? "cursor-pointer" : ""}`}
        style={{ aspectRatio: "768/391" }}
        onClick={interactive ? handleBgClick : undefined}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "768px",
            height: "391px",
            transformOrigin: "top left",
            transform: `scale(${scale})`,
          }}
        >
          {patternUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={patternUrl}
              alt="padrão"
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          {mascotUrl && (
            <div
              className="absolute pointer-events-none"
              style={{
                left: `${mascotX}%`,
                top: `${mascotY}%`,
                width: `${(mascotSize / 100) * 768}px`,
                transform: "translate(-50%, -50%)",
                filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.5))",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mascotUrl}
                alt="mascote"
                className="w-full h-auto object-contain"
              />
            </div>
          )}
          {layoutElements
            .filter((el) => el.visible)
            .map((el) => {
              if (el.type === "image" && el.imageUrl) {
                return (
                  <div
                    key={el.id}
                    className="absolute pointer-events-none select-none"
                    style={{
                      left: `${el.x}%`,
                      top: `${el.y}%`,
                      width: `${((el.imageSize ?? 20) / 100) * 768}px`,
                      transform: "translate(-50%, -50%)",
                      filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={el.imageUrl}
                      alt={el.label ?? ""}
                      className="w-full h-auto object-contain"
                    />
                  </div>
                );
              }
              if (el.type === "hide") {
                const sz = (el.fontSize ?? 22) * 2.6;
                return (
                  <div
                    key={el.id}
                    className={`absolute select-none ${interactive ? "pointer-events-auto cursor-pointer hover:opacity-80 active:scale-95 transition-all" : "pointer-events-none"}`}
                    style={{
                      left: `${el.x}%`,
                      top: `${el.y}%`,
                      transform: "translate(-50%, -50%)",
                      width: `${sz}px`,
                      height: `${sz}px`,
                      borderRadius: "50%",
                      background: `${template.accentColor}33`,
                      border: `2px solid ${el.color ?? template.accentColor}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: el.color ?? "#ffffff",
                      fontSize: `${el.fontSize ?? 22}px`,
                      boxSizing: "border-box",
                    }}
                    onClick={interactive ? handleElClick(el) : undefined}
                  >
                    ✕
                  </div>
                );
              }
              if (el.type === "link") {
                return (
                  <div
                    key={el.id}
                    className={`absolute select-none ${interactive ? "pointer-events-auto cursor-pointer hover:opacity-80 active:scale-95 transition-all" : "pointer-events-none"}`}
                    style={{
                      left: `${el.x}%`,
                      top: `${el.y}%`,
                      transform: "translate(-50%, -50%)",
                      fontSize: `${el.fontSize ?? 12}px`,
                      color: el.color ?? template.textColor,
                      fontFamily: "var(--font-bungee), sans-serif",
                      background: "rgba(139,92,246,0.2)",
                      border: "1.5px solid rgba(139,92,246,0.6)",
                      borderRadius: "6px",
                      padding: "3px 12px",
                      whiteSpace: "nowrap",
                      boxSizing: "border-box",
                    }}
                    onClick={interactive ? handleElClick(el) : undefined}
                  >
                    ↗ {el.href ? "Ver mais" : "Ver mais"}
                  </div>
                );
              }
              const w = el.boxWidth ? (el.boxWidth / 100) * 768 : undefined;
              const h = el.boxHeight ? (el.boxHeight / 100) * 391 : undefined;
              return (
                <div
                  key={el.id}
                  className="absolute pointer-events-none select-none"
                  style={{
                    left: `${el.x}%`,
                    top: `${el.y}%`,
                    transform: "translate(-50%, -50%)",
                    width: w ? `${w}px` : undefined,
                    minHeight: h ? `${h}px` : undefined,
                    fontSize: `${el.fontSize ?? 12}px`,
                    color: el.color ?? template.textColor,
                    fontFamily: "var(--font-bungee), sans-serif",
                    textShadow: "0 1px 3px rgba(0,0,0,0.7)",
                    whiteSpace: w ? "normal" : "nowrap",
                    wordBreak: "break-word",
                    overflow: "hidden",
                    lineHeight: 1.2,
                    padding: "2px 6px",
                    boxSizing: "border-box",
                  }}
                >
                  {elementText(el)}
                </div>
              );
            })}
          {prizeValue && (
            <div
              className="absolute bottom-[8%] left-1/2 pointer-events-none select-none"
              style={{
                transform: "translateX(-50%)",
                fontFamily: "var(--font-bungee), sans-serif",
                fontSize: "24px",
                color: template.accentColor,
                textShadow: "0 2px 6px rgba(0,0,0,0.7)",
                whiteSpace: "nowrap",
              }}
            >
              {prizeValue}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg p-4 text-center text-sm"
      style={{
        backgroundColor: template.backgroundColor,
        borderColor: template.primaryColor,
        borderWidth: "2px",
      }}
    >
      <p
        style={{ color: template.accentColor }}
        className="text-xs font-semibold mb-1 uppercase"
      >
        {typeLabels[template.type]}
      </p>
      <p
        style={{
          color: template.textColor,
          fontFamily: "var(--font-bungee), sans-serif",
        }}
        className="font-bold mb-2"
      >
        {template.title}
      </p>
      <p style={{ color: template.textColor }} className="text-xs opacity-90">
        {template.message}
      </p>
    </div>
  );
}

const emptyTemplate: PopupTemplate = {
  name: "",
  type: "achievement",
  title: "",
  message: "",
  primaryColor: "#7a1fe7",
  accentColor: "#a855f7",
  backgroundColor: "#1a0a3d",
  textColor: "#ffffff",
  enableConfetti: true,
  enableSound: true,
  dismissDuration: 5000,
};

export function PopupTemplatesManager({
  templates: initialTemplates,
}: PopupTemplatesManagerProps) {
  const toast = useAdminToast();
  const {
    templates,
    isLoading,
    updateTemplate,
    deleteTemplate,
    createTemplate,
  } = usePopupTemplates(initialTemplates);
  const [selectedType, setSelectedType] = useState<
    "all" | "achievement" | "stars_reward" | "level_up"
  >("all");
  const [editingTemplate, setEditingTemplate] = useState<PopupTemplate | null>(
    null,
  );
  const [liveTemplate, setLiveTemplate] = useState<PopupTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<PopupTemplate | null>(
    null,
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showBanners, setShowBanners] = useState(false);
  const [globalPatterns, setGlobalPatterns] = useState<
    { id: string; label: string; url: string }[]
  >([]);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  useEffect(() => {
    fetch("/api/admin/banner-patterns")
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setGlobalPatterns(d))
      .catch(() => {});
  }, []);

  const handleBannerUpload = async (file: File) => {
    setUploadingBanner(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "popup-patterns");
      const res = await fetch("/api/upload-local", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro no upload");
      const url = `${window.location.origin}${data.url}`;
      const id = `global-${Date.now()}`;
      const label = file.name.replace(/\.[^.]+$/, "");
      const saveRes = await fetch("/api/admin/banner-patterns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, label, url }),
      });
      const updated = await saveRes.json();
      if (Array.isArray(updated)) setGlobalPatterns(updated);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setUploadingBanner(false);
    }
  };

  const handleBannerDelete = async (id: string) => {
    const res = await fetch("/api/admin/banner-patterns", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const updated = await res.json();
    if (Array.isArray(updated)) setGlobalPatterns(updated);
  };
  const confirm = useConfirm();

  const filteredTemplates =
    selectedType === "all"
      ? templates
      : templates.filter((t) => t.type === selectedType);

  const handleNewTemplateClick = () => {
    setEditingTemplate(emptyTemplate);
    setIsCreating(true);
    setIsModalOpen(true);
  };

  const handleEditClick = (template: PopupTemplate) => {
    setEditingTemplate(template);
    setIsCreating(false);
    setIsModalOpen(true);
  };

  const handleSave = async (template: PopupTemplate) => {
    if (isCreating) {
      await createTemplate(template);
    } else {
      if (!template.id) return;
      await updateTemplate(template.id, template);
    }
  };

  const handleDeleteClick = async (template: PopupTemplate) => {
    const confirmed = await confirm.confirm({
      title: "Deletar Template",
      description: `Tem certeza que deseja deletar o template "${template.name}"? Esta ação não pode ser desfeita.`,
      confirmText: "Deletar",
      cancelText: "Cancelar",
      isDangerous: true,
    });

    if (confirmed && template.id) {
      await deleteTemplate(template.id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">
          Templates de Popups para Conquistas e STARs
        </h2>
        <button
          onClick={handleNewTemplateClick}
          disabled={isLoading}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          Novo Template
        </button>
      </div>

      {/* Info Box */}
      <div className="bg-blue-600/10 border border-blue-600/30 rounded-lg p-4">
        <p className="text-sm text-blue-300">
          ✨ Customize os popups que aparecem quando usuários conquistam
          achievements, recebem STARs ou sobem de nível. Edite cores, textos,
          animações e duração de exibição.
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        {["all", "achievement", "stars_reward", "level_up"].map((type) => (
          <button
            key={type}
            onClick={() => setSelectedType(type as any)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              selectedType === type
                ? "bg-violet-600 text-white"
                : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            }`}
          >
            {type === "all"
              ? "Todos"
              : typeLabels[type as keyof typeof typeLabels]}
          </button>
        ))}
        <button
          onClick={() => setShowBanners((v) => !v)}
          className={`ml-auto flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            showBanners
              ? "bg-violet-600 text-white"
              : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          Padrões de Banner
          {globalPatterns.length > 0 && (
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${showBanners ? "bg-white/20" : "bg-zinc-700 text-zinc-400"}`}
            >
              {globalPatterns.length}
            </span>
          )}
        </button>
      </div>

      {/* Banner Patterns Panel */}
      {showBanners && (
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">
              Padrões de Banner globais
            </h3>
            <label
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-all ${uploadingBanner ? "opacity-50 pointer-events-none" : "bg-violet-600 hover:bg-violet-500 text-white"}`}
            >
              <Upload className="w-3 h-3" />
              {uploadingBanner ? "Enviando..." : "Novo padrão"}
              <input
                type="file"
                accept="image/svg+xml,image/png,image/jpeg,image/webp"
                className="hidden"
                disabled={uploadingBanner}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleBannerUpload(f);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          {globalPatterns.length === 0 ? (
            <p className="text-xs text-zinc-500 text-center py-4">
              Nenhum padrão cadastrado. Faça upload acima.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {globalPatterns.map((p) => (
                <div
                  key={p.id}
                  className="relative group rounded-xl overflow-hidden border border-zinc-700 hover:border-violet-500/50 transition-all"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.url}
                    alt={p.label}
                    className="w-full aspect-[768/391] object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <button
                      onClick={() => handleBannerDelete(p.id)}
                      className="p-1.5 bg-red-600/90 rounded-lg text-white hover:bg-red-500 transition-colors"
                      title="Remover"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-[10px] text-zinc-400 px-2 py-1 truncate bg-zinc-900/80">
                    {p.label}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Templates Grid */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {filteredTemplates.map((template) => {
          const isEditing = isModalOpen && editingTemplate?.id === template.id;
          const displayTemplate =
            isEditing && liveTemplate ? liveTemplate : template;
          return (
            <div
              key={template.id || template.name}
              className={`bg-zinc-900 border rounded-xl p-4 space-y-4 transition-colors animate-slide-down ${
                isEditing
                  ? "border-violet-500/60 ring-1 ring-violet-500/30"
                  : "border-zinc-800 hover:border-zinc-700"
              }`}
            >
              {/* Card Preview */}
              <TemplatePreview
                template={displayTemplate}
                globalPatterns={globalPatterns}
              />

              {/* Info */}
              <div className="text-xs text-zinc-400 space-y-1">
                <p>
                  <span className="text-zinc-500">Cor primária:</span>{" "}
                  <span
                    className="inline-block w-3 h-3 rounded-full transition-colors"
                    style={{ backgroundColor: displayTemplate.primaryColor }}
                  />{" "}
                  {displayTemplate.primaryColor}
                </p>
                <p>
                  <span className="text-zinc-500">Duração:</span>{" "}
                  {template.dismissDuration / 1000}s
                </p>
                <p className="flex items-center gap-2">
                  <span className="text-zinc-500">Confete:</span>
                  {template.enableConfetti ? "✓" : "✗"}
                  <span className="text-zinc-500 ml-2">Som:</span>
                  {template.enableSound ? "✓" : "✗"}
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t border-zinc-800">
                <button
                  onClick={() => setPreviewTemplate(displayTemplate)}
                  className="flex items-center justify-center gap-1 bg-zinc-700/50 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
                >
                  <Eye className="w-3 h-3" />
                  Prévia
                </button>
                <button
                  onClick={() => handleEditClick(template)}
                  disabled={isLoading}
                  className="flex-1 flex items-center justify-center gap-2 bg-violet-600/20 hover:bg-violet-600/30 text-violet-400 text-xs font-semibold py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Edit2 className="w-3 h-3" />
                  Editar
                </button>
                <button
                  onClick={() => handleDeleteClick(template)}
                  disabled={isLoading}
                  className="flex-1 flex items-center justify-center gap-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-xs font-semibold py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-3 h-3" />
                  Deletar
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredTemplates.length === 0 && (
        <div className="text-center py-12">
          <p className="text-zinc-400 mb-4">
            Nenhum template encontrado nesta categoria
          </p>
        </div>
      )}

      {/* Features Note */}
      <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 text-sm text-zinc-300">
        <p className="font-semibold text-white mb-2">
          📝 Recursos disponíveis:
        </p>
        <ul className="space-y-1 text-xs">
          <li>✓ Personalização de cores (primária, acento, fundo, texto)</li>
          <li>✓ Edição de título e mensagem</li>
          <li>✓ Controle de animações (confete, som)</li>
          <li>✓ Ajuste de duração de exibição</li>
          <li>✓ Criação de templates customizados</li>
          <li>
            ✓ 7 templates pré-configurados (Lua, Marte, Vénus, Júpiter, Stars,
            Especial, Level Up)
          </li>
        </ul>
      </div>

      {/* Modal */}
      {editingTemplate && (
        <PopupTemplateModal
          template={editingTemplate}
          isOpen={isModalOpen}
          isCreating={isCreating}
          onClose={() => {
            setIsModalOpen(false);
            setEditingTemplate(null);
            setLiveTemplate(null);
            setIsCreating(false);
          }}
          onSave={handleSave}
          onLiveChange={(t) => setLiveTemplate(t as PopupTemplate)}
          globalPatterns={globalPatterns}
          isLoading={isLoading}
        />
      )}

      {/* Screen Preview */}
      {previewTemplate &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-9999 flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={() => setPreviewTemplate(null)}
          >
            <div
              className="relative"
              style={{ width: "40vw" }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setPreviewTemplate(null)}
                className="absolute -top-8 right-0 flex items-center gap-1.5 text-zinc-400 hover:text-white text-xs transition-colors"
              >
                <X className="w-4 h-4" />
                Fechar prévia
              </button>
              <TemplatePreview
                template={previewTemplate}
                globalPatterns={globalPatterns}
                interactive
                onClose={() => setPreviewTemplate(null)}
              />
              <p className="text-center text-zinc-500 text-xs mt-2">
                {previewTemplate.name}
              </p>
              {!!(
                previewTemplate.customJson as
                  | Record<string, unknown>
                  | undefined
              )?.clickUrl && (
                <p className="text-center text-zinc-600 text-[10px] mt-1">
                  🔗 Clique em qualquer área para abrir o link do popup
                </p>
              )}
            </div>
          </div>,
          document.body,
        )}

      {/* Confirm Dialog */}
      {confirm.isOpen && confirm.options && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-sm">
            <h3 className="text-lg font-bold text-white mb-2">
              {confirm.options.title}
            </h3>
            <p className="text-sm text-zinc-300 mb-6">
              {confirm.options.description}
            </p>
            <div className="flex gap-3">
              <button
                onClick={confirm.onCancel}
                className="flex-1 px-4 py-2 bg-zinc-800 text-zinc-300 font-medium rounded-lg hover:bg-zinc-700 transition-colors"
              >
                {confirm.options.cancelText ?? "Cancelar"}
              </button>
              <button
                onClick={confirm.onConfirm}
                className={`flex-1 px-4 py-2 font-medium rounded-lg transition-colors ${
                  confirm.options.isDangerous
                    ? "bg-red-600 text-white hover:bg-red-500"
                    : "bg-violet-600 text-white hover:bg-violet-500"
                }`}
              >
                {confirm.options.confirmText ?? "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
