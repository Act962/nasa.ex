import { useRef, useState, type KeyboardEvent } from "react";
import { CheckIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Action } from "../../types";
import { SubActionItem } from "./sub-action-item";

interface SubActionsProps {
  subActions?: Action["subActions"];
  members?: any[];
  action?: Pick<Action, "startDate" | "dueDate">;
  onCreate: (title: string) => void;
  onToggle: (id: string, isDone: boolean) => void;
  onDelete: (id: string) => void;
  onUpdate: (
    id: string,
    data: {
      title?: string;
      description?: string | null;
      finishDate?: Date | null;
    },
  ) => void;
  onAddResponsible: (subActionId: string, userId: string) => void;
  onRemoveResponsible: (subActionId: string, userId: string) => void;
  onPromote: (id: string) => void;
  isCreating: boolean;
  isDeleting: boolean;
  isUpdating?: boolean;
}

export function ActionSubActions({
  subActions = [],
  members = [],
  action,
  onCreate,
  onToggle,
  onDelete,
  onUpdate,
  onAddResponsible,
  onRemoveResponsible,
  onPromote,
  isCreating,
  isDeleting,
  isUpdating,
}: SubActionsProps) {
  const [newSubActionTitle, setNewSubActionTitle] = useState("");
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [addingSubAction, setAddingSubAction] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const subActionInputRef = useRef<HTMLInputElement>(null);

  const totalSubActions = subActions.length;
  const doneSubActions = subActions.filter((s) => s.isDone).length;

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

  const minDate = action?.startDate
    ? new Date(action.startDate).toISOString().split("T")[0]
    : undefined;
  const maxDate = action?.dueDate
    ? new Date(action.dueDate).toISOString().split("T")[0]
    : undefined;

  return (
    <div className="space-y-2">
      {/* Header */}
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

      {/* Progress bar */}
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

      {/* List */}
      <div className="space-y-1">
        {subActions.map((sub) => {
          return (
            <SubActionItem
              key={sub.id}
              sub={sub}
              members={members}
              minDate={minDate}
              maxDate={maxDate}
              isExpanded={expandedId === sub.id}
              isEditingTitle={editingTitleId === sub.id}
              onToggleExpand={() => setExpandedId(expandedId === sub.id ? null : sub.id)}
              onEditTitleStart={() => setEditingTitleId(sub.id)}
              onEditTitleEnd={() => setEditingTitleId(null)}
              onToggle={onToggle}
              onDelete={onDelete}
              onUpdate={onUpdate}
              onAddResponsible={onAddResponsible}
              onRemoveResponsible={onRemoveResponsible}
              onPromote={onPromote}
              isUpdating={isUpdating}
              isDeleting={isDeleting}
            />
          );
        })}

        {/* Add new sub-action inline */}
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
