"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowDownWideNarrowIcon, CheckIcon } from "lucide-react";
import {
  CONVERSATION_SORT_DIRECTIONS,
  CONVERSATION_SORT_OPTIONS,
  type ConversationSortBy,
  type ConversationSortDirection,
} from "../lib/conversation-filters-state";

interface ConversationSorterProps {
  sortBy: ConversationSortBy;
  sortDirection: ConversationSortDirection;
  onSortByChange: (value: ConversationSortBy) => void;
  onSortDirectionChange: (value: ConversationSortDirection) => void;
  className?: string;
}

/**
 * Ordenação da lista de conversas (spec 0011, RF-6/RF-7).
 *
 * Não reaproveita o `SorterLead` do board porque este tem **direção**
 * (asc/desc), que lá não existe, e guarda o estado na URL em vez do
 * `useKanbanStore` (D-5).
 */
export function ConversationSorter({
  sortBy,
  sortDirection,
  onSortByChange,
  onSortDirectionChange,
  className,
}: ConversationSorterProps) {
  const currentLabel = CONVERSATION_SORT_OPTIONS.find(
    (option) => option.value === sortBy,
  )?.label;

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={className ?? "justify-start"}
        >
          <ArrowDownWideNarrowIcon className="size-4" />
          Ordenar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Ordenar por</DropdownMenuLabel>
        {CONVERSATION_SORT_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => onSortByChange(option.value)}
            className="gap-2"
          >
            <CheckIcon
              className={
                sortBy === option.value ? "size-3.5" : "size-3.5 opacity-0"
              }
            />
            <span className="flex-1">{option.label}</span>
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          {currentLabel}
        </DropdownMenuLabel>
        {CONVERSATION_SORT_DIRECTIONS.map((direction) => (
          <DropdownMenuItem
            key={direction.value}
            onClick={() => onSortDirectionChange(direction.value)}
            className="gap-2"
          >
            <CheckIcon
              className={
                sortDirection === direction.value
                  ? "size-3.5"
                  : "size-3.5 opacity-0"
              }
            />
            <span className="flex-1">{direction.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
