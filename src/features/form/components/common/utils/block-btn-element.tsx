import { ObjectBlockType } from "@/features/form/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDraggable } from "@dnd-kit/core";

export function BlockBtnElement({
  formBlock,
  disabled,
}: {
  formBlock: ObjectBlockType;
  disabled?: boolean;
}) {
  const { icon: Icon, label } = formBlock.blockBtnElement;

  const draggable = useDraggable({
    id: `block-btn-${formBlock.blockType}`,
    disabled: disabled,
    data: {
      blockType: formBlock.blockType,
      isBlockBtnElement: true,
    },
  });
  return (
    <Button
      disabled={disabled}
      ref={draggable.setNodeRef}
      className={cn(
        `
        flex flex-col gap-2
        h-[75px] w-20 cursor-grab
         border 
        text-foreground
        `,

        draggable.isDragging && "ring-2 ring-primary shadow-xl",
        disabled && "cursor-default! pointer-events-none!",
      )}
      {...draggable.listeners}
      {...draggable.attributes}
      variant={"outline"}
    >
      <Icon
        className="w-8! h-8! 
        stroke-[0.9]!
          cursor-grab!"
      />
      <h5 className="text-[11.4px] -mt-1" style={{ fontWeight: 500 }}>
        {label}
      </h5>
    </Button>
  );
}
