"use client";

import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActionFilters } from "../hooks/use-action-filters";
import {
  ParticipantsFilter,
  TagsFilter,
  DateFilter,
  SortFilter,
  ArchivedFilter,
  ProjectsFilter,
} from "./filters";

interface Props {
  workspaceId: string;
}

export function FiltersBar({ workspaceId }: Props) {
  const { activeCount, clearFilters } = useActionFilters();

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <ParticipantsFilter workspaceId={workspaceId} variant="popover" />
      <TagsFilter workspaceId={workspaceId} variant="popover" />
      <DateFilter variant="popover" />
      <SortFilter variant="popover" />
      <ArchivedFilter variant="popover" />

      {/* Clear all */}
      {activeCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs text-muted-foreground hover:text-destructive"
          onClick={clearFilters}
        >
          <XIcon className="size-3" />
          Limpar ({activeCount})
        </Button>
      )}
    </div>
  );
}
