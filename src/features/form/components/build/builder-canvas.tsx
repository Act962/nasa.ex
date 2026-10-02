import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Active,
  DragEndEvent,
  useDndMonitor,
  useDroppable,
} from "@dnd-kit/core";
import { useBuilderStore } from "@/features/form/context/builder-form-provider";
import { FormBlockInstance, FormBlockType } from "@/features/form/types";
import { FormBlocks } from "@/features/form/lib/form-blocks";
import { allBlockLayouts, defaultBackgroundColor } from "@/features/form/constants";
import { v4 as uuidv4 } from "uuid";
import { ArrowDownIcon, ArrowUpIcon, PencilIcon } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { StarterTemplatePicker } from "./starter-template-picker";
import { useMobileBuilderStore } from "./mobile/use-mobile-builder-store";

export function BuilderCanvas() {
  const {
    formData,
    blockLayouts,
    addBlockLayout,
    repositionBlockLayout,
    insertBlockLayoutAtIndex,
  } = useBuilderStore();
  const isMobile = useIsMobile();
  const setOpenPanel = useMobileBuilderStore((state) => state.setOpenPanel);
  // "Em branco" esconde os modelos; no celular já abre a gaveta de blocos.
  const [isBlankStart, setIsBlankStart] = useState(false);
  const shouldOfferTemplates = Boolean(formData) && !formData?.published && blockLayouts.length === 0 && !isBlankStart;

  const [activeBlock, setActiveBlock] = useState<Active | null>(null);

  const droppable = useDroppable({
    id: "builder-canvas-droppable",
    data: {
      isBuilderCanvasDropArea: true,
    },
  });

  useDndMonitor({
    onDragStart: (event) => {
      setActiveBlock(event.active);
    },
    onDragCancel: () => {
      setActiveBlock(null);
    },
    onDragEnd: (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || !active) return;
      setActiveBlock(null);

      const isBlockBtnElement = active?.data?.current?.isBlockBtnElement;
      const isBlockLayout = active?.data?.current?.blockType;

      const isDraggingOverCanvas = over.data?.current?.isBuilderCanvasDropArea;

      if (
        isBlockBtnElement &&
        allBlockLayouts.includes(isBlockLayout) &&
        isDraggingOverCanvas
      ) {
        const blockType = active.data?.current?.blockType;

        const newBlockLayout =
          FormBlocks[blockType as FormBlockType].createInstance(uuidv4());
        addBlockLayout(newBlockLayout);
        return;
      }

      const isDroppingOverCanvasBlockLayoutAbove = over?.data?.current?.isAbove;
      const isDroppingOverCanvasBlockLayoutBelow = over?.data?.current?.isBelow;

      const isDroppingOverCanvasLayout =
        isDroppingOverCanvasBlockLayoutAbove ||
        isDroppingOverCanvasBlockLayoutBelow;

      //-> NEW BLOCK LAYOUT TO A SPECIFIC POSITION
      const droppingLayoutBlockOverCanvas =
        isBlockBtnElement &&
        allBlockLayouts.includes(isBlockLayout) &&
        isDroppingOverCanvasLayout;

      if (droppingLayoutBlockOverCanvas) {
        const blockType = active.data?.current?.blockType;
        const overId = over?.data?.current?.blockId;

        const newBlockLayout =
          FormBlocks[blockType as FormBlockType].createInstance(uuidv4());

        let position: "above" | "below" = "below";
        if (isDroppingOverCanvasBlockLayoutAbove) {
          position = "above";
        }
        insertBlockLayoutAtIndex(overId, newBlockLayout, position);
        return;
      }

      //-> EXISTING BLOCK LAYOUT TO A SPECIFIC POSITION
      const isDraggingCanvasLayout = active.data?.current?.isCanvasLayout;

      const draggingCanvasLayoutOverAnotherLayout =
        isDroppingOverCanvasLayout && isDraggingCanvasLayout;

      if (draggingCanvasLayoutOverAnotherLayout) {
        const activeId = active?.data?.current?.blockId;
        const overId = over?.data?.current?.blockId;

        let position: "above" | "below" = "below";
        if (isDroppingOverCanvasBlockLayoutAbove) {
          position = "above";
        }

        repositionBlockLayout(activeId, overId, position);
        return;
      }
    },
  });
  return (
    <div
      data-builder-canvas
      className="relative w-full h-full
  px-2 md:px-0 pt-3 md:pt-4 pb-[190px] md:pb-[120px] overflow-auto
  transition-all duration-300 scrollbar
  "
      style={{
        // Enquanto escolhe o modelo, o fundo do formulário (cor do modelo anterior/padrão) não tinge a tela.
        backgroundColor: shouldOfferTemplates ? "" : formData?.settings?.backgroundColor || defaultBackgroundColor,
        backgroundImage: !shouldOfferTemplates && formData?.settings?.backgroundImage
          ? `url(${formData.settings.backgroundImage})`
          : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      <div
        className="w-full 
        h-full max-w-[650px]
        mx-auto"
      >
        {/* {Droppable Canvas} */}
        <div
          ref={droppable.setNodeRef}
          className={cn(
            `
         w-full relative px-2 rounded-md
         flex flex-col min-h-svh items-center
         justify-start pt-1 pb-14
        `,
            droppable.isOver &&
              blockLayouts.length === 0 &&
              "ring-4 ring-primary/20 ring-inset",
          )}
        >
          {shouldOfferTemplates && (
            <StarterTemplatePicker
              onStartBlank={() => {
                setIsBlankStart(true);
                if (isMobile) setOpenPanel("add-block");
              }}
            />
          )}
          {blockLayouts.length > 0 && (
            <div
              className={cn(
                "flex flex-col w-full gap-4 p-4 rounded-md shadow-lg max-md:gap-2 max-md:rounded-[20px] max-md:p-1.5 max-md:shadow-none",
                formData?.settings?.backgroundImage
                  ? "bg-white/10 backdrop-blur-md border border-white/20"
                  : "",
              )}
            >
              {blockLayouts.map((blockLayout) => (
                <CanvasBlockLayoutWrapper
                  key={blockLayout.id}
                  activeBlock={activeBlock}
                  blockLayout={blockLayout}
                  settings={formData?.settings}
                  isMobile={isMobile}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CanvasBlockLayoutWrapper({
  blockLayout,
  activeBlock,
  settings,
  isMobile,
}: {
  blockLayout: FormBlockInstance;
  activeBlock: Active | null;
  settings?: any;
  isMobile: boolean;
}) {
  const CanvasBlockLayout = FormBlocks[blockLayout.blockType].canvasComponent;
  const { blockLayouts, selectedBlockLayout, repositionBlockLayout } = useBuilderStore();
  const setOpenPanel = useMobileBuilderStore((state) => state.setOpenPanel);
  const isSelected = selectedBlockLayout?.id === blockLayout.id;
  const blockIndex = blockLayouts.findIndex((layout) => layout.id === blockLayout.id);
  const previousLayout = blockLayouts[blockIndex - 1];
  const nextLayout = blockLayouts[blockIndex + 1];
  // O cabeçalho travado fica sempre no topo: nada sobe acima dele.
  const canMoveUp = Boolean(previousLayout) && !previousLayout?.isLocked && !blockLayout.isLocked;
  const canMoveDown = Boolean(nextLayout) && !blockLayout.isLocked;

  const topCorner = useDroppable({
    id: blockLayout.id + "_above",
    data: {
      blockType: blockLayout.blockType,
      blockId: blockLayout.id,
      isAbove: true,
    },
  });

  const bottomCorner = useDroppable({
    id: blockLayout.id + "_below",
    data: {
      blockType: blockLayout.blockType,
      blockId: blockLayout.id,
      isBelow: true,
    },
  });

  return (
    <div className="relative mb-1">
      {allBlockLayouts.includes(activeBlock?.data?.current?.blockType) &&
        !blockLayout.isLocked && (
          <div
            ref={topCorner.setNodeRef}
            className="absolute top-0 w-full h-1/2 pointer-events-none"
          >
            {topCorner.isOver && (
              <div className="absolute w-full -top-[3px] h-[6px] bg-foreground rounded-t-md" />
            )}
          </div>
        )}

      {/* Bottom Half Drop Zone */}
      {allBlockLayouts.includes(activeBlock?.data?.current?.blockType) &&
        !blockLayout.isLocked && (
          <div
            ref={bottomCorner.setNodeRef}
            className="
        absolute bottom-0 w-full h-1/2
        pointer-events-none
        "
          >
            {bottomCorner.isOver && (
              <div className="absolute w-full -bottom-[3px] h-[6px] bg-primary rounded-b-md" />
            )}
          </div>
        )}

      <div className="relative">
        <CanvasBlockLayout blockInstance={blockLayout} settings={settings} />
      </div>

      {/* Celular: sem arrastar no toque — subir, descer e abrir a edição em gaveta. */}
      {isMobile && isSelected && (
        <div className="mt-2 flex items-center gap-1.5">
          <button
            type="button"
            disabled={!canMoveUp}
            onClick={() => previousLayout && repositionBlockLayout(blockLayout.id, previousLayout.id, "above")}
            aria-label="Subir bloco"
            className="grid h-9 flex-1 place-items-center rounded-full bg-panel disabled:opacity-40"
          >
            <ArrowUpIcon className="size-4" />
          </button>
          <button
            type="button"
            disabled={!canMoveDown}
            onClick={() => nextLayout && repositionBlockLayout(blockLayout.id, nextLayout.id, "below")}
            aria-label="Descer bloco"
            className="grid h-9 flex-1 place-items-center rounded-full bg-panel disabled:opacity-40"
          >
            <ArrowDownIcon className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setOpenPanel("edit-block")}
            className="flex h-9 flex-[2] items-center justify-center gap-1.5 rounded-full bg-foreground text-xs font-semibold text-background"
          >
            <PencilIcon className="size-3.5" />
            Editar
          </button>
        </div>
      )}
    </div>
  );
}
