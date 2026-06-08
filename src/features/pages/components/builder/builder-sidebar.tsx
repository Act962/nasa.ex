/**
 * builder-sidebar — sidebar principal do builder de páginas.
 *
 * Orquestra as 5 abas (Elementos, Blocos, Camadas, Páginas, Ajustes) +
 * o properties panel embutido, e monta o `DndContext` que dá conta de:
 *
 *  - reorder de rows na aba Camadas (sortable);
 *  - reorder DENTRO de sections compostas (section-item + collection);
 *  - inserir um elemento NOVO arrastado de Elementos numa drop zone de
 *    Camadas (índice exato).
 *
 * Também concentra a lógica de adição de elementos (`handleAdd` /
 * `handleInsertAtIndex`): regras de singleton, "entrar dentro da section
 * visível" como InterludeBlock, e fallback de posicionamento absoluto.
 *
 * As partes mais autocontidas foram extraídas pra arquivos vizinhos:
 *  - builder-sidebar-config  → ICONS, LABELS, ELEMENT_ORDER, singletons, Tab.
 *  - builder-path-utils      → getByPath/setByPath (reorder aninhado).
 *  - draggable-element-button→ botão duplo click/drag da aba Elementos.
 *  - page-settings-panel     → aba Ajustes (aparência, paleta, tracking).
 *  - palette-panel           → bloco "Padrão de cores" da aba Ajustes.
 *
 * Exporta `BuilderSidebar` (com `<aside>` lateral) e `BuilderSidebarPanel`
 * (mesmo conteúdo sem wrapper, pra usar dentro de `<SheetContent>` no mobile).
 */
"use client";

import { useState } from "react";
import { SquareStack, LayoutTemplate, Settings2, Layers3, Files } from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
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
import {
  findVisibleSectionId,
  mapElementToInterludeBlock,
} from "../../lib/visible-section";
import type { ElementType, ElementBase } from "../../types";
import { cn } from "@/lib/utils";
import { LayersPanel } from "./layers-panel";
import { PagesPanel } from "./pages-panel";
import { BlocksPanel } from "./blocks-panel";
import { PropertiesPanelContent } from "../properties-panel/properties-panel";
import {
  ICONS,
  LABELS,
  ELEMENT_ORDER,
  SINGLETON_TYPES,
  SINGLETON_LABELS,
  type Tab,
} from "./builder-sidebar-config";
import { getByPath, setByPath } from "./builder-path-utils";
import { DraggableElementButton } from "./draggable-element-button";
import { PageSettingsPanel } from "./page-settings-panel";

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
  const appendInterludeBlockToSection = usePagesBuilderStore(
    (s) => s.appendInterludeBlockToSection,
  );
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
    const el: ElementBase = isFlowSection(t) ? { ...base, x: 0, y: 0 } : base;
    insertElementAt(el, targetIndex);
    toast.success(`${LABELS[t] ?? t} inserido na posição ${targetIndex + 1}`);
  };

  // Posiciona o elemento no centro da viewport visível (pra free
  // elements) ou no fim da pilha (pra flow sections). Antes ficavam
  // todos em x:0 y:0 — apareciam atrás dos blocos, "sumindo".
  //
  // Comportamento "entra dentro da section visível": quando o user
  // adiciona um ÁTOMO (text/button/image/video/embed) E há uma flow
  // section atualmente visível no viewport do canvas, em vez de criar
  // posicionamento absoluto sobre as outras coisas, convertemos o
  // átomo em InterludeBlock e adicionamos DENTRO da section (zona
  // "afterCards"). A section cresce automaticamente via ResizeObserver,
  // e o user reorganiza com drag-and-drop no painel direito da section.
  //
  // Fallback: tipos sem mapeamento de InterludeBlock (chat-button,
  // marketing, sticky-cta, formulário, etc) continuam com posicionamento
  // absoluto via computeInsertPosition — esses geralmente são overlays
  // ou widgets independentes que NÃO devem entrar em sections.
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
          description:
            "Esse tipo só pode existir 1× por page. Edite no painel direito.",
        });
        return;
      }
    }

    // Flow sections novas: continuam empilhando no fluxo (já é o
    // comportamento desejado, não entram dentro de outras sections).
    if (!isFlowSection(t)) {
      // Resolução do alvo onde o átomo vai entrar como InterludeBlock,
      // em ordem de prioridade:
      //
      //   1. Element SELECIONADO no canvas, se for flow section. Esse é
      //      o caso explícito do user — clicou numa section e mandou
      //      adicionar coisa: vai DENTRO dela.
      //   2. Section atualmente VISÍVEL no viewport (fallback do nº 1).
      //
      // Sem alvo válido em nenhum dos dois → fallback ao posicionamento
      // absoluto antigo (átomo flutua sobre o canvas).
      const selectedIds = usePagesBuilderStore.getState().selected;
      const selectedElement = selectedIds[0]
        ? existing.find((el) => el.id === selectedIds[0])
        : undefined;
      const selectedTargetId =
        selectedElement && isFlowSection(selectedElement.type)
          ? selectedElement.id
          : null;
      const targetSectionId =
        selectedTargetId ?? findVisibleSectionId(existing);

      if (targetSectionId) {
        const block = mapElementToInterludeBlock(t, base);
        if (block) {
          const added = appendInterludeBlockToSection(
            targetSectionId,
            block as unknown as Record<string, unknown>,
            "after",
          );
          if (added) {
            const targetElement = existing.find(
              (el) => el.id === targetSectionId,
            );
            const sectionLabel = targetElement?.type ?? "elemento";
            const reason =
              selectedTargetId === targetSectionId
                ? "Adicionado dentro do elemento selecionado"
                : `Adicionado dentro do ${sectionLabel}`;
            toast.success(`${LABELS[t] ?? t} — ${reason}`, {
              description:
                "Arraste pra reordenar dentro da camada no painel direito.",
            });
            // Mantém a section como selecionada — o user provavelmente
            // quer editar a nova ordem dela em seguida.
            usePagesBuilderStore.getState().setSelected([targetSectionId]);
            return;
          }
        }
      }
    }

    // Fallback: comportamento absoluto antigo — flow section nova ou
    // átomo sem mapeamento (chat-button, marketing, formulário, etc).
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

  // Espelha a precedência do renderer (palette.bg ?? artboard.background)
  // pra exibir a cor de fundo EFETIVA — páginas de template mostram o
  // navy real em vez de branco enganoso.
  const pagePalette = ((
    layout as unknown as { palette?: Record<string, string> }
  )?.palette ?? {}) as Record<string, string>;
  const bgColor = pagePalette.bg ?? layout?.artboard.background ?? "#ffffff";

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
          {(
            [
              { id: "elements", icon: SquareStack, tip: "Elementos" },
              { id: "blocks", icon: LayoutTemplate, tip: "Blocos" },
              { id: "layers", icon: Layers3, tip: "Camadas" },
              { id: "pages", icon: Files, tip: "Páginas" },
              { id: "page", icon: Settings2, tip: "Ajustes" },
            ] as {
              id: Tab;
              icon: React.ComponentType<{ className?: string }>;
              tip: string;
            }[]
          ).map(({ id, icon: Icon, tip }) => (
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
              <p className="px-3 text-[10px] font-semibold uppercase text-muted-foreground mb-1.5">
                Elementos
              </p>
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
                <strong>editável</strong>. Quando você clica, este painel mostra
                todos os campos:{" "}
                <em>
                  título, subtítulo, textos, imagens, botões, links, cores
                </em>{" "}
                — tudo dá pra trocar.
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
