"use client";

import { PAGE_TEMPLATES, type PageTemplate } from "../lib/page-templates";

interface Props {
  onSelect: (template: PageTemplate) => void;
  onStartBlank?: () => void;
}

/**
 * Galeria de templates — usada no wizard de criação de page.
 * Mostra cada template como card preview (thumbnail + nome + descrição
 * + tag de categoria). Click → aplica template no novo page.
 *
 * Botão "Começar do zero" mantém escape pra users que querem montar
 * tudo manualmente (comportamento atual).
 */
export function TemplateGallery({ onSelect, onStartBlank }: Props) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h3 className="text-2xl font-bold">Escolha um modelo pra começar</h3>
        <p className="text-sm text-muted-foreground">
          Modelos prontos que você edita só o que importa: textos, cores e CTAs.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {PAGE_TEMPLATES.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            onSelect={() => onSelect(template)}
          />
        ))}

        {onStartBlank && (
          <button
            onClick={onStartBlank}
            className="group relative rounded-2xl border-2 border-dashed border-muted-foreground/30 p-6 hover:border-violet-500/60 hover:bg-violet-500/5 transition-all min-h-[260px] flex flex-col items-center justify-center gap-2"
          >
            <div className="size-12 rounded-full bg-violet-500/15 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
              ✨
            </div>
            <span className="font-bold text-sm">Começar do zero</span>
            <span className="text-xs text-muted-foreground text-center">
              Página em branco
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

function TemplateCard({
  template,
  onSelect,
}: {
  template: PageTemplate;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className="group relative overflow-hidden rounded-2xl border border-border bg-card text-left hover:border-violet-500/60 hover:shadow-lg hover:shadow-violet-500/15 transition-all min-h-[260px] flex flex-col"
    >
      {/* Thumbnail (placeholder com cor do template) */}
      <div
        className="h-32 relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${template.tokens.primary}40 0%, ${template.tokens.accent}20 100%)`,
        }}
      >
        <div className="absolute inset-0 flex items-center justify-center text-4xl opacity-70">
          {template.category === "Sales" && "💼"}
          {template.category === "Eventos" && "🎉"}
          {template.category === "Pessoal" && "👤"}
          {template.category === "Comunidade" && "👥"}
        </div>
        {/* Categoria badge */}
        <span
          className="absolute top-2 left-2 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full"
          style={{
            background: template.tokens.bg,
            color: template.tokens.primary,
            border: `1px solid ${template.tokens.primary}40`,
          }}
        >
          {template.category}
        </span>
        {/* Counts dos blocos */}
        <span className="absolute top-2 right-2 text-[10px] font-mono text-white/90 bg-black/40 backdrop-blur-sm px-2 py-1 rounded-full">
          {template.elements.length} blocos
        </span>
      </div>

      {/* Info */}
      <div className="p-4 flex-1 flex flex-col gap-1">
        <h4 className="font-bold text-base">{template.name}</h4>
        <p className="text-xs text-muted-foreground leading-snug flex-1">
          {template.description}
        </p>
        <span className="mt-2 text-xs font-semibold text-violet-400 group-hover:text-violet-300">
          Usar este modelo →
        </span>
      </div>
    </button>
  );
}
