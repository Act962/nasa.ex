"use client";

import { useState } from "react";
import {
  Type, Image as ImageIcon, Square, Minus, MousePointerClick,
  Video as VideoIcon, Share2, Link as LinkIcon, Code2,
  Star as StarIcon, Shapes, SquareStack, LayoutTemplate,
  Settings2, LayoutGrid, DollarSign, Megaphone, BarChart3,
  Quote, HelpCircle, Building2, MoveHorizontal, Layers,
  Rows3, Hash, Database, Layers3, Files, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import {
  usePagesBuilderStore,
  getActiveLayerElements,
} from "../../context/pages-builder-store";
import { createElement } from "../../lib/element-factory";
import { computeInsertPosition } from "../../lib/insert-position";
import { isFlowSection } from "../../lib/section-flow";
import type { ElementType, ElementBase } from "../../types";
import { LayersPanel } from "./layers-panel";
import { PagesPanel } from "./pages-panel";
import { BlocksPanel } from "./blocks-panel";
import { UrlSlugEditor } from "./url-slug-editor";

/**
 * Elementos "singleton" — só podem existir 1 instância por page:
 * - chat-button   → flutuante fixo no canto, 2 ficaria sobreposto
 * - exit-intent   → modal de saída, 2 disparariam simultâneo
 * - section-navbar → cabeçalho único da landing
 * - section-footer → rodapé único da landing
 *
 * Toast user-friendly explica em vez de só rejeitar silenciosamente.
 */
const SINGLETON_TYPES = new Set<ElementType>([
  "chat-button",
  "exit-intent",
  "section-navbar",
  "section-footer",
  "marketing",
]);

const SINGLETON_LABELS: Record<string, string> = {
  "chat-button": "Chat IA flutuante",
  "exit-intent": "Exit intent",
  "section-navbar": "Navbar",
  "section-footer": "Footer",
  marketing: "Marketing toolkit",
};
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { PropertiesPanelContent } from "../properties-panel/properties-panel";

const ICONS: Record<ElementType, React.ComponentType<{ className?: string }>> = {
  text:                  Type,
  image:                 ImageIcon,
  svg:                   Shapes,
  shape:                 Square,
  divider:               Minus,
  icon:                  StarIcon,
  button:                MousePointerClick,
  video:                 VideoIcon,
  social:                Share2,
  spacer:                SquareStack,
  "nasa-link":           LinkIcon,
  embed:                 Code2,
  group:                 SquareStack,
  "section-hero":        LayoutTemplate,
  "section-features":    LayoutGrid,
  "section-pricing":     DollarSign,
  "section-cta":         Megaphone,
  "section-stats":       BarChart3,
  "section-testimonials": Quote,
  "section-faq":         HelpCircle,
  "section-logo-cloud":  Building2,
  marquee:               MoveHorizontal,
  tabs:                  Layers,
  accordion:             Rows3,
  counter:               Hash,
  "data-bound":          Database,
  marketing:             Sparkles,
};

const LABELS: Record<ElementType, string> = {
  text:                  "Texto",
  image:                 "Imagem",
  svg:                   "SVG",
  shape:                 "Forma",
  divider:               "Divisor",
  icon:                  "Ícone",
  button:                "Botão",
  video:                 "Vídeo",
  social:                "Social",
  spacer:                "Espaço",
  "nasa-link":           "Link NASA",
  embed:                 "Embed",
  group:                 "Grupo",
  "section-hero":        "Hero",
  "section-features":    "Features",
  "section-pricing":     "Pricing",
  "section-cta":         "CTA",
  "section-stats":       "Stats",
  "section-testimonials": "Depoimentos",
  "section-faq":         "FAQ",
  "section-logo-cloud":  "Logos",
  marquee:               "Marquee",
  tabs:                  "Tabs",
  accordion:             "Accordion",
  counter:               "Contador",
  "data-bound":          "Data bound",
  marketing:             "Marketing",
};

const ELEMENT_ORDER: ElementType[] = [
  "text", "image", "button", "shape", "divider",
  "icon", "video", "social", "spacer", "nasa-link", "embed",
  "carousel", "chat-button", "embedded-form", "exit-intent",
  "marketing",
];

// Biblioteca rica de blocos vive em `src/features/pages/lib/block-library.ts`
// (Hero, Depoimentos, Features, Pricing, FAQ, CTA, Navbar, Footer, Stats,
// Logos, Carrosséis). A aba "Blocos" renderiza via `BlocksPanel`.

type Tab = "elements" | "blocks" | "layers" | "pages" | "page";

/**
 * Versão drawer/sheet: mesmo conteúdo do BuilderSidebar mas SEM o
 * `<aside>` wrapper. Pra usar dentro de `<SheetContent>` quando em
 * mobile (sidebar lateral vira gaveta deslizante).
 */
export function BuilderSidebarPanel() {
  return <BuilderSidebarBody asPanel />;
}

export function BuilderSidebar() {
  return <BuilderSidebarBody />;
}

function BuilderSidebarBody({ asPanel = false }: { asPanel?: boolean }) {
  const [tab, setTab] = useState<Tab>("elements");
  const addElement = usePagesBuilderStore((s) => s.addElement);
  const insertElementAt = usePagesBuilderStore((s) => s.insertElementAt);
  const moveElement = usePagesBuilderStore((s) => s.moveElement);
  const updateArtboard = usePagesBuilderStore((s) => s.updateArtboard);
  const layout = usePagesBuilderStore((s) => s.layout);
  const selected = usePagesBuilderStore((s) => s.selected);

  // Pequeno deslocamento mínimo (`activationConstraint.distance`) pra
  // que clicks em "Adicionar elemento" continuem disparando o
  // handleAdd — sem isso o `useDraggable` na mesma <button> capturaria
  // o click e bloquearia o add. 4px = limite confortável.
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    }),
  );

  // Quando o user começa a arrastar um element-add da aba Elementos
  // (data.kind === "add-element-button"), pula automaticamente pra
  // aba Camadas pra que as drop zones fiquem visíveis. Sortable
  // interno NÃO troca de tab (já estamos na aba Camadas se a row
  // existe pra ser arrastada).
  const handleDragStart = (event: DragStartEvent) => {
    const kind = event.active.data.current?.kind;
    if (kind === "add-element-button") setTab("layers");
  };

  const updateElement = usePagesBuilderStore((s) => s.updateElement);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeData = active.data.current ?? {};
    const overData = over.data.current ?? {};

    // ── Caso A: reorder DENTRO de uma section composta (depoimentos,
    //    features, planos, blocos intermediários, etc). O
    //    `SortableSectionItem` marca data.kind="section-item" +
    //    data.collection.
    //
    //    `collection` aceita dot-notation (ex: "interlude.afterCards")
    //    pra arrays aninhados — get/set seguem os segmentos.
    if (
      activeData.kind === "section-item" &&
      overData.kind === "section-item" &&
      activeData.collection === overData.collection &&
      activeData.elementId === overData.elementId
    ) {
      const elId = activeData.elementId as string;
      const collection = activeData.collection as string;
      const lay = usePagesBuilderStore.getState().layout;
      const layer = usePagesBuilderStore.getState().activeLayer;
      if (!lay) return;
      const el = getActiveLayerElements(lay, layer).find((e) => e.id === elId);
      if (!el) return;
      const arr = getByPath(el, collection) as { id: string }[] | undefined;
      if (!arr) return;
      const oldIdx = arr.findIndex((it) => it.id === active.id);
      const newIdx = arr.findIndex((it) => it.id === over.id);
      if (oldIdx < 0 || newIdx < 0 || oldIdx === newIdx) return;
      const reordered = arrayMove(arr, oldIdx, newIdx);
      const patch = setByPath(el, collection, reordered);
      updateElement(elId, patch);
      return;
    }

    // ── Caso 1: arrastando uma row sortable (reorder dentro de Camadas).
    //    O `@dnd-kit/sortable` adiciona `data.current.sortable` na
    //    active automaticamente. Aqui só executamos se over também
    //    for uma row (não uma drop zone externa).
    if (activeData.sortable && overData.sortable) {
      const lay = usePagesBuilderStore.getState().layout;
      const layer = usePagesBuilderStore.getState().activeLayer;
      if (!lay) return;
      const els = getActiveLayerElements(lay, layer);
      const overIdx = els.findIndex((el) => el.id === over.id);
      if (overIdx === -1) return;
      moveElement(String(active.id), overIdx);
      return;
    }

    // ── Caso 2: inserir um element NOVO de Elementos numa drop zone
    //    de Camadas. `active.kind === "add-element-button"` carrega o
    //    ElementType pretendido; `over.kind === "layers-drop"` carrega
    //    o índice de inserção.
    if (
      activeData.kind === "add-element-button" &&
      overData.kind === "layers-drop"
    ) {
      const elementType = activeData.elementType as ElementType;
      const targetIndex = overData.index as number;
      handleInsertAtIndex(elementType, targetIndex);
      return;
    }
  };

  // Insere element novo no índice X via factory + posicionamento Y
  // calculado em cascata pelo `insertElementAt` do store. Trata
  // singleton (que selecionam existente em vez de inserir) e empty
  // state.
  const handleInsertAtIndex = (t: ElementType, targetIndex: number) => {
    const lay = usePagesBuilderStore.getState().layout;
    const layer = usePagesBuilderStore.getState().activeLayer;
    if (!lay) return;
    const existing = getActiveLayerElements(lay, layer);

    if (SINGLETON_TYPES.has(t)) {
      const existingOfType = existing.find((el) => el.type === t);
      if (existingOfType) {
        const label = SINGLETON_LABELS[t] ?? t;
        usePagesBuilderStore.getState().setSelected([existingOfType.id]);
        toast.info(`Já existe 1 ${label} — selecionei pra você editar.`, {
          description:
            "Esse tipo só pode existir 1× por page. Edite no painel direito.",
        });
        return;
      }
    }

    const base = createElement(t, {});
    // Pra flow sections o `reindexFlowY` do store cuida do Y.
    // Pra atoms livres, mantemos x/y default da factory.
    const el: ElementBase = isFlowSection(t)
      ? { ...base, x: 0, y: 0 }
      : base;
    insertElementAt(el, targetIndex);
    toast.success(`${LABELS[t] ?? t} inserido na posição ${targetIndex + 1}`);
  };

  // Posiciona o elemento no centro da viewport visível (pra free
  // elements) ou no fim da pilha (pra flow sections). Antes ficavam
  // todos em x:0 y:0 — apareciam atrás dos blocos, "sumindo".
  const handleAdd = (t: ElementType) => {
    const lay = usePagesBuilderStore.getState().layout;
    const layer = usePagesBuilderStore.getState().activeLayer;
    const zoom = usePagesBuilderStore.getState().zoom;
    const base = createElement(t, {});
    if (!lay) {
      addElement(base);
      return;
    }
    const existing = getActiveLayerElements(lay, layer);

    // Singleton elements: em vez de bloquear, SELECIONA o existente
    // pra o user editar. Mais útil que toast.error "já tem 1".
    if (SINGLETON_TYPES.has(t)) {
      const existingOfType = existing.find((el) => el.type === t);
      if (existingOfType) {
        const label = SINGLETON_LABELS[t] ?? t;
        usePagesBuilderStore.getState().setSelected([existingOfType.id]);
        toast.info(`Já existe 1 ${label} — selecionei pra você editar.`, {
          description: "Esse tipo só pode existir 1× por page. Edite no painel direito.",
        });
        return;
      }
    }

    const pos = computeInsertPosition({
      type: t,
      w: base.w,
      h: base.h,
      existingElements: existing,
      zoom,
      artboardWidth: lay.artboard.width ?? 1440,
    });
    addElement({ ...base, x: pos.x, y: pos.y });
  };

  // (handleBlock antigo removido — aba "Blocos" agora consome a
  // biblioteca rica via `BlocksPanel` + `block-library.ts`.)

  const bgColor = layout?.artboard.background ?? "#ffffff";

  // Sidebar 320px (era 300) — abre espaço pras 5 abas + properties
  // panel embutido sem ficar apertado.
  const wrapperCls = asPanel
    ? "w-full h-full flex flex-col overflow-hidden bg-card"
    : "w-[320px] border-r bg-card hidden md:flex flex-col shrink-0 overflow-hidden";
  const Tag: React.ElementType = asPanel ? "div" : "aside";

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <Tag data-builder-sidebar className={wrapperCls}>
      {/* Tab bar — layout vertical (ícone topo + label embaixo) pra
          acomodar 5 abas confortavelmente em 320px sem espremer
          texto. Padding compacto pra altura ~52px. */}
      <div className="flex border-b shrink-0 bg-card">
        {([
          { id: "elements", icon: SquareStack,    tip: "Elementos" },
          { id: "blocks",   icon: LayoutTemplate, tip: "Blocos" },
          { id: "layers",   icon: Layers3,        tip: "Camadas" },
          { id: "pages",    icon: Files,          tip: "Páginas" },
          { id: "page",     icon: Settings2,      tip: "Ajustes" },
        ] as { id: Tab; icon: React.ComponentType<{ className?: string }>; tip: string }[]).map(({ id, icon: Icon, tip }) => (
          <button
            key={id}
            title={tip}
            onClick={() => setTab(id)}
            className={cn(
              "flex-1 min-w-0 py-1.5 px-0.5 flex flex-col items-center justify-center gap-0.5 transition-colors",
              tab === id
                ? "bg-indigo-50 text-indigo-600 border-b-2 border-indigo-500"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/30 border-b-2 border-transparent",
            )}
          >
            <Icon className="size-[18px] shrink-0" />
            <span className="text-[10px] font-medium leading-tight truncate max-w-full">
              {tip}
            </span>
          </button>
        ))}
      </div>

      {/* scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {tab === "elements" && (
          <div className="py-2">
            <p className="px-3 text-[10px] font-semibold uppercase text-muted-foreground mb-1.5">Elementos</p>
            <div className="flex flex-col gap-0.5 px-2">
              {ELEMENT_ORDER.map((t) => {
                const Icon = ICONS[t] ?? SquareStack;
                return (
                  <DraggableElementButton
                    key={t}
                    type={t}
                    label={LABELS[t] ?? t}
                    Icon={Icon}
                    onClick={() => handleAdd(t)}
                  />
                );
              })}
            </div>
          </div>
        )}

        {tab === "blocks" && <BlocksPanel />}

        {tab === "layers" && <LayersPanel />}

        {tab === "pages" && <PagesPanel />}

        {tab === "page" && (
          <PageSettingsPanel
            bgColor={bgColor}
            updateArtboard={updateArtboard}
            layout={layout}
          />
        )}

        {/* ─── Properties panel embutido ─────────────────────────────── */}
        {selected.length > 0 ? (
          <PropertiesPanelContent />
        ) : (
          // Empty state educativo — mostra DESTACADO quando nada está
          // selecionado. Usuário tá confuso: "criou só uma imagem
          // fixa?". Não é fixa — cada bloco é editável. Esse hint
          // resolve a falha de discoverability.
          <div className="mt-2 mx-2 mb-3 rounded-lg border-2 border-dashed border-indigo-300 bg-gradient-to-br from-indigo-50 to-violet-50 p-4 text-center">
            <div className="text-2xl mb-1.5">👆</div>
            <p className="text-xs font-semibold text-indigo-900 leading-tight mb-1.5">
              Clique em qualquer bloco no canvas
            </p>
            <p className="text-[11px] text-indigo-700/80 leading-relaxed">
              Cada seção (hero, navbar, features, footer…) é{" "}
              <strong>editável</strong>. Quando você clica, este painel
              mostra todos os campos: <em>título, subtítulo, textos,
              imagens, botões, links, cores</em> — tudo dá pra trocar.
            </p>
            <div className="mt-2.5 flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
              <span className="inline-flex items-center gap-1 rounded-full bg-white border px-2 py-0.5">
                <span className="size-1.5 rounded-full bg-indigo-500" />
                Dica
              </span>
              <span>arrasta também pra mover</span>
            </div>
          </div>
        )}
      </div>
      </Tag>
    </DndContext>
  );
}

