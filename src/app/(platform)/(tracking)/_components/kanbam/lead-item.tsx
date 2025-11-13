import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Lead = {
  id: string;
  name: string;
  email: string | null;
  order: number;
  phone: string | null;
  statusId: string;
};

export const LeadItem = ({ data }: { data: Lead }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transition,
    transform,
    isDragging,
  } = useSortable({
    id: data.id,
    data: {
      type: "Lead",
      lead: data,
    },
  });

  const style = {
    transition,
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="truncate border-2 border-transparent hover:border-muted py-2 px-3 text-sm bg-muted rounded-md shadow-sm"
    >
      {data.name}
    </div>
  );
};
