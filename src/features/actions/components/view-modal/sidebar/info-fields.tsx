import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SidebarField } from "./sidebar-field";
import { Action } from "../../../types";

interface InfoFieldsProps {
  user?: Action["user"];
  createdAt?: Date;
}

export function InfoFields({ user, createdAt }: InfoFieldsProps) {
  return (
    <>
      <SidebarField label="Criado por">
        <div className="flex items-center gap-2">
          <Avatar className="size-6 shrink-0">
            <AvatarImage src={user?.image ?? undefined} />
            <AvatarFallback className="text-xs">
              {user?.name?.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs text-muted-foreground truncate">
            {user?.name}
          </span>
        </div>
      </SidebarField>

      {createdAt && (
        <SidebarField label="Criado em">
          <span className="text-xs text-muted-foreground">
            {format(new Date(createdAt), "dd MMM yyyy", {
              locale: ptBR,
            })}
          </span>
        </SidebarField>
      )}
    </>
  );
}