/**
 * Botão "adicionar elemento" da aba Elementos. Click chama `onClick`
 * (handleAdd — insere no centro do viewport ou no fim do flow).
 * Drag arrasta o type pra dentro da aba Camadas — soltar numa drop
 * zone insere no índice exato (handleDragEnd em BuilderSidebarBody).
 *
 * `activationConstraint.distance` (4px no PointerSensor) garante que
 * cliques curtos NÃO virem drag — só após mover ≥4px o drag ativa.
 */
function DraggableElementButton({
  type,
  label,
  Icon,
  onClick,
}: {
  type: ElementType;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `add-${type}`,
    data: { kind: "add-element-button", elementType: type },
  });
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onClick}
      title={`Clique pra adicionar · arraste pra escolher posição em Camadas`}
      className={cn(
        "flex items-center gap-3 px-2 py-2 rounded-md text-sm hover:bg-accent hover:text-accent-foreground transition-colors text-left",
        isDragging && "opacity-50 ring-2 ring-indigo-300",
      )}
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span>{label}</span>
    </button>
  );
}

/**
 * Configurações da página inteira — aparência básica (background,
 * height) + tracking (Meta Pixel, Google Analytics, UTM defaults).
 *
 * UTM defaults: usados quando alguém chega na page SEM utm na URL.
 * O lead criado herda esses valores. Útil pra campanhas externas
 * que esquecem de adicionar UTM.
 *
 * Tracking IDs (Meta Pixel, GA, GTM) ficam no `layout.meta` — sem
 * migration. O public renderer injeta os scripts no client.
 */
