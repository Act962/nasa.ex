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
import { allBlockLayouts } from "@/features/form/constants";
import { v4 as uuidv4 } from "uuid";

export function BuilderCanvas() {
  const {
    formData,
    blockLayouts,
    addBlockLayout,
    repositionBlockLayout,
    insertBlockLayoutAtIndex,
  } = useBuilderStore();

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
    onDragEnd: (event: DragEndEvent) => {
      console.log("DRAG END", event);
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
      className="relative w-full h-full
  px-5 md:px-0 pt-4 pb-[120px] overflow-auto
  transition-all duration-300 scrollbar
  "
      style={{
        backgroundColor: formData?.settings?.backgroundColor || "",
        backgroundImage: formData?.settings?.backgroundImage
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
          {blockLayouts.length > 0 && (
            <div
              className={cn(
                "flex flex-col w-full gap-4 p-4 rounded-md shadow-lg",
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
}: {
  blockLayout: FormBlockInstance;
  activeBlock: Active | null;
  settings?: any;
}) {
  const CanvasBlockLayout = FormBlocks[blockLayout.blockType].canvasComponent;

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
    </div>
  );
}
