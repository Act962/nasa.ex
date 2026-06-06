"use client";

/**
 * Painel da aba "Camadas".
 *
 * Mostra os elements do layout atual como uma lista hierárquica
 * (groups no top com filhos indentados readonly). Drag-and-drop
 * vertical reordena via `store.moveElement`. Drop zones entre rows
 * recebem elements arrastados da aba Elementos (via `useDroppable`).
 *
 * IMPORTANTE: NÃO monta `DndContext` próprio — o context é montado no
 * nível do `BuilderSidebar` pra que o drag funcione cross-tab (de
 * Elementos pra Camadas). Aqui só usamos `SortableContext` interno e
 * `useDroppable` em cada gap.
 */
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { Layers3 } from "lucide-react";
import {
  usePagesBuilderStore,
  getActiveLayerElements,
} from "../../context/pages-builder-store";
import { cn } from "@/lib/utils";
import { SortableLayerRow } from "./sortable-layer-row";

interface Props {
  /** Nome legível da subpage ativa (mostrado no header). Default "Página atual". */
  activeSubpageLabel?: string;
}

export function LayersPanel({ activeSubpageLabel }: Props = {}) {
  const layout = usePagesBuilderStore((s) => s.layout);
  const activeLayer = usePagesBuilderStore((s) => s.activeLayer);
  const selected = usePagesBuilderStore((s) => s.selected);
  const setSelected = usePagesBuilderStore((s) => s.setSelected);
  const toggleVisibility = usePagesBuilderStore((s) => s.toggleVisibility);
  const toggleLock = usePagesBuilderStore((s) => s.toggleLock);
  const removeElement = usePagesBuilderStore((s) => s.removeElement);
  const duplicateSelected = usePagesBuilderStore((s) => s.duplicateSelected);

  const elements = getActiveLayerElements(layout, activeLayer);

  // Top-level apenas — filhos de grupo são renderizados indentados
  // dentro da própria SortableLayerRow do grupo.
  const topLevelIds = elements.map((el) => el.id);

  if (elements.length === 0) {
    return (
      <div className="py-2">
        <PanelHeader subpageLabel={activeSubpageLabel} />
        <div className="px-3 py-8 text-center">
          <Layers3 className="size-7 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-xs text-muted-foreground">
            Nenhuma camada ainda.
          </p>
          <p className="text-[10px] text-muted-foreground/70 mt-1.5 leading-relaxed">
            Adicione elementos pela aba <strong>Elementos</strong> —
            eles aparecerão aqui pra serem reordenados, agrupados e
            organizados.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-2">
      <PanelHeader subpageLabel={activeSubpageLabel} />

      <div className="px-2 flex flex-col gap-0">
        <SortableContext items={topLevelIds} strategy={verticalListSortingStrategy}>
          {/* Drop zone no TOPO (índice 0) — pra inserir antes do 1º item. */}
          <LayerDropZone index={0} />
          {elements.map((el, idx) => (
            <div key={el.id}>
              <SortableLayerRow
                element={el}
                isSelected={selected.includes(el.id)}
                onSelect={() => setSelected([el.id])}
                onToggleVisibility={() => toggleVisibility(el.id)}
                onToggleLock={() => toggleLock(el.id)}
                onDuplicate={() => {
                  setSelected([el.id]);
                  duplicateSelected();
                }}
                onDelete={() => removeElement(el.id)}
              />
              {/* Drop zone DEPOIS de cada item (índice idx+1). */}
              <LayerDropZone index={idx + 1} />
            </div>
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

function PanelHeader({ subpageLabel }: { subpageLabel?: string }) {
  return (
    <div className="px-3 mb-1.5 flex items-center justify-between">
      <p className="text-[10px] font-semibold uppercase text-muted-foreground">
        Camadas
      </p>
      {subpageLabel && (
        <span className="text-[10px] text-muted-foreground/70">
          Página:{" "}
          <span className="font-medium text-foreground/80">
            {subpageLabel}
          </span>
        </span>
      )}
    </div>
  );
}

/**
 * Linha "drop zone" entre rows — recebe elements arrastados da aba
 * Elementos pelo `DndContext` do BuilderSidebar. Quando o user passa
 * um draggable em cima dela (active != null), a faixa fica destacada
 * em índigo. Soltar dispara `onDragEnd` no contexto pai, que chama
 * `store.insertElementAt(novoElement, this.index)`.
 *
 * O `id` da drop zone segue o padrão `layers-drop-<index>` pra o
 * `handleDragEnd` distinguir de IDs de elements (que são `el_...`).
 */
function LayerDropZone({ index }: { index: number }) {
  const { setNodeRef, isOver, active } = useDroppable({
    id: `layers-drop-${index}`,
    data: { kind: "layers-drop", index },
  });
  // Só destaca quando o que está sendo arrastado é um draggable de
  // ELEMENTOS (não um sortable interno reordenando). Sortable usa
  // active.data.current?.sortable; draggables externos não.
  const isExternalDrag =
    active && !active.data.current?.sortable;
  const showHint = isExternalDrag;
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "h-1.5 -my-0.5 rounded-full transition-all",
        showHint && "h-2.5 my-0",
        isOver && showHint && "bg-indigo-500/80 ring-2 ring-indigo-300",
        showHint && !isOver && "bg-indigo-200/40",
      )}
      aria-hidden={!showHint}
    />
  );
}
