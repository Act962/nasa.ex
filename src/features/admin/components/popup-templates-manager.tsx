"use client";

import { useState } from "react";
import { useAdminToast } from "@/features/admin/hooks/use-admin-toast";
import { usePopupTemplates } from "@/features/admin/hooks/use-popup-templates";
import { Trash2, Edit2, Plus } from "lucide-react";
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

function resolvePatternUrl(customJson: Record<string, unknown> | undefined): string | null {
  if (!customJson) return null;
  const svgPattern = customJson.svgPattern as string | undefined;
  if (!svgPattern) return null;

  const overrides = customJson.patternUrlOverrides as Record<string, string> | undefined;
  if (overrides?.[svgPattern]) return overrides[svgPattern];

  const customs = customJson.customPatterns as { id: string; url: string }[] | undefined;
  const custom = customs?.find((p) => p.id === svgPattern);
  if (custom) return custom.url;

  return DEFAULT_SVG_PATTERNS[svgPattern] ?? null;
}

interface LayoutElement {
  id: string;
  type: "name" | "title" | "message" | "hide" | "link";
  x: number;
  y: number;
  visible: boolean;
  fontSize?: number;
  color?: string;
}

function TemplatePreview({ template }: { template: PopupTemplate }) {
  const cj = template.customJson as Record<string, unknown> | undefined;
  const patternUrl = resolvePatternUrl(cj);
  const mascotUrl = cj?.mascotUrl as string | undefined;
  const layoutElements = (cj?.layoutElements as LayoutElement[] | undefined) ?? [];
  const prizeValue = cj?.prizeValue as string | undefined;

  const elementText = (el: LayoutElement): string => {
    if (el.type === "name") return template.name;
    if (el.type === "title") return template.title;
    if (el.type === "message") return template.message;
    if (el.type === "hide") return "Fechar";
    if (el.type === "link") return "Ver mais";
    return "";
  };

  if (patternUrl || layoutElements.length > 0) {
    return (
      <div
        className="relative w-full rounded-lg overflow-hidden bg-zinc-800"
        style={{ aspectRatio: "768/391", containerType: "inline-size" }}
      >
        {patternUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={patternUrl} alt="padrão" className="absolute inset-0 w-full h-full object-cover" />
        )}
        {mascotUrl && (
          <div className="absolute left-0 top-0 w-[30%] h-full flex items-end justify-center pb-2 pointer-events-none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mascotUrl} alt="mascote" className="h-[85%] w-auto object-contain" />
          </div>
        )}
        {layoutElements.filter((el) => el.visible).map((el) => (
          <div
            key={el.id}
            className="absolute pointer-events-none select-none"
            style={{
              left: `${el.x}%`,
              top: `${el.y}%`,
              transform: "translate(-50%, -50%)",
              fontSize: `${((el.fontSize ?? 12) / 768) * 100}cqw`,
              color: el.color ?? template.textColor,
              fontFamily: "var(--font-bungee), sans-serif",
              textShadow: "0 1px 3px rgba(0,0,0,0.7)",
              whiteSpace: "nowrap",
            }}
          >
            {elementText(el)}
          </div>
        ))}
        {prizeValue && (
          <div
            className="absolute bottom-[8%] left-1/2 pointer-events-none select-none"
            style={{
              transform: "translateX(-50%)",
              fontFamily: "var(--font-bungee), sans-serif",
              fontSize: `${(24 / 768) * 100}cqw`,
              color: template.accentColor,
              textShadow: "0 2px 6px rgba(0,0,0,0.7)",
              whiteSpace: "nowrap",
            }}
          >
            {prizeValue}
          </div>
        )}
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
      <p style={{ color: template.accentColor }} className="text-xs font-semibold mb-1 uppercase">
        {typeLabels[template.type]}
      </p>
      <p style={{ color: template.textColor, fontFamily: "var(--font-bungee), sans-serif" }} className="font-bold mb-2">
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

export function PopupTemplatesManager({ templates: initialTemplates }: PopupTemplatesManagerProps) {
  const toast = useAdminToast();
  const { templates, isLoading, updateTemplate, deleteTemplate, createTemplate } = usePopupTemplates(initialTemplates);
  const [selectedType, setSelectedType] = useState<"all" | "achievement" | "stars_reward" | "level_up">("all");
  const [editingTemplate, setEditingTemplate] = useState<PopupTemplate | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const confirm = useConfirm();

  const filteredTemplates =
    selectedType === "all" ? templates : templates.filter((t) => t.type === selectedType);

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
        <h2 className="text-lg font-bold text-white">Templates de Popups para Conquistas e STARs</h2>
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
          ✨ Customize os popups que aparecem quando usuários conquistam achievements, recebem STARs ou sobem de nível.
          Edite cores, textos, animações e duração de exibição.
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
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
            {type === "all" ? "Todos" : typeLabels[type as keyof typeof typeLabels]}
          </button>
        ))}
      </div>

      {/* Templates Grid */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {filteredTemplates.map((template) => (
          <div
            key={template.id || template.name}
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-4 hover:border-zinc-700 transition-colors animate-slide-down"
          >
            {/* Card Preview */}
            <TemplatePreview template={template} />

            {/* Info */}
            <div className="text-xs text-zinc-400 space-y-1">
              <p>
                <span className="text-zinc-500">Cor primária:</span>{" "}
                <span
                  className="inline-block w-3 h-3 rounded-full"
                  style={{ backgroundColor: template.primaryColor }}
                />
                {" "}
                {template.primaryColor}
              </p>
              <p>
                <span className="text-zinc-500">Duração:</span> {template.dismissDuration / 1000}s
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
        ))}
      </div>

      {/* Empty State */}
      {filteredTemplates.length === 0 && (
        <div className="text-center py-12">
          <p className="text-zinc-400 mb-4">Nenhum template encontrado nesta categoria</p>
        </div>
      )}

      {/* Features Note */}
      <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 text-sm text-zinc-300">
        <p className="font-semibold text-white mb-2">📝 Recursos disponíveis:</p>
        <ul className="space-y-1 text-xs">
          <li>✓ Personalização de cores (primária, acento, fundo, texto)</li>
          <li>✓ Edição de título e mensagem</li>
          <li>✓ Controle de animações (confete, som)</li>
          <li>✓ Ajuste de duração de exibição</li>
          <li>✓ Criação de templates customizados</li>
          <li>✓ 7 templates pré-configurados (Lua, Marte, Vénus, Júpiter, Stars, Especial, Level Up)</li>
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
            setIsCreating(false);
          }}
          onSave={handleSave}
          isLoading={isLoading}
        />
      )}

      {/* Confirm Dialog */}
      {confirm.isOpen && confirm.options && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-sm">
            <h3 className="text-lg font-bold text-white mb-2">{confirm.options.title}</h3>
            <p className="text-sm text-zinc-300 mb-6">{confirm.options.description}</p>
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
