"use client";

import { X, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";
import {
  useWorkspaceMembers,
  useAddWorkspaceMember,
  useRemoveWorkspaceMember,
} from "@/features/workspace/hooks/use-workspace";

export function MembersTab({ workspaceId }: { workspaceId: string }) {
  const { members: currentMembers, isLoading } =
    useWorkspaceMembers(workspaceId);
  const addMember = useAddWorkspaceMember();
  const removeMember = useRemoveWorkspaceMember();

  const { data: orgData } = useQuery(
    orpc.orgs.listMembers.queryOptions({
      input: {
        query: { userIds: currentMembers?.map((m: any) => m.user.id) || [] },
      },
    }),
  );

  const availableMembers = orgData?.members || [];

  if (isLoading) return <div>Carregando participantes...</div>;

  return (
    <div className="max-w-2xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Participantes</h3>
          <p className="text-sm text-muted-foreground">
            Gerencie quem tem acesso a este workspace.
          </p>
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm">
              <UserPlus className="size-4 mr-2" />
              Convidar Membro
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            <div className="p-3 border-b">
              <h4 className="font-medium text-sm">Membros da Organização</h4>
              <p className="text-xs text-muted-foreground">
                Selecione para adicionar ao workspace
              </p>
            </div>
            <div className="max-h-[300px] overflow-y-auto p-1">
              {availableMembers.map((user: any) => (
                <button
                  key={user.id}
                  onClick={() =>
                    addMember.mutate({ workspaceId, userId: user.id })
                  }
                  disabled={addMember.isPending}
                  className="flex items-center gap-2 w-full p-2 hover:bg-muted rounded-md transition-colors text-left"
                >
                  <Avatar className="size-8">
                    <AvatarImage src={user.image} />
                    <AvatarFallback>{user.name[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {user.email}
                    </p>
                  </div>
                </button>
              ))}
              {availableMembers.length === 0 && (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  Todos os membros já estão no workspace.
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="space-y-4 ">
        {currentMembers.map((member: any) => (
          <div
            key={member.id}
            className="flex items-center justify-between p-3 border rounded-lg bg-background group overflow-x-auto gap-x-4"
          >
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarImage src={member.user.image} />
                <AvatarFallback>{member.user.name[0]}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{member.user.name}</p>
                <p className="text-xs text-muted-foreground">
                  {member.user.email}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground px-2 py-0.5 bg-muted rounded">
                {member.role === "OWNER" ? "Proprietário" : "Membro"}
              </span>
              {member.role !== "OWNER" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => {
                    if (
                      confirm(
                        `Deseja remover ${member.user.name} deste workspace?`,
                      )
                    ) {
                      removeMember.mutate({
                        workspaceId,
                        userId: member.user.id,
                      });
                    }
                  }}
                >
                  <X className="size-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
