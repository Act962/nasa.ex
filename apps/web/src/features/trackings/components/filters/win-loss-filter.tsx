"use client";

import { useQueryState } from "nuqs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, Trash2, XCircle, LayoutGrid } from "lucide-react";

export function WinLossFilter() {
  const [actionFilter, setActionFilter] = useQueryState("filter");

  const value = actionFilter || "ACTIVE";

  return (
    <Select
      value={value}
      onValueChange={(val) => setActionFilter(val === "ACTIVE" ? null : val)}
    >
      <SelectTrigger className="w-full h-9">
        <SelectValue placeholder="Status" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ACTIVE">
          <div className="flex items-center gap-2">
            <LayoutGrid className="size-4" />
            <span>Ativos</span>
          </div>
        </SelectItem>
        <SelectItem value="WON">
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle2 className="size-4" />
            <span>Ganhos</span>
          </div>
        </SelectItem>
        <SelectItem value="LOST">
          <div className="flex items-center gap-2 text-red-600">
            <XCircle className="size-4" />
            <span>Perdidos</span>
          </div>
        </SelectItem>
        <SelectItem value="DELETED">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Trash2 className="size-4" />
            <span>Deletados</span>
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
