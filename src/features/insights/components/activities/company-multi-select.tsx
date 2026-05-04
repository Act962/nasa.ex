"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Check, Building2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  className?: string;
}

export function CompanyMultiSelect({ value, onChange, className }: Props) {
  const { data, isLoading } = useQuery({
    ...orpc.insights.listMyOrganizations.queryOptions(),
    staleTime: 5 * 60 * 1000,
  });

  const orgs = data?.organizations ?? [];
  const allSelected = value.length === 0;
  const selectedCount = allSelected ? orgs.length : value.length;

  if (isLoading) return <Skeleton className="h-8 w-44" />;
  if (orgs.length <= 1) return null;

  const label = allSelected
    ? "Todas as minhas empresas"
    : selectedCount === 1
      ? orgs.find((o) => o.id === value[0])?.name ?? "1 empresa"
      : `${selectedCount} empresas`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("h-8 text-xs gap-1.5", className)}
        >
          <Building2 className="size-3.5" />
          <span className="max-w-[160px] truncate">{label}</span>
          <ChevronDown className="size-3 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1">
        <button
          className={cn(
            "flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs hover:bg-muted text-left",
            allSelected && "font-semibold",
          )}
          onClick={() => onChange([])}
        >
          <div
            className={cn(
              "size-3.5 rounded border flex items-center justify-center shrink-0",
              allSelected ? "bg-primary border-primary" : "border-muted-foreground/30",
            )}
          >
            {allSelected && <Check className="size-2.5 text-primary-foreground" />}
          </div>
          <span>Todas as minhas empresas</span>
          <span className="ml-auto text-[10px] text-muted-foreground">
            {orgs.length}
          </span>
        </button>
        <div className="h-px bg-border my-1" />
        <div className="space-y-0.5 max-h-72 overflow-y-auto">
          {orgs.map((o) => {
            const checked = !allSelected && value.includes(o.id);
            return (
              <button
                key={o.id}
                className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs hover:bg-muted text-left"
                onClick={() => {
                  const next = checked
                    ? value.filter((id) => id !== o.id)
                    : [...(allSelected ? [] : value), o.id];
                  onChange(next);
                }}
              >
                <div
                  className={cn(
                    "size-3.5 rounded border flex items-center justify-center shrink-0",
                    checked ? "bg-primary border-primary" : "border-muted-foreground/30",
                  )}
                >
                  {checked && (
                    <Check className="size-2.5 text-primary-foreground" />
                  )}
                </div>
                <Avatar className="size-5">
                  <AvatarImage src={o.logo ?? ""} />
                  <AvatarFallback className="text-[9px]">
                    {o.name[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate flex-1">{o.name}</span>
                <span className="text-[10px] text-muted-foreground capitalize">
                  {o.role}
                </span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
