import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusField } from "./status-field";
import { PriorityField } from "./priority-field";
import { DateFields } from "./date-fields";
import { ResponsibleField } from "./responsible-field";
import { InfoFields } from "./info-fields";
import { Action } from "../../../types";

interface SidebarProps {
  action?: Action;
  isLoading: boolean;
  columns: any[];
  members: any[];
  onUpdateAction: (data: any) => void;
  onToggleParticipant: (userId: string) => void;
  isUpdating: boolean;
  isAddingParticipant: boolean;
  isRemovingParticipant: boolean;
}

export function ActionSidebar({
  action,
  isLoading,
  columns,
  members,
  onUpdateAction,
  onToggleParticipant,
  isUpdating,
  isAddingParticipant,
  isRemovingParticipant,
}: SidebarProps) {
  if (isLoading) {
    return (
      <div className="w-64 border-l shrink-0 overflow-y-auto bg-muted/80">
        <div className="p-4 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-8 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 border-l shrink-0 overflow-y-auto bg-muted/80">
      <div className="p-4 space-y-4">
        <StatusField
          value={action?.columnId ?? ""}
          columns={columns}
          onValueChange={(columnId) => onUpdateAction({ columnId })}
          disabled={isUpdating}
        />

        <PriorityField
          value={action?.priority ?? "NONE"}
          onValueChange={(priority) => onUpdateAction({ priority })}
          disabled={isUpdating}
        />

        <DateFields
          dueDate={action?.dueDate ?? undefined}
          startDate={action?.startDate ?? undefined}
          onDueDateChange={(date) => onUpdateAction({ dueDate: date })}
          onStartDateChange={(date) => onUpdateAction({ startDate: date })}
        />

        <Separator />

        <ResponsibleField
          participants={action?.participants}
          members={members}
          onToggle={onToggleParticipant}
          isAdding={isAddingParticipant}
          isRemoving={isRemovingParticipant}
        />

        <Separator />

        <InfoFields
          user={action?.user}
          createdAt={action?.createdAt ? new Date(action.createdAt) : undefined}
        />
      </div>
    </div>
  );
}