function PageSettingsPanel({
  bgColor,
  updateArtboard,
  layout,
}: {
  bgColor: string;
  updateArtboard: (p: Partial<{ background: string; minHeight: number }>) => void;
  layout: ReturnType<typeof usePagesBuilderStore.getState>["layout"];
}) {
  const updateMeta = usePagesBuilderStore((s) => s.updateMeta);
  const meta =
    ((layout as unknown as { meta?: Record<string, unknown> })?.meta ?? {}) as Record<
      string,
      string | undefined
    >;

  return (
    <div>
      <UrlSlugEditor />
      <div className="py-2 px-3">
      <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-3">
        Aparência da página
      </p>
      <div className="space-y-4">
        <div>
          <Label className="text-[11px] text-muted-foreground">Cor de fundo</Label>
          <div className="flex items-center gap-2 mt-1">
            <input
              type="color"
              value={bgColor}
              onChange={(e) => updateArtboard({ background: e.target.value })}
              className="size-9 rounded border cursor-pointer p-0.5 bg-transparent"
            />
            <span className="text-xs font-mono text-muted-foreground">{bgColor}</span>
          </div>
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Altura mínima (px)</Label>
          <input
            type="number"
            min={400}
            step={100}
            value={layout?.artboard.minHeight ?? 800}
            onChange={(e) => updateArtboard({ minHeight: Number(e.target.value) })}
            className="mt-1 w-full h-8 rounded border px-2 text-xs bg-background"
          />
        </div>
      </div>

      <hr className="my-4" />

      <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">
        Pixels & Analytics
      </p>
      <p className="text-[10px] text-muted-foreground mb-3 leading-relaxed">
        IDs injetados no <code className="font-mono">&lt;head&gt;</code> da
        página pública. Funcionam só após publicar.
      </p>
      <div className="space-y-3">
        <div>
          <Label className="text-[11px] text-muted-foreground">Meta Pixel ID</Label>
          <input
            type="text"
            value={meta.metaPixelId ?? ""}
            onChange={(e) => updateMeta({ metaPixelId: e.target.value || undefined })}
            placeholder="123456789012345"
            className="mt-1 w-full h-8 rounded border px-2 text-xs bg-background font-mono"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">
            Google Tag (G- ou AW-)
          </Label>
          <input
            type="text"
            value={meta.googleTagId ?? ""}
            onChange={(e) => updateMeta({ googleTagId: e.target.value || undefined })}
            placeholder="G-XXXXXXXXXX ou AW-XXXXXXXXX"
            className="mt-1 w-full h-8 rounded border px-2 text-xs bg-background font-mono"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">
            Google Tag Manager (GTM-)
          </Label>
          <input
            type="text"
            value={meta.gtmId ?? ""}
            onChange={(e) => updateMeta({ gtmId: e.target.value || undefined })}
            placeholder="GTM-XXXXXXX"
            className="mt-1 w-full h-8 rounded border px-2 text-xs bg-background font-mono"
          />
        </div>
      </div>

      <hr className="my-4" />

      <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">
        UTM defaults
      </p>
      <p className="text-[10px] text-muted-foreground mb-3 leading-relaxed">
        Aplicados quando o lead chega sem utm na URL. Sobrescrevidos
        pela URL quando presentes.
      </p>
      <div className="space-y-3">
        {(
          [
            ["utmSource", "utm_source", "google, facebook, ig…"],
            ["utmMedium", "utm_medium", "cpc, organic, email…"],
            ["utmCampaign", "utm_campaign", "black-friday-2026"],
            ["utmContent", "utm_content", "banner-top"],
            ["utmTerm", "utm_term", "palavra-chave"],
          ] as const
        ).map(([key, lbl, ph]) => (
          <div key={key}>
            <Label className="text-[11px] text-muted-foreground">{lbl}</Label>
            <input
              type="text"
              value={(meta[key] as string) ?? ""}
              onChange={(e) =>
                updateMeta({ [key]: e.target.value || undefined })
              }
              placeholder={ph}
              className="mt-1 w-full h-8 rounded border px-2 text-xs bg-background font-mono"
            />
          </div>
        ))}
      </div>
      </div>
    </div>
  );
}


/**
 * Lê um valor por path dot-notation num objeto. Ex: getByPath(el, "interlude.afterCards").
 * Retorna `undefined` se algum segmento não existe.
 */
function getByPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/**
 * Devolve um PATCH (objeto raiz com apenas o primeiro segmento atualizado)
 * pra updateElement, preservando os outros valores. Necessário porque o
 * store faz spread superficial — se mexêssemos só num campo aninhado fora
 * dele, perderíamos os irmãos.
 *
 * Ex: setByPath(el, "interlude.afterCards", [...]) → { interlude: { ...elInterlude, afterCards: [...] } }
 */
function setByPath(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> {
  const [head, ...rest] = path.split(".");
  if (rest.length === 0) {
    return { [head]: value };
  }
  const current = (obj[head] as Record<string, unknown> | undefined) ?? {};
  return {
    [head]: { ...current, ...setByPath(current, rest.join("."), value) },
  };
}
