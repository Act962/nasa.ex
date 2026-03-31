import { useRef, useState, type KeyboardEvent } from "react";
import { CircleCheckIcon, CircleDashedIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Action } from "../../types";

interface TitleProps {
  action?: Action;
  onToggleDone: () => void;
  onUpdateTitle: (title: string) => void;
  isUpdating: boolean;
}

export function ActionTitle({ action, onToggleDone, onUpdateTitle, isUpdating }: TitleProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(action?.title ?? "");
  const titleInputRef = useRef<HTMLInputElement>(null);

  const handleTitleClick = () => {
    setTitleValue(action?.title ?? "");
    setEditingTitle(true);
    setTimeout(() => titleInputRef.current?.focus(), 0);
  };

  const handleTitleSave = () => {
    if (!titleValue.trim() || titleValue === action?.title) {
      setEditingTitle(false);
      return;
    }
    onUpdateTitle(titleValue.trim());
    setEditingTitle(false);
  };

  const handleTitleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleTitleSave();
    if (e.key === "Escape") setEditingTitle(false);
  };

  return (
    <div className="flex items-start gap-3">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onToggleDone}
            className="mt-1 shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            disabled={isUpdating}
          >
            {action?.isDone ? (
              <CircleCheckIcon className="size-5 text-emerald-500" />
            ) : (
              <CircleDashedIcon className="size-5" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent>
          {action?.isDone
            ? "Marcar como pendente"
            : "Marcar como concluído"}
        </TooltipContent>
      </Tooltip>

      {editingTitle ? (
        <Input
          ref={titleInputRef}
          value={titleValue}
          onChange={(e) => setTitleValue(e.target.value)}
          onBlur={handleTitleSave}
          onKeyDown={handleTitleKeyDown}
          className="text-xl font-semibold h-auto border-none shadow-none p-0 focus-visible:ring-0 bg-transparent"
        />
      ) : (
        <h2
          className={cn(
            "text-xl font-semibold cursor-pointer hover:bg-muted/50 rounded px-1 -ml-1 transition-colors leading-tight",
            action?.isDone && "line-through text-muted-foreground",
          )}
          onClick={handleTitleClick}
        >
          {action?.title}
        </h2>
      )}
    </div>
  );
}
