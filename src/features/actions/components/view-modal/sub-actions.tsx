import { useRef, useState, type KeyboardEvent } from "react";
import { CheckIcon, PlusIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Action } from "../../types";

interface SubActionsProps {
  subActions?: Action["subActions"];
  onCreate: (title: string) => void;
  onToggle: (id: string, isDone: boolean) => void;
  onDelete: (id: string) => void;
  isCreating: boolean;
  isDeleting: boolean;
}

export function ActionSubActions({
  subActions = [],
  onCreate,
  onToggle,
  onDelete,
  isCreating,
  isDeleting,
}: SubActionsProps) {
  const [newSubActionTitle, setNewSubActionTitle] = useState("");
  const [addingSubAction, setAddingSubAction] = useState(false);
  const subActionInputRef = useRef<HTMLInputElement>(null);

  const totalSubActions = subActions.length;
  const doneSubActions = subActions.filter((s: any) => s.isDone).length;

  const handleAddSubAction = () => {
    const title = newSubActionTitle.trim();
    if (!title) return;
    onCreate(title);
    setNewSubActionTitle("");
    setAddingSubAction(false);
  };

  const handleSubActionKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleAddSubAction();
    if (e.key === "Escape") {
      setAddingSubAction(false);
      setNewSubActionTitle("");
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Sub-ações
          </p>
          {totalSubActions > 0 && (
            <span className="text-xs text-muted-foreground">
              {doneSubActions}/{totalSubActions}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={() => {
            setAddingSubAction(true);
            setTimeout(() => subActionInputRef.current?.focus(), 0);
          }}
        >
          <PlusIcon className="size-3.5" />
          Adicionar
        </Button>
      </div>

      {totalSubActions > 0 && (
        <div className="w-full bg-muted rounded-full h-1.5 mb-2">
          <div
            className="bg-emerald-500 h-1.5 rounded-full transition-all"
            style={{
              width: `${(doneSubActions / totalSubActions) * 100}%`,
            }}
          />
        </div>
      )}

      <div className="space-y-1">
        {subActions.map((sub) => (
          <div
            key={sub.id}
            className="flex items-center gap-2 group rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors"
          >
            <Checkbox
              checked={sub.isDone}
              onCheckedChange={() => onToggle(sub.id, sub.isDone)}
              className="shrink-0"
            />
            <span
              className={cn(
                "flex-1 text-sm",
                sub.isDone && "line-through text-muted-foreground",
              )}
            >
              {sub.title}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              onClick={() => onDelete(sub.id)}
              disabled={isDeleting}
            >
              <XIcon className="size-3" />
            </Button>
          </div>
        ))}

        {addingSubAction && (
          <div className="flex items-center gap-2 px-2 py-1">
            <div className="size-4 shrink-0" />
            <Input
              ref={subActionInputRef}
              placeholder="Título da sub-ação..."
              value={newSubActionTitle}
              onChange={(e) => setNewSubActionTitle(e.target.value)}
              onKeyDown={handleSubActionKeyDown}
              onBlur={() => {
                if (!newSubActionTitle.trim()) {
                  setAddingSubAction(false);
                }
              }}
              className="h-7 text-sm"
              disabled={isCreating}
            />
            <Button
              size="sm"
              className="h-7 px-2"
              onClick={handleAddSubAction}
              disabled={!newSubActionTitle.trim() || isCreating}
            >
              <CheckIcon className="size-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
