import { cn } from "@/lib/utils";
import { useDndContext, useDroppable } from "@dnd-kit/core";

export function Footer() {
  const { active } = useDndContext();

  if (active?.data.current?.type !== "Lead") return null;

  return (
    <div className="hidden sm:grid grid-cols-3 gap-2 h-15 px-2 py-2">
      <ButtonAction
        id="excluir"
        label="EXCLUIR"
        typeAction="excluir"
        className="text-foreground"
        overClassName="bg-[#ffffff1a] border-0"
      />
      <ButtonAction
        id="ganho"
        label="GANHO"
        typeAction="ganho"
        className="text-green-900"
        overClassName="bg-green-900 border-0 text-white"
      />
      <ButtonAction
        id="perdido"
        label="PERDIDO"
        typeAction="perdido"
        className="text-red-500"
        overClassName="bg-red-500 border-0 text-white"
      />
    </div>
  );
}

interface ButtonActionProps extends React.ComponentProps<"button"> {
  label: string;
  id: string;
  typeAction: string;
  overClassName?: string;
}

function ButtonAction({
  label,
  id,
  typeAction,
  className,
  overClassName,
  ...rest
}: ButtonActionProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: id,
    data: {
      type: "FooterButton",
      action: typeAction,
    },
  });

  return (
    <button
      ref={setNodeRef}
      className={cn(
        "flex h-full text-center items-center justify-center rounded-sm font-medium text-xs border-4 border-dashed transition-colors",
        "hover:bg-opacity-10 hover:text-white",
        className,
        isOver && overClassName
      )}
      {...rest}
    >
      {label}
    </button>
  );
}
