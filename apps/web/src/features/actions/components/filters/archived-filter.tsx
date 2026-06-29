"use client";

import { ArchiveIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useActionFilters } from "../../hooks/use-action-filters";

interface Props {
  variant?: "popover" | "list";
}

export function ArchivedFilter({ variant = "popover" }: Props) {
  const { filters, setFilters } = useActionFilters();

  if (variant === "list") {
    return (
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <ArchiveIcon className="size-4 text-muted-foreground" />
            Arquivados
          </h4>
          <p className="text-xs text-muted-foreground">
            Exibir ações arquivadas nos resultados.
          </p>
        </div>
        <Checkbox
          checked={filters.showArchived}
          onCheckedChange={(checked) =>
            setFilters({ ...filters, showArchived: !!checked })
          }
        />
      </div>
    );
  }

  return (
    <Button
      variant={filters.showArchived ? "secondary" : "outline"}
      size="sm"
      className="h-7 gap-1.5 text-xs"
      onClick={() =>
        setFilters({ ...filters, showArchived: !filters.showArchived })
      }
    >
      <ArchiveIcon className="size-3" />
      Arquivados
    </Button>
  );
}
