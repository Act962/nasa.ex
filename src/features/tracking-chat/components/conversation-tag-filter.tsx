"use client";

import { useState } from "react";
import { ChevronsUpDownIcon, SearchIcon, TagIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { cn } from "@/lib/utils";
import { useTags } from "@/features/tags/hooks/use-tags";

// Filtro de etiquetas da lista de conversas: linha no painel "Filtrar conversas" e submenu dos "Filtros rápidos".

interface ConversationTagFilterProps {
  trackingId: string | null;
  selectedTagIds: string[];
  onSelectedTagIdsChange: (tagIds: string[]) => void;
  /** "row": linha do painel, igual aos outros filtros dele. "submenu": item dentro de outro menu. */
  variant: "row" | "submenu";
}

export function ConversationTagFilter({
  trackingId,
  selectedTagIds,
  onSelectedTagIdsChange,
  variant,
}: ConversationTagFilterProps) {
  const { tags, isLoadingTags } = useTags({
    trackingId: trackingId ?? undefined,
    enabled: !!trackingId,
  });
  const [tagSearch, setTagSearch] = useState("");
  const normalizedTagSearch = normalizeSearchText(tagSearch.trim());
  const filteredTags = normalizedTagSearch
    ? tags.filter((tag) => normalizeSearchText(tag.name).includes(normalizedTagSearch))
    : tags;
  const hasTagSelection = selectedTagIds.length > 0;

  const toggleTag = (tagId: string) => {
    onSelectedTagIdsChange(
      selectedTagIds.includes(tagId)
        ? selectedTagIds.filter((selectedId) => selectedId !== tagId)
        : [...selectedTagIds, tagId],
    );
  };

  const resetSearchOnClose = (isOpen: boolean) => {
    if (!isOpen) setTagSearch("");
  };
  const countLabel = hasTagSelection ? ` (${selectedTagIds.length})` : "";

  const menuBody = (
    <>
      <DropdownMenuLabel>Filtrar por etiquetas</DropdownMenuLabel>
      {trackingId && tags.length > 0 && (
        <InputGroup className="mb-1 h-8">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            autoFocus
            value={tagSearch}
            onChange={(event) => setTagSearch(event.target.value)}
            // O typeahead do Radix roubaria as letras; a seta para baixo
            // leva o foco às etiquetas, e dali a navegação do menu segue.
            onKeyDown={(event) => {
              if (event.key === "Escape") return;
              event.stopPropagation();
              if (event.key !== "ArrowDown") return;
              event.preventDefault();
              event.currentTarget
                .closest<HTMLElement>('[role="menu"]')
                ?.querySelector<HTMLElement>('[role="menuitemcheckbox"]')
                ?.focus();
            }}
            placeholder="Buscar etiqueta..."
            aria-label="Buscar etiqueta"
            className="text-xs"
          />
        </InputGroup>
      )}
      <DropdownMenuSeparator />
      {!trackingId ? (
        <div className="px-2 py-3 text-xs text-muted-foreground">
          Selecione um tracking para ver as etiquetas.
        </div>
      ) : isLoadingTags ? (
        <div className="px-2 py-3 text-xs text-muted-foreground">Carregando etiquetas...</div>
      ) : tags.length === 0 ? (
        <div className="px-2 py-3 text-xs text-muted-foreground">Nenhuma etiqueta encontrada.</div>
      ) : filteredTags.length === 0 ? (
        <div className="px-2 py-3 text-xs text-muted-foreground">
          Nenhuma etiqueta para &quot;{tagSearch.trim()}&quot;.
        </div>
      ) : (
        <div className="max-h-64 overflow-y-auto">
          {filteredTags.map((tag) => (
            <DropdownMenuCheckboxItem
              key={tag.id}
              checked={selectedTagIds.includes(tag.id)}
              onCheckedChange={() => toggleTag(tag.id)}
            >
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: tag.color ?? "currentColor" }}
              />
              <span className="truncate">{tag.name}</span>
            </DropdownMenuCheckboxItem>
          ))}
        </div>
      )}
      {hasTagSelection && (
        <>
          <DropdownMenuSeparator />
          <button
            type="button"
            onClick={() => onSelectedTagIdsChange([])}
            className="w-full rounded-sm px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            Limpar etiquetas
          </button>
        </>
      )}
    </>
  );

  if (variant === "submenu") {
    return (
      <DropdownMenuSub onOpenChange={resetSearchOnClose}>
        <DropdownMenuSubTrigger>
          <TagIcon className="size-4" />
          Etiquetas{countLabel}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="w-64">{menuBody}</DropdownMenuSubContent>
      </DropdownMenuSub>
    );
  }

  return (
    <DropdownMenu onOpenChange={resetSearchOnClose}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "w-full justify-start",
            hasTagSelection && "border-primary bg-primary/10 text-primary",
          )}
        >
          <TagIcon className="size-4" />
          Tags{countLabel}
          <ChevronsUpDownIcon className="ml-auto size-4 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {menuBody}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function normalizeSearchText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}
