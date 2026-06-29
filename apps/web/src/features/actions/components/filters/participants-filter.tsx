"use client";

import { UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useWorkspaceMembers } from "@/features/workspace/hooks/use-workspace";
import { useActionFilters } from "../../hooks/use-action-filters";
import { cn } from "@/lib/utils";

interface Props {
  workspaceId: string;
  variant?: "popover" | "list";
}

export function ParticipantsFilter({
  workspaceId,
  variant = "popover",
}: Props) {
  const { members } = useWorkspaceMembers(workspaceId);
  const { filters, setFilters } = useActionFilters();

  const toggleParticipant = (id: string) => {
    const ids = filters.participantIds.includes(id)
      ? filters.participantIds.filter((x) => x !== id)
      : [...filters.participantIds, id];
    setFilters({ ...filters, participantIds: ids });
  };

  const selectedCount = filters.participantIds.length;

  if (members.length === 0) return null;

  const content = (
    <div className="space-y-0.5">
      {members.map((m: any) => {
        const active = filters.participantIds.includes(m.user.id);
        return (
          <button
            key={m.user.id}
            onClick={() => toggleParticipant(m.user.id)}
            className={cn(
              "flex items-center gap-2 w-full p-1.5 rounded-md hover:bg-muted transition-colors text-left",
              variant === "list" && "p-2",
            )}
          >
            <Avatar className={variant === "list" ? "size-6" : "size-5"}>
              <AvatarImage src={m.user.image || ""} />
              <AvatarFallback className="text-[9px]">
                {m.user.name[0]}
              </AvatarFallback>
            </Avatar>
            <span className="flex-1 text-xs truncate">{m.user.name}</span>
            {active && (
              <span className="text-primary text-xs font-bold">✓</span>
            )}
          </button>
        );
      })}
    </div>
  );

  if (variant === "list") {
    return (
      <div className="space-y-2">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <UserIcon className="size-4 text-muted-foreground" />
          Participantes
        </h4>
        {content}
      </div>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={selectedCount > 0 ? "secondary" : "outline"}
          size="sm"
          className="h-7 gap-1.5 text-xs"
        >
          <UserIcon className="size-3" />
          Participantes
          {selectedCount > 0 && (
            <Badge className="h-4 min-w-4 px-1 text-[10px]">
              {selectedCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1.5" align="start">
        <p className="text-xs font-medium text-muted-foreground px-1 mb-1.5">
          Filtrar por participante
        </p>
        {content}
      </PopoverContent>
    </Popover>
  );
}
