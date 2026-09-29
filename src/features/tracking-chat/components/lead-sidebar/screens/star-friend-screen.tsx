"use client";

import Link from "next/link";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LeadStarFriendsCard } from "@/features/star-friends/components/lead-star-friends-card";
import { useStarFriendsByLead, useStarFriendsOverview } from "@/features/star-friends/hooks/use-star-friends";
import { useStarFriendsPermissions } from "@/features/star-friends/hooks/use-star-friends-permissions";

function EmptyState({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center text-muted-foreground">
      <Sparkles className="size-8 text-amber-500" />
      <p className="max-w-64 text-sm">{message}</p>
      {action}
    </div>
  );
}

export function StarFriendScreen({ leadId }: { leadId: string }) {
  const overview = useStarFriendsOverview();
  const starFriends = useStarFriendsByLead(leadId);
  const permissions = useStarFriendsPermissions();

  if (overview.isLoading || starFriends.isLoading || permissions.isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!permissions.canView) {
    return <EmptyState message="Você não tem permissão para ver o STAR FRIENDS. Peça acesso ao administrador da empresa." />;
  }
  if (!overview.data?.isInstalled) {
    return (
      <EmptyState
        message="O programa de fidelidade ainda não foi instalado. Com ele, cada compra paga vira stars que o cliente troca por prêmios."
        action={
          permissions.canConfigure ? (
            <Button asChild size="sm">
              <Link href="/star-friends">Instalar STAR FRIENDS</Link>
            </Button>
          ) : undefined
        }
      />
    );
  }
  if (!starFriends.data?.isActive) {
    return (
      <EmptyState
        message="O STAR FRIENDS está pausado. Reative em STAR FRIENDS → Configurações para o cliente voltar a ganhar e trocar stars."
        action={
          <Button asChild size="sm" variant="outline">
            <Link href="/star-friends">Abrir STAR FRIENDS</Link>
          </Button>
        }
      />
    );
  }
  return <LeadStarFriendsCard leadId={leadId} />;
}
