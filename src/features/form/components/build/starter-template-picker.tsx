"use client";

import { PlusIcon } from "lucide-react";
import { useBuilderStore } from "@/features/form/context/builder-form-provider";
import { STARTER_FORM_TEMPLATES } from "@/features/form/lib/starter-templates";

/** Aplica um modelo pronto ao formulário aberto no construtor (blocos + cores), com volta no "Desfazer". */
export function useApplyStarterTemplate() {
  const { setBlockLayouts, updateSettings, pushHistorySnapshot } = useBuilderStore();
  return (templateId: string) => {
    const template = STARTER_FORM_TEMPLATES.find((starterTemplate) => starterTemplate.id === templateId);
    if (!template) return false;
    pushHistorySnapshot();
    setBlockLayouts(template.buildBlocks());
    updateSettings({ primaryColor: template.primaryColor, backgroundColor: template.backgroundColor });
    return true;
  };
}

/** Formulário vazio: modelos prontos para começar (ou em branco, arrastando/adicionando blocos). */
export function StarterTemplatePicker({ onStartBlank }: { onStartBlank?: () => void }) {
  const applyTemplate = useApplyStarterTemplate();

  return (
    <div className="w-full min-w-0 space-y-3 py-2">
      <div className="px-1">
        <h2 className="text-lg font-semibold">Comece por um modelo</h2>
        <p className="text-sm text-muted-foreground">Tudo pronto para editar — troque textos, campos e cores depois.</p>
      </div>
      <div className="grid w-full min-w-0 grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={onStartBlank}
          className="flex min-w-0 flex-col items-start gap-2 rounded-[20px] bg-card p-3 text-left text-muted-foreground shadow-sm ring-1 ring-line transition-colors hover:bg-panel"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-card ring-1 ring-line">
            <PlusIcon className="size-5" />
          </span>
          <span className="w-full min-w-0">
            <span className="block text-sm font-semibold text-foreground">Em branco</span>
            <span className="line-clamp-2 text-xs">Montar do zero, bloco a bloco</span>
          </span>
        </button>
        {STARTER_FORM_TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => applyTemplate(template.id)}
            className="flex min-w-0 flex-col items-start gap-2 rounded-[20px] bg-card p-3 text-left shadow-sm ring-1 ring-line transition-colors hover:bg-panel"
          >
            <span
              className="grid size-11 shrink-0 place-items-center rounded-[14px] text-xl"
              style={{ backgroundColor: `${template.primaryColor}1a` }}
              aria-hidden
            >
              {template.emoji}
            </span>
            <span className="w-full min-w-0">
              <span className="block truncate text-sm font-semibold">{template.name}</span>
              <span className="line-clamp-2 text-xs text-muted-foreground">{template.description}</span>
            </span>
            <span className="mt-auto text-xs font-semibold text-info">Usar</span>
          </button>
        ))}
      </div>
    </div>
  );
}
