import { UserPlusIcon, XIcon, CheckIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SidebarField } from "./sidebar-field";
import { Action } from "../../../types";

interface ResponsibleFieldProps {
  participants?: Action["participants"];
  members: any[];
  onToggle: (userId: string) => void;
  isAdding: boolean;
  isRemoving: boolean;
}

export function ResponsibleField({
  participants = [],
  members,
  onToggle,
  isAdding,
  isRemoving,
}: ResponsibleFieldProps) {
  return (
    <SidebarField label="Responsáveis">
      <div className="space-y-1.5">
        {participants.map((r: any) => (
          <div
            key={r.user.id}
            className="flex items-center gap-2 group"
          >
            <Avatar className="size-6 shrink-0">
              <AvatarImage src={r.user.image ?? undefined} />
              <AvatarFallback className="text-xs">
                {r.user.name?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs flex-1 truncate">
              {r.user.name}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              onClick={() => onToggle(r.user.id)}
              disabled={isRemoving}
            >
              <XIcon className="size-3" />
            </Button>
          </div>
        ))}

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-full text-xs gap-1.5 bg-background"
            >
              <UserPlusIcon className="size-3.5" />
              Atribuir responsável
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="start">
            <p className="text-xs font-medium text-muted-foreground mb-2 px-1">
              Membros do workspace
            </p>
            <div className="space-y-0.5">
              {members.map((m: any) => {
                const isResponsible = participants.some(
                  (r: any) => r.user.id === m.user.id,
                );
                return (
                  <button
                    key={m.user.id}
                    className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 hover:bg-muted transition-colors text-left"
                    onClick={() => onToggle(m.user.id)}
                    disabled={isAdding || isRemoving}
                  >
                    <Avatar className="size-6 shrink-0">
                      <AvatarImage
                        src={m.user.image ?? undefined}
                      />
                      <AvatarFallback className="text-xs">
                        {m.user.name?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs flex-1 truncate">
                      {m.user.name}
                    </span>
                    {isResponsible && (
                      <CheckIcon className="size-3.5 text-primary shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </SidebarField>
  );
}
