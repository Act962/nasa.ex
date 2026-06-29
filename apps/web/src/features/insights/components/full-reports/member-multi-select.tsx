"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Check, Users, ChevronDown } from "lucide-react";
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

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function MemberMultiSelect({ value, onChange, className }: Props) {
  const { data, isLoading } = useQuery({
    ...orpc.orgs.listMembersDetailed.queryOptions(),
    staleTime: 5 * 60 * 1000,
  });

  const members = data?.members ?? [];
  const allSelected = value.length === 0;
  const selectedCount = allSelected ? members.length : value.length;

  if (isLoading) return <Skeleton className="h-8 w-44" />;

  const label = allSelected
    ? "Todos os membros"
    : selectedCount === 1
      ? members.find((m) => m.userId === value[0])?.user.name ?? "1 membro"
      : `${selectedCount} membros`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("h-8 text-xs gap-1.5", className)}
        >
          <Users className="size-3.5" />
          <span className="max-w-[160px] truncate">{label}</span>
          <ChevronDown className="size-3 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-1">
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
          <span>Todos os membros</span>
          <span className="ml-auto text-[10px] text-muted-foreground">
            {members.length}
          </span>
        </button>
        <div className="h-px bg-border my-1" />
        <div className="space-y-0.5 max-h-72 overflow-y-auto">
          {members.map((m) => {
            const checked = !allSelected && value.includes(m.userId);
            return (
              <button
                key={m.userId}
                className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs hover:bg-muted text-left"
                onClick={() => {
                  const next = checked
                    ? value.filter((id) => id !== m.userId)
                    : [...(allSelected ? [] : value), m.userId];
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
                  <AvatarImage src={m.user.image ?? ""} />
                  <AvatarFallback className="text-[9px]">
                    {initials(m.user.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate flex-1">{m.user.name}</span>
                <span className="text-[10px] text-muted-foreground capitalize">
                  {m.role}
                </span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
