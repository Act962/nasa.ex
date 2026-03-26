import { Separator } from "@/components/ui/separator";
import { Action } from "../types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Props {
  action: Action;
}

export function KanbanCard({ action }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: action.id,
    data: {
      type: "Action",
      action,
    },
  });

  const style = {
    transition,
    transform: CSS.Translate.toString(transform),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`bg-muted rounded-md p-2.5 mb-1.5 space-y-3 cursor-grab active:cursor-grabbing hover:ring-2 hover:ring-primary/20 transition-all ${
        isDragging ? "opacity-30" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-x-2">
        <p className="text-sm font-medium line-clamp-2">{action.title}</p>
      </div>

      <Separator className="bg-primary/10" />

      <div className="flex items-center gap-x-1.5">
        <div className="flex -space-x-2">
          {action.participants.slice(0, 6).map((participant) => (
            <Avatar className="size-6 border-2" key={participant.user.id}>
              <AvatarImage
                src={participant?.user?.image || ""}
                alt={participant.user.name}
              />
              <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                {participant.user.name[0]}
              </AvatarFallback>
            </Avatar>
          ))}
          {action.participants.length > 6 && (
            <Avatar className="size-6 border-2 border-background">
              <AvatarFallback className="text-[10px] bg-muted text-muted-foreground font-bold">
                +{action.participants.length - 6}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      </div>
    </div>
  );
}
