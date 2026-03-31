import {
  FormBlockInstance,
  FormBlockType,
  FormCategoryType,
  FormErrorsType,
  HandleBlurFunc,
  ObjectBlockType,
} from "@/features/form/types";
import { ChildCanvasComponentWrapper } from "@/features/form/components/common/utils/child-canvas-component-wrapper";
import { ChildFormComponentWrapper } from "@/features/form/components/common/utils/child-form-component-wrapper";
import { ChildPropertiesComponentWrapper } from "@/features/form/components/common/utils/child-properties-component-wrapper";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { allBlockLayouts } from "@/features/form/constants";
import { getContrastColor } from "@/utils/get-contrast-color";
import { useBuilderStore } from "@/features/form/context/builder-form-provider";
import { FormBlocks } from "@/features/form/lib/form-blocks";
import { cn } from "@/lib/utils";
import { FormSettings } from "@/generated/prisma/client";
import { v4 as uuidv4 } from "uuid";
import {
  Active,
  DragEndEvent,
  useDndMonitor,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { Copy, GripHorizontal, Rows2, Trash2Icon, X } from "lucide-react";
import { useState } from "react";

const blockCategory: FormCategoryType = "Layout";
const blockType: FormBlockType = "RowLayout";

export const RowLayoutBlock: ObjectBlockType = {
  blockCategory,
  blockType,

  createInstance: (id: string) => ({
    id: `layout-${id}`,
    blockType,
    isLocked: false,
    attributes: {},
    childblocks: [],
  }),

  blockBtnElement: {
    icon: Rows2,
    label: "Grupo",
  },

  canvasComponent: RowLayoutCanvasComponent,
  formComponent: RowLayoutFormComponent,
  propertiesComponent: RowLayoutPropertiesComponent,
};

function RowLayoutCanvasComponent({
  blockInstance,
  settings,
}: {
  blockInstance: FormBlockInstance;
  settings?: any;
}) {
  const {
    selectedBlockLayout,
    handleSelectedLayout,
    removeBlockLayout,
    duplicateBlockLayout,
    updateBlockLayout,
  } = useBuilderStore();

  const [activeBlock, setActiveBlock] = useState<Active | null>(null);

  const childBlocks = blockInstance.childblocks || [];

  const isSelected = selectedBlockLayout?.id === blockInstance.id;

  const textColor = settings?.backgroundColor
    ? getContrastColor(settings.backgroundColor)
    : undefined;

  const droppable = useDroppable({
    id: blockInstance.id,
    disabled: blockInstance.isLocked,
    data: {
      isLayoutDropArea: true,
    },
  });

  const draggable = useDraggable({
    id: blockInstance.id + "_drag-area",
    disabled: blockInstance.isLocked,
    data: {
      blockType: blockInstance.blockType,
      blockId: blockInstance.id,
      isCanvasLayout: true,
    },
  });

  useDndMonitor({
    onDragStart: (event) => {
      setActiveBlock(event.active);
    },
    onDragEnd: (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || !active) return;
      setActiveBlock(null);

      const isBlockkBtnElement = active?.data?.current?.isBlockBtnElement;
      const isLayout = active.data?.current?.blockType;

      const overBlockId = over?.id;

      if (
        isBlockkBtnElement &&
        !allBlockLayouts.includes(isLayout) &&
        overBlockId === blockInstance.id &&
        !blockInstance.isLocked
      ) {
        const blockType = active.data?.current?.blockType;
        const newBlock =
          FormBlocks[blockType as FormBlockType].createInstance(uuidv4());

        const updatedChildrenBlock = [...childBlocks, newBlock];
        updateBlockLayout(blockInstance.id, updatedChildrenBlock);
      }
    },
  });

  function removeChildBlock(e: { stopPropagation: () => void }, id: string) {
    e.stopPropagation();
    const filteredBlock = childBlocks.filter((child) => child.id !== id);
    updateBlockLayout(blockInstance.id, filteredBlock);
  }

  if (draggable.isDragging) return;
  return (
    <div ref={draggable.setNodeRef} className="max-w-full ">
      {blockInstance.isLocked && <Border />}

      <Card
        ref={droppable.setNodeRef}
        className={cn(
          `w-full! bg-accent-foreground/10 relative border shadow-sm min-h-[120px] max-w-[768px] rounded-md p-0!`,
          blockInstance.isLocked && "rounded-t-none!",
        )}
        onClick={() => {
          handleSelectedLayout(blockInstance);
        }}
      >
        <CardContent className="px-2 pb-2">
          {isSelected && (
            <div className="w-[5px] absolute left-0 top-0 rounded-l-md h-full bg-primary" />
          )}
          {!blockInstance.isLocked && (
            <div
              {...draggable.listeners}
              {...draggable.attributes}
              role="button"
              className="flex items-center w-full h-[24px] cursor-move justify-center"
            >
              <GripHorizontal
                size="20px"
                className="text-muted-foreground"
                style={{ color: textColor || undefined }}
              />
            </div>
          )}

          <div className="w-full flex flex-wrap gap-2">
            {!allBlockLayouts.includes(activeBlock?.data?.current?.blockType) &&
              !blockInstance.isLocked &&
              activeBlock?.data?.current?.isBlockBtnElement &&
              droppable.isOver && (
                <div
                  className="relative border border-dotted 
                border-foreground bg-foreground/10 w-full h-28"
                >
                  <div className="absolute left-1/2 top-0 -translate-x-1/2 text-xs bg-foreground text-muted-foreground hover:bg-foreground hover:text-white text-center w-28 p-1 rounded-b-full shadow-md">
                    Arraste o bloco aqui
                  </div>
                </div>
              )}

            {!droppable.isOver && childBlocks?.length == 0 ? (
              <PlaceHolder textColor={textColor} />
            ) : (
              <div
                className="
                      flex w-full flex-col
                       items-center 
                       justify-start 
                       gap-4 py-4 px-3"
              >
                {childBlocks?.map((childBlock) => (
                  <div
                    key={childBlock.id}
                    className="w-full h-auto flex items-center justify-center gap-1"
                  >
                    <ChildCanvasComponentWrapper
                      blockInstance={childBlock}
                      settings={settings}
                    />

                    {isSelected && !blockInstance.isLocked && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="bg-transparent!"
                        onClick={(e) => removeChildBlock(e, childBlock.id)}
                      >
                        <X style={{ color: textColor || undefined }} />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>

        {isSelected && !blockInstance.isLocked && (
          <CardFooter className="flex items-center gap-3 justify-end border-t py-3">
            <Button
              variant="outline"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                duplicateBlockLayout(blockInstance.id);
              }}
            >
              <Copy style={{ color: textColor || undefined }} />
            </Button>

            <Button
              variant="outline"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                removeBlockLayout(blockInstance.id);
              }}
            >
              <Trash2Icon style={{ color: textColor || undefined }} />
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}

function RowLayoutFormComponent({
  blockInstance,
  handleBlur,
  formErrors,
  settings,
}: {
  blockInstance: FormBlockInstance;
  handleBlur?: HandleBlurFunc;
  formErrors?: FormErrorsType;
  settings?: FormSettings | null;
}) {
  const childblocks = blockInstance.childblocks || [];

  const textColor = settings?.backgroundColor
    ? getContrastColor(settings.backgroundColor)
    : undefined;

  return (
    <div className="max-w-full">
      {blockInstance.isLocked && <Border />}

      <Card
        className={cn(
          `w-full! bg-foreground/10 relative border shadow-sm min-h-[120px] max-w-[768px] rounded-md p-0!`,
          blockInstance.isLocked && "rounded-t-none!",
        )}
        style={{ color: textColor || undefined }}
      >
        <CardContent className="px-2 pb-2">
          <div className="flex flex-wrap gap-2">
            <div
              className="
             flex w-full flex-col items-center justify-center gap-4 py-4 px-3"
            >
              {childblocks.map((childblock) => (
                <div
                  key={childblock.id}
                  className="flex items-center
                        justify-center 
                        gap-1 h-auto w-full"
                >
                  <ChildFormComponentWrapper
                    blockInstance={childblock}
                    handleBlur={handleBlur}
                    isError={!!formErrors?.[childblock.id]}
                    errorMessage={formErrors?.[childblock.id]}
                    settings={settings}
                  />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function RowLayoutPropertiesComponent({
  blockInstance,
}: {
  blockInstance: FormBlockInstance;
}) {
  const childblocks = blockInstance.childblocks || [];
  return (
    <div className="pt-3 w-full">
      <div
        className="flex w-full flex-col 
    items-center
     justify-start gap-0 py-0 px-0
    "
      >
        {childblocks?.map((childblock, index) => (
          <div
            key={childblock.id}
            className="w-full flex items-center justify-center gap-1 h-auto"
          >
            <ChildPropertiesComponentWrapper
              index={index + 1}
              parentId={blockInstance.id}
              blockInstance={childblock}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function PlaceHolder({ textColor }: { textColor: string | undefined }) {
  return (
    <div className="flex flex-col items-center justify-center border border-dotted border-muted-foreground rounded-md bg-accent/10 hover:bg-accent/5 w-full h-28 text-foreground font-medium text-base gap-1s">
      <p
        style={{ color: textColor || undefined }}
        className="
          text-center 
          "
      >
        Arraste e solte um bloco aqui para começar
      </p>
    </div>
  );
}

function Border() {
  return (
    <div className="w-full rounded-t-md min-h-[8px] bg-accent-foreground/10" />
  );
}
