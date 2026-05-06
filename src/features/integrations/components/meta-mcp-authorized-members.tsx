"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Crown, Shield, ShieldCheck } from "lucide-react";

const ROLE_LABEL: Record<string, string> = {
  owner: "Master",
  moderador: "Moderador",
  admin: "Adm",
  member: "Single",
};

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * Tabela de membros da org com toggle pra autorizar/revogar uso do Astro
 * Meta Ads. Owner e Moderador aparecem sempre marcados como autorizados
 * (implícito por role) e o toggle fica disabled.
 */
export function MetaMcpAuthorizedMembers() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery(
    orpc.metaMcp.listMembersWithAuth.queryOptions({}),
  );

  const grantMutation = useMutation({
    ...orpc.metaMcp.grantAuth.mutationOptions(),
    onSuccess: () => {
      toast.success("Membro autorizado");
      queryClient.invalidateQueries({ queryKey: ["metaMcp"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const revokeMutation = useMutation({
    ...orpc.metaMcp.revokeAuth.mutationOptions(),
    onSuccess: () => {
      toast.success("Autorização revogada");
      queryClient.invalidateQueries({ queryKey: ["metaMcp"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (isLoading) {
    return (
      <div className="space-y-2 pt-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  const members = data?.members ?? [];
  if (members.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-4 text-center">
        Sem membros nesta organização.
      </p>
    );
  }

  return (
    <div className="space-y-2 pt-2">
      <p className="text-xs text-muted-foreground">
        Master e Moderador são autorizados automaticamente. Admins e members
        precisam de aprovação explícita.
      </p>
      <div className="rounded-md border divide-y">
        {members.map((m) => {
          const isImplicit = m.authorizationSource === "role";
          const handleToggle = (checked: boolean) => {
            if (isImplicit) return;
            if (checked) grantMutation.mutate({ userId: m.userId });
            else revokeMutation.mutate({ userId: m.userId });
          };
          const RoleIcon =
            m.role === "owner" ? Crown : m.role === "moderador" ? ShieldCheck : Shield;
          return (
            <div
              key={m.userId}
              className="flex items-center gap-3 p-2.5 hover:bg-muted/30"
            >
              <Avatar className="size-8 shrink-0">
                <AvatarImage src={m.image ?? ""} alt={m.name} />
                <AvatarFallback className="text-[10px]">
                  {initials(m.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{m.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {m.email}
                </p>
                {m.authorizedAt && !isImplicit && (
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                    Liberado por {m.authorizedByName ?? "—"} em{" "}
                    {new Date(m.authorizedAt).toLocaleDateString("pt-BR")}
                  </p>
                )}
              </div>
              <Badge variant="outline" className="text-[10px] gap-1 shrink-0">
                <RoleIcon className="size-3" />
                {ROLE_LABEL[m.role] ?? m.role}
              </Badge>
              <div className="shrink-0">
                <Switch
                  checked={m.authorized}
                  onCheckedChange={handleToggle}
                  disabled={
                    isImplicit ||
                    grantMutation.isPending ||
                    revokeMutation.isPending
                  }
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
