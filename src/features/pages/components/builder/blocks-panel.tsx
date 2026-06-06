"use client";

/**
 * Painel da aba "Blocos" — biblioteca rica de sections reutilizáveis
 * organizadas por categoria.
 *
 * UX:
 *   - Chips de categoria no topo (Hero / Depoimentos / Cards / etc).
 *   - Grid 1-col com preview visual + label + descrição.
 *   - Click no card insere a section no canvas (singleton-aware).
 *
 * O preview é uma representação ESTILIZADA (gradient + linhas) — não
 * renderizamos a section real pra evitar peso. Mas o gradient e linhas
 * dão pista visual suficiente de qual é a vibe do bloco.
 */
import { useState } from "react";
import { toast } from "sonner";
import {
  BLOCK_LIBRARY,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  getBlocksByCategory,
  type BlockCategory,
  type BlockDef,
} from "../../lib/block-library";
import {
  usePagesBuilderStore,
  getActiveLayerElements,
} from "../../context/pages-builder-store";
import { createElement } from "../../lib/element-factory";
import { computeInsertPosition } from "../../lib/insert-position";
import { isFlowSection } from "../../lib/section-flow";
import { cn } from "@/lib/utils";
import type { ElementBase } from "../../types";
import { ElementRenderer } from "../elements/element-renderer";
import { PageRenderContextProvider } from "../public/page-context";

type Filter = "all" | BlockCategory;

const SINGLETON_TYPES = new Set([
  "chat-button",
  "exit-intent",
  "section-navbar",
  "section-footer",
]);

export function BlocksPanel() {
  const [filter, setFilter] = useState<Filter>("all");
  const addElement = usePagesBuilderStore((s) => s.addElement);
  const setSelected = usePagesBuilderStore((s) => s.setSelected);

  const handleInsert = (block: BlockDef) => {
    const lay = usePagesBuilderStore.getState().layout;
    const layer = usePagesBuilderStore.getState().activeLayer;
    if (!lay) return;
    const existing = getActiveLayerElements(lay, layer);

    // Singleton check (navbar/footer só 1)
    if (SINGLETON_TYPES.has(block.type)) {
      const existingOfType = existing.find((el) => el.type === block.type);
      if (existingOfType) {
        setSelected([existingOfType.id]);
        toast.info(
          `Já existe 1 ${CATEGORY_LABELS[block.category]} — selecionei pra você editar.`,
          {
            description:
              "Esse tipo só pode existir 1× por page. Edite no painel direito.",
          },
        );
        return;
      }
    }

    // Cria base via factory pra herdar w/h/x/y defaults
    const base = createElement(block.type, {});
    // Sobrescreve com as props do bloco
    const merged: ElementBase = { ...base, ...block.build() };
    // Posiciona via computeInsertPosition (flow section → empilha;
    // atom → centro do viewport)
    const zoom = usePagesBuilderStore.getState().zoom;
    const pos = computeInsertPosition({
      type: block.type,
      w: merged.w,
      h: merged.h,
      existingElements: existing,
      zoom,
      artboardWidth: lay.artboard.width ?? 1440,
    });
    addElement({
      ...merged,
      x: isFlowSection(block.type) ? 0 : pos.x,
      y: pos.y,
    });
    toast.success(`${block.label} adicionado`);
  };

  const filtered = getBlocksByCategory(filter);

  return (
    <div className="py-2">
      {/* Chips de categoria */}
      <div className="px-2 mb-2 flex flex-wrap gap-1">
        <CategoryChip
          label="Todos"
          active={filter === "all"}
          count={BLOCK_LIBRARY.length}
          onClick={() => setFilter("all")}
        />
        {CATEGORY_ORDER.map((cat) => {
          const count = getBlocksByCategory(cat).length;
          if (count === 0) return null;
          return (
            <CategoryChip
              key={cat}
              label={CATEGORY_LABELS[cat]}
              active={filter === cat}
              count={count}
              onClick={() => setFilter(cat)}
            />
          );
        })}
      </div>

      <div className="px-2 flex flex-col gap-2">
        {filtered.map((block) => (
          <BlockCard
            key={block.id}
            block={block}
            onClick={() => handleInsert(block)}
          />
        ))}
        {filtered.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            Nenhum bloco nesta categoria ainda.
          </p>
        )}
      </div>
    </div>
  );
}

function CategoryChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "text-[10px] px-2 py-1 rounded-full border transition-colors whitespace-nowrap",
        active
          ? "bg-indigo-500 text-white border-indigo-500"
          : "bg-background text-muted-foreground border-border hover:bg-accent",
      )}
    >
      {label}
      <span className="ml-1 opacity-70">{count}</span>
    </button>
  );
}

function BlockCard({
  block,
  onClick,
}: {
  block: BlockDef;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="text-left rounded-lg border-2 hover:border-indigo-500 transition-all overflow-hidden bg-card group"
    >
      <BlockPreview block={block} />
      <div className="px-2.5 py-1.5">
        <div className="text-[11px] font-semibold leading-tight">
          {block.label}
        </div>
        {block.description && (
          <div className="text-[10px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">
            {block.description}
          </div>
        )}
      </div>
    </button>
  );
}

/**
 * Preview REAL do bloco — renderiza o `ElementRenderer` da section em
 * scale reduzida pra que o user veja exatamente o conteúdo final antes
 * de inserir.
 *
 * Como funciona:
 *   - Container externo tem altura fixa (~110px) e `overflow: hidden`
 *   - Interior tem `width: 1200px` (artboard padrão) e `transform:
 *     scale(<fator>)` pra encaixar na largura disponível (sidebar ~290px
 *     content → fator ~0.24)
 *   - `pointerEvents: none` impede clicks acidentais dentro do mini
 *     (todo click cai no botão do BlockCard externo)
 *   - Renderiza dentro de um `PageRenderContextProvider` vazio pra
 *     elementos como navbar que consultam contexto.
 */
function BlockPreview({ block }: { block: BlockDef }) {
  // Cria um element "fake" só pro preview (sem id real, x/y, etc).
  // Aqui combinamos o type + props do bloco.
  const fakeElement = {
    id: `preview-${block.id}`,
    type: block.type,
    x: 0,
    y: 0,
    w: 1200,
    h: 1, // h não importa — o conteúdo intrínseco define
    ...block.build(),
  } as unknown as ElementBase;

  // Largura disponível do card preview no sidebar (~280px após paddings).
  // Scale 0.24 = 1200 * 0.24 = 288px de largura cabe na sidebar.
  const SCALE = 0.24;
  const PREVIEW_HEIGHT = 110;
  const SOURCE_WIDTH = 1200;

  return (
    <div
      className="relative w-full overflow-hidden bg-white"
      style={{ height: PREVIEW_HEIGHT, pointerEvents: "none" }}
    >
      {/* Gradient overlay sutil pra dar moldura quando o conteúdo é
          claro/quase invisível. */}
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(99,102,241,0.3), transparent)",
        }}
      />
      <div
        style={{
          width: SOURCE_WIDTH,
          transform: `scale(${SCALE})`,
          transformOrigin: "top left",
          // Compensa a altura aparente — o conteúdo escalado ainda
          // toma espaço de seu tamanho original, mas o overflow:hidden
          // do parent recorta.
        }}
      >
        <PageRenderContextProvider value={{}}>
          <ElementRenderer element={fakeElement} readonly />
        </PageRenderContextProvider>
      </div>
      {/* Fade na base pra cortar conteúdo abruptamente recortado */}
      <div
        className="absolute inset-x-0 bottom-0 h-6 pointer-events-none"
        style={{
          background:
            "linear-gradient(to bottom, transparent, rgba(255,255,255,0.95))",
        }}
      />
    </div>
  );
}
