import { ObjectBlockType } from "@/features/form/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDraggable } from "@dnd-kit/core";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function BlockBtnIcon({
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
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          disabled={disabled}
          ref={draggable.setNodeRef}
          variant="outline"
          className={cn(
            "size-9 p-0 cursor-grab",
            draggable.isDragging && "ring-2 ring-primary shadow-xl",
            disabled && "cursor-default! pointer-events-none!",
          )}
          {...draggable.listeners}
          {...draggable.attributes}
          aria-label={label}
        >
          <Icon className="size-4 stroke-[1.1]!" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

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
        flex flex-col items-center justify-center gap-1.5
        h-auto min-h-[88px] w-full px-1 py-2 cursor-grab
        border whitespace-normal
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
        className="w-7! h-7!
        stroke-[0.9]!
          cursor-grab! shrink-0"
      />
      <h5
        className="text-[11px] leading-tight text-center line-clamp-2 break-words w-full px-0.5"
        style={{ fontWeight: 500 }}
      >
        {label}
      </h5>
    </Button>
  );
}
