"use client";
import { useState } from "react";
import { Active, DragOverlay, useDndMonitor } from "@dnd-kit/core";
import { FormBlockType } from "@/features/form/types";
import { BlockBtnDragOverlay } from "./block-btn-drag-overlay";
import { useBuilderStore } from "@/features/form/context/builder-form-provider";
import { FormBlocks } from "@/features/form/lib/form-blocks";

export function BuilderDragOverlay() {
  const { blockLayouts } = useBuilderStore();
  const [draggedItem, setDraggedItem] = useState<Active | null>(null);

  useDndMonitor({
    onDragStart: (event) => {
      setDraggedItem(event.active);
    },
    onDragCancel() {
      setDraggedItem(null);
    },
    onDragEnd() {
      setDraggedItem(null);
    },
  });

  if (!draggedItem) return null;

  let fallbackNode = <div>No block drag</div>;
  const isBlockBtnElement = draggedItem?.data?.current?.isBlockBtnElement;
  const isCanvasLayout = draggedItem?.data?.current?.isCanvasLayout;

  if (isBlockBtnElement) {
    const blockType = draggedItem?.data?.current?.blockType as FormBlockType;
    fallbackNode = <BlockBtnDragOverlay formBlock={FormBlocks[blockType]} />;
  }

  if (isCanvasLayout) {
    const blockId = draggedItem.data?.current?.blockId;
    const blockLayout = blockLayouts.find(
      (blockLayout) => blockLayout.id === blockId,
    );
    if (!blockLayout) fallbackNode = <div>No block drag</div>;
    else {
      const CanvasBlockComponent =
        FormBlocks[blockLayout.blockType].canvasComponent;
      fallbackNode = (
        <div className="pointer-events-none">
          <CanvasBlockComponent blockInstance={blockLayout} />
        </div>
      );
    }
  }

  return (
    <DragOverlay>
      <div className="opacity-95">{fallbackNode}</div>
    </DragOverlay>
  );
}
