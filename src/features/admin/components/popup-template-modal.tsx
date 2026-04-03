"use client";

import { useState } from "react";
import { X } from "lucide-react";

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
}

interface PopupTemplateModalProps {
  template: PopupTemplate;
  isOpen: boolean;
  isCreating?: boolean;
  onClose: () => void;
  onSave: (template: PopupTemplate) => Promise<void>;
  isLoading?: boolean;
}

export function PopupTemplateModal({
  template: initialTemplate,
  isOpen,
  isCreating = false,
  onClose,
  onSave,
  isLoading = false,
}: PopupTemplateModalProps) {
  const [template, setTemplate] = useState(initialTemplate);

  const handleSave = async () => {
    if (!template.name || !template.title) {
      alert("Por favor, preencha o nome e título do template");
      return;
    }
    await onSave(template);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800">
          <h2 className="text-xl font-bold text-white">{isCreating ? "Novo Template" : "Editar Template"}</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white"
            disabled={isLoading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Nome
            </label>
            <input
              type="text"
              value={template.name}
              onChange={(e) => setTemplate({ ...template, name: e.target.value })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-violet-500/60"
              disabled={isLoading}
            />
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Título
            </label>
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
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Mensagem
            </label>
            <textarea
              value={template.message}
              onChange={(e) => setTemplate({ ...template, message: e.target.value })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-violet-500/60 resize-none h-20"
              disabled={isLoading}
            />
          </div>

          {/* Colors */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Cor Primária
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={template.primaryColor}
                  onChange={(e) => setTemplate({ ...template, primaryColor: e.target.value })}
                  className="w-12 h-10 rounded-lg cursor-pointer border border-zinc-700"
                  disabled={isLoading}
                />
                <input
                  type="text"
                  value={template.primaryColor}
                  onChange={(e) => setTemplate({ ...template, primaryColor: e.target.value })}
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500/60"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Cor Acento
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={template.accentColor}
                  onChange={(e) => setTemplate({ ...template, accentColor: e.target.value })}
                  className="w-12 h-10 rounded-lg cursor-pointer border border-zinc-700"
                  disabled={isLoading}
                />
                <input
                  type="text"
                  value={template.accentColor}
                  onChange={(e) => setTemplate({ ...template, accentColor: e.target.value })}
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500/60"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Cor Fundo
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={template.backgroundColor}
                  onChange={(e) => setTemplate({ ...template, backgroundColor: e.target.value })}
                  className="w-12 h-10 rounded-lg cursor-pointer border border-zinc-700"
                  disabled={isLoading}
                />
                <input
                  type="text"
                  value={template.backgroundColor}
                  onChange={(e) => setTemplate({ ...template, backgroundColor: e.target.value })}
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500/60"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Cor Texto
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={template.textColor}
                  onChange={(e) => setTemplate({ ...template, textColor: e.target.value })}
                  className="w-12 h-10 rounded-lg cursor-pointer border border-zinc-700"
                  disabled={isLoading}
                />
                <input
                  type="text"
                  value={template.textColor}
                  onChange={(e) => setTemplate({ ...template, textColor: e.target.value })}
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500/60"
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Duração (ms)
            </label>
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
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Prévia
            </label>
            <div
              className="rounded-lg p-4 text-center text-sm"
              style={{
                backgroundColor: template.backgroundColor,
                borderColor: template.primaryColor,
                borderWidth: "1px",
              }}
            >
              <p style={{ color: template.accentColor }} className="text-xs font-semibold mb-1 uppercase">
                {template.type}
              </p>
              <p style={{ color: template.textColor }} className="font-bold mb-2">
                {template.title}
              </p>
              <p style={{ color: template.textColor }} className="text-xs opacity-90">
                {template.message}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-zinc-800">
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
