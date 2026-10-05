"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ClientAvatar } from "./client-avatar";
import type { PlannerClient } from "./planner-v2-types";

/**
 * Campanhas e Mapas Mentais trabalham na empresa ativa da sessão. Escolher outro cliente aqui troca a
 * empresa ativa (como o seletor da barra lateral) e mostra o planner padrão dela.
 */
export function ClientWorkspaceTab({ clients, children }: { clients: PlannerClient[]; children: (plannerId: string) => ReactNode }) {
  const { data: activeOrganization, isPending } = authClient.useActiveOrganization();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [switchingToId, setSwitchingToId] = useState<string | null>(null);
  const activeClientIndex = clients.findIndex((client) => client.id === activeOrganization?.id);
  const activeClient = clients[activeClientIndex];

  const switchClient = async (client: PlannerClient) => {
    if (client.id === activeOrganization?.id || switchingToId) return;
    setSwitchingToId(client.id);
    try {
      const { error } = await authClient.organization.setActive({ organizationId: client.id });
      if (error) {
        toast.error("Não deu para trocar de cliente.");
        return;
      }
      router.refresh();
      await queryClient.resetQueries();
      toast.success(`Agora você está em ${client.name}`);
    } finally {
      setSwitchingToId(null);
    }
  };

  if (isPending) return <OrbitaSpinner className="mx-auto my-16 size-6" />;
  return (
    <div className="space-y-3">
      {clients.length > 1 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="inline-flex items-center gap-2 rounded-full bg-panel py-1 pr-3 pl-1.5 text-sm">
              {activeClient && <ClientAvatar name={activeClient.name} logo={activeClient.logo} clientIndex={activeClientIndex} />}
              Cliente: <span className="font-semibold">{activeClient?.name ?? activeOrganization?.name ?? "—"}</span>
              {switchingToId ? <OrbitaSpinner className="size-3.5" /> : <ChevronDown className="size-3.5 text-muted-foreground" />}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64 rounded-[18px] p-1.5">
            {clients.map((client, clientIndex) => (
              <DropdownMenuItem key={client.id} onSelect={() => void switchClient(client)} className="gap-2 rounded-xl py-2">
                <ClientAvatar name={client.name} logo={client.logo} clientIndex={clientIndex} />
                <span className="min-w-0 flex-1 truncate">{client.name}</span>
                {client.id === activeOrganization?.id && <Check className="size-4" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {activeClient?.defaultPlannerId ? (
        children(activeClient.defaultPlannerId)
      ) : (
        <div className="rounded-[20px] bg-card p-8 text-center text-sm text-muted-foreground">
          {activeClient ? "Este cliente ainda não tem planner." : "A empresa ativa não está entre os seus clientes do Planner."}{" "}
          <Link href="/nasa-planner/planners" className="font-semibold text-foreground underline">
            Abrir planners
          </Link>
        </div>
      )}
    </div>
  );
}
