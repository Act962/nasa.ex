import { useMemo, useState } from "react";
import {
  UserPlusIcon,
  XIcon,
  CheckIcon,
  UsersIcon,
  SearchIcon,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SidebarField } from "./sidebar-field";
import { Action } from "../../../types";

interface ParticipantsFieldProps {
  participants?: Action["participants"];
  members: any[];
  onToggle: (userId: string) => void;
  isAdding: boolean;
  isRemoving: boolean;
}

export function ParticipantsField({
  participants = [],
  members,
  onToggle,
  isAdding,
  isRemoving,
}: ParticipantsFieldProps) {
  const [search, setSearch] = useState("");

  const allSelected =
    members.length > 0 &&
    members.every((m: any) =>
      participants.some((p: any) => p.user.id === m.user.id),
    );
  // "Selecionar todos" dispara `onToggle` apenas pros membros que ainda não
  // são participantes; "Limpar" idem pros que SÃO. Como `onToggle` faz
  // add-or-remove, esta é a única forma sem mudar a API do componente.
  const handleSelectAll = () => {
    if (isAdding || isRemoving) return;
    if (allSelected) {
      for (const m of members as any[]) {
        if (participants.some((p: any) => p.user.id === m.user.id)) {
          onToggle(m.user.id);
        }
      }
    } else {
      for (const m of members as any[]) {
        if (!participants.some((p: any) => p.user.id === m.user.id)) {
          onToggle(m.user.id);
        }
      }
    }
  };

  // Filtra por nome e ordena alfabeticamente, priorizando os já selecionados.
  const sortedMembers = useMemo(() => {
    const query = search.trim().toLowerCase();
    const isSelected = (m: any) =>
      participants.some((p: any) => p.user.id === m.user.id);

    return [...members]
      .filter((m: any) =>
        query ? (m.user.name ?? "").toLowerCase().includes(query) : true,
      )
      .sort((a: any, b: any) => {
        const aSel = isSelected(a);
        const bSel = isSelected(b);
        if (aSel !== bSel) return aSel ? -1 : 1;
        return (a.user.name ?? "").localeCompare(b.user.name ?? "", "pt-BR", {
          sensitivity: "base",
        });
      });
  }, [members, participants, search]);

  return (
    <SidebarField label="Participantes">
      <div className="space-y-1.5">
        {participants.map((r: any) => (
          <div key={r.user.id} className="flex items-center gap-2 group">
            <Avatar className="size-6 shrink-0">
              <AvatarImage src={r.user.image ?? undefined} />
              <AvatarFallback className="text-xs">
                {r.user.name?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs flex-1 truncate">{r.user.name}</span>
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
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="text-xs font-medium text-muted-foreground">
                Membros do workspace
              </p>
              {members.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1 px-1.5 text-[10px]"
                  onClick={handleSelectAll}
                  disabled={isAdding || isRemoving}
                >
                  <UsersIcon className="size-3" />
                  {allSelected ? "Limpar" : "Selecionar todos"}
                </Button>
              )}
            </div>

            <div className="relative mb-2">
              <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome..."
                className="h-7 pl-7 text-xs"
              />
            </div>

            <div
              className="scroll-cols-tracking h-48 space-y-0.5 overflow-y-auto"
              onWheel={(e) => {
                e.stopPropagation();
              }}
            >
              {sortedMembers.length === 0 ? (
                <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                  Nenhum membro encontrado
                </p>
              ) : (
                sortedMembers.map((m: any) => {
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
                        <AvatarImage src={m.user.image ?? undefined} />
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
                })
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </SidebarField>
  );
}
