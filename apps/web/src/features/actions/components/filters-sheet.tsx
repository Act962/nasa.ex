"use client";

import { ListFilter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
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

export function FiltersSheet({ workspaceId }: Props) {
  const { activeCount, clearFilters } = useActionFilters();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="icon-sm" variant="ghost" className="relative">
          <ListFilter className="size-4" />
          {activeCount > 0 && (
            <Badge className="absolute -top-1 -right-1 size-4 p-0 flex items-center justify-center text-[10px]">
              {activeCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent hideOverlay className="flex flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="p-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle>Filtros</SheetTitle>
              <SheetDescription>Refine sua busca de ações.</SheetDescription>
            </div>
            {activeCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground hover:text-destructive"
                onClick={clearFilters}
              >
                Limpar tudo ({activeCount})
              </Button>
            )}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <ProjectsFilter variant="list" />
          <ParticipantsFilter workspaceId={workspaceId} variant="list" />
          <TagsFilter workspaceId={workspaceId} variant="list" />
          <DateFilter variant="list" />
          <SortFilter variant="list" />
          <ArchivedFilter variant="list" />
        </div>
      </SheetContent>
    </Sheet>
  );
}
