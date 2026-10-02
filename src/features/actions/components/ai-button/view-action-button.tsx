import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ViewActionButtonProps } from "./types";
import { useQueryClient } from "@tanstack/react-query";
import { useQueryAction } from "../../hooks/use-tasks";

export function ViewActionButton({ title, id, onView }: ViewActionButtonProps) {
  const { action } = useQueryAction(id);

  const queryClient = useQueryClient();

  const handleView = () => {
    queryClient.invalidateQueries({
      queryKey: ["action.listByColumn", action?.columnId],
    });
    onView(id);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => handleView()}
      className="flex items-center gap-2 bg-card/50 border-line hover:bg-card hover:border-info/50 text-xs my-2 transition-all group/btn w-fit"
    >
      <Eye className="size-3.5 text-info group-hover/btn:scale-110 transition-transform" />
      <span className="font-semibold text-foreground">Ver Ação:</span>
      <span className="text-muted-foreground truncate max-w-[150px]">{title}</span>
    </Button>
  );
}
