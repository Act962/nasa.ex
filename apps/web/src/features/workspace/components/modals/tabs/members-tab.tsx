"use client";

import { AlertTriangle, UserPlusIcon, XIcon } from "lucide-react";
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
import { useOrgRole } from "@/hooks/use-org-role";
import { authClient } from "@/lib/auth-client";
import { useState } from "react";

export function MembersTab({ workspaceId }: { workspaceId: string }) {
  const { data: session } = authClient.useSession();
  const { isMaster, isAdmin } = useOrgRole();
  const [popoverOpen, setPopoverOpen] = useState<string | null>(null);

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

  if (isLoading)
    return <div className="p-4 text-sm">Carregando participantes...</div>;

  // Lógica de permissão: Dono do Workspace ou Admin/Owner da Organização
  const currentUserMember = currentMembers?.find(
    (m: any) => m.user.id === session?.user?.id,
  );
  const isWorkspaceOwner = currentUserMember?.role === "OWNER";
  const canManageMembers = isWorkspaceOwner || isMaster || isAdmin;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-y-3">
        <div className="text-center sm:text-left ">
          <h3 className="text-lg font-medium ">Participantes</h3>
          <p className="text-sm text-muted-foreground">
            Gerencie quem tem acesso a este workspace.
          </p>
        </div>

        {canManageMembers && (
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm">
                <UserPlusIcon className="size-4 mr-2" />
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
                      <p className="text-sm font-medium truncate">
                        {user.name}
                      </p>
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
        )}
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

              <Popover
                open={popoverOpen === member.id}
                onOpenChange={(open) => setPopoverOpen(open ? member.id : null)}
              >
                <PopoverTrigger asChild>
                  <Button
                    disabled={member.role === "OWNER" || !canManageMembers}
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <XIcon className="size-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-4" align="end">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-destructive font-semibold text-sm">
                      <AlertTriangle className="size-4" />
                      Remover membro?
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Tem certeza que deseja remover{" "}
                      <span className="font-bold text-foreground">
                        {member.user.name}
                      </span>{" "}
                      deste workspace?
                    </p>
                    <div className="flex justify-end gap-2 pt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs font-medium"
                        onClick={() => setPopoverOpen(null)}
                      >
                        Cancelar
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-8 text-xs font-medium"
                        disabled={removeMember.isPending}
                        onClick={() => {
                          removeMember.mutate(
                            {
                              workspaceId,
                              userId: member.user.id,
                            },
                            {
                              onSuccess: () => setPopoverOpen(null),
                            },
                          );
                        }}
                      >
                        {removeMember.isPending ? "Removendo..." : "Remover"}
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
