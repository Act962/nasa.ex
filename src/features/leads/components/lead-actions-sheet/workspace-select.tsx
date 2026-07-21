"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

interface WorkspaceOption {
  id: string;
  name: string;
  color: string | null;
}

interface WorkspaceSelectProps {
  workspaces: WorkspaceOption[];
  isLoading: boolean;
  value: string | null;
  onChange: (workspaceId: string) => void;
}

export function WorkspaceSelect({
  workspaces,
  isLoading,
  value,
  onChange,
}: WorkspaceSelectProps) {
  if (isLoading) {
    return <Skeleton className="h-9 w-full sm:w-56" />;
  }

  if (workspaces.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Você ainda não participa de nenhum workspace.
      </p>
    );
  }

  return (
    <Select value={value ?? undefined} onValueChange={onChange}>
      <SelectTrigger className="w-full sm:w-56" size="sm">
        <SelectValue placeholder="Selecione um workspace" />
      </SelectTrigger>
      <SelectContent>
        {workspaces.map((workspace) => (
          <SelectItem key={workspace.id} value={workspace.id}>
            <span className="flex items-center gap-2">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: workspace.color ?? "#1447e6" }}
              />
              <span className="truncate">{workspace.name}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
