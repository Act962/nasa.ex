"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useTags } from "@/features/tags/hooks/use-tags";
import { Check, Tag as TagIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface TagDropdownProps {
  children: React.ReactNode;
  tagId?: string | null;
  onSelect: (tag: string | null) => void;
}

export function TagDropdown({ children, tagId, onSelect }: TagDropdownProps) {
  const { tags, isLoadingTags } = useTags({ trackingId: "ALL" });

  function handleSelect(selected: string) {
    onSelect(selected);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm">
          {children}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuLabel className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <TagIcon className="size-3" />
          Tags
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {isLoadingTags ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : tags.length === 0 ? (
          <div className="py-3 px-2 text-center text-xs text-muted-foreground">
            Nenhuma tag encontrada.
          </div>
        ) : (
          tags.map((t) => {
            const isSelected = t.id === tagId;
            return (
              <DropdownMenuItem
                key={t.id}
                onSelect={() => handleSelect(t.id)}
                className={cn(
                  "flex items-center gap-2 cursor-pointer",
                  isSelected && "bg-accent",
                )}
              >
                <span
                  className="size-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: t.color ?? "#1447e6" }}
                />
                <span className="flex-1 truncate text-sm">{t.name}</span>
                {isSelected && (
                  <Check className="size-3.5 ml-auto text-primary shrink-0" />
                )}
              </DropdownMenuItem>
            );
          })
        )}

        {tagId && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => onSelect(null)}
              className="text-xs text-muted-foreground cursor-pointer"
            >
              Remover tag
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
