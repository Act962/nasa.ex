"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { LeadInfo } from "./lead-info";
import { LeadFull } from "@/types/lead";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useRegisterOrbitDock } from "@/components/orbit-dock/orbit-dock-store";
import {
  ClipboardListIcon,
  EditIcon,
  FileIcon,
  FileSignature,
  Megaphone,
  RouteIcon,
  ShoppingBasket,
  StickyNoteIcon,
  UserRoundIcon,
} from "lucide-react";
import { LeadContracts } from "./lead-contracts";
import { LeadTrafegoTab } from "@/features/trafego/components/ops/lead-trafego-tab";
// Importado de propósito sem uso: a aba "Tarefas" (TabNotes) existe e o
// backend do vínculo Action↔Lead funciona, mas o layout foi reprovado e a aba
// saiu até o redesenho. Ver docs/workspace-actions-overview.md §5, Fase 3.2 —
// pra religar, basta voltar a entrada no array `tabs` abaixo.
import { TabNotes } from "./notes";
import { LeadAttachmentsByFolder } from "./lead-files/lead-attachments-by-folder";
import { ObservationLead } from "./observations";
import { JourneyTimeline } from "./journey-timeline";
import { LeadFormResponses } from "./lead-form-responses";
import { LeadProducts } from "./lead-products";
import { LeadStarFriendsCard } from "@/features/star-friends/components/lead-star-friends-card";
import { useCheckPermission } from "@/hooks/use-check-permission";
import { leadProductsQueryKey } from "../hooks/use-lead-products";
import { pusherClient } from "@/lib/pusher";
import { orpc } from "@/lib/orpc";
import { cn } from "@/lib/utils";

const DOCK_TAB_VALUES = ["observations", "journey", "files", "forms"];

interface LeadDatailsProps {
  initialData: LeadFull;
}

export function LeadDetails({ initialData }: LeadDatailsProps) {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const leadId = initialData.lead.id;
  // Aceita `?tab=<value>` pra deep-link na tab desejada (ex: o ícone
  // branco de form no card do kanban leva pra `/contatos/<id>?tab=forms`).
  const tabFromUrl = searchParams?.get("tab") ?? null;

  // Real-time: assina o canal interno do lead pra que tags, status,
  // jornada e respostas de formulário atualizem sem F5. O servidor
  // dispara `update` no canal `lead-internal-<id>` em todo update via
  // `notifyInternalLeadChannel` (chamado em recordLeadEvent + leads/update).
  // Invalida as queries que cobrem a UI atual.
  useEffect(() => {
    if (!leadId) return;
    const channel = pusherClient.subscribe(`lead-internal-${leadId}`);
    const handler = () => {
      queryClient.invalidateQueries({
        queryKey: orpc.leads.get.queryKey({ input: { id: leadId } }),
      });
      queryClient.invalidateQueries({
        queryKey: orpc.leads.getJourney.queryKey({ input: { leadId } }),
      });
      queryClient.invalidateQueries({
        queryKey: orpc.leads.listFormResponses.queryKey({ input: { leadId } }),
      });
      queryClient.invalidateQueries({
        queryKey: leadProductsQueryKey(leadId),
      });
      // tags do lead — view list e dropdown lateral
      queryClient.invalidateQueries({ queryKey: orpc.leads.list.queryKey() });
    };
    channel.bind("update", handler);
    return () => {
      channel.unbind("update", handler);
      pusherClient.unsubscribe(`lead-internal-${leadId}`);
    };
  }, [leadId, queryClient]);
  const { checkPermission } = useCheckPermission();
  const canViewProducts = checkPermission("lead-produtos", "canView");

  const allTabs = [
    {
      name: "Observações",
      value: "observations",
      icon: EditIcon,
      content: (
        <ObservationLead
          leadId={initialData.lead.id}
          trackingId={initialData.lead.trackingId}
          description={initialData.lead.description}
        />
      ),
    },
    {
      name: "Jornada",
      value: "journey",
      icon: RouteIcon,
      content: <JourneyTimeline leadId={initialData.lead.id} />,
    },
    {
      name: "Arquivos",
      value: "files",
      icon: FileIcon,
      content: <LeadAttachmentsByFolder leadId={initialData.lead.id} />,
    },
    {
      name: "Formulários",
      value: "forms",
      icon: ClipboardListIcon,
      content: (
        <LeadFormResponses
          leadId={initialData.lead.id}
          trackingId={initialData.lead.trackingId}
        />
      ),
    },
    {
      name: "Contratos",
      value: "contracts",
      icon: FileSignature,
      content: <LeadContracts leadId={initialData.lead.id} />,
    },
    {
      name: "Produtos/Serviços",
      value: "products",
      icon: ShoppingBasket,
      content: (
        <LeadProducts
          leadId={initialData.lead.id}
          starFriendsSlot={<LeadStarFriendsCard leadId={initialData.lead.id} />}
        />
      ),
    },
    {
      // Só rende conteúdo quando o lead é do tracking do trafeGO; nos demais a
      // aba mostra uma linha explicando. Manter fixa evita um layout que muda
      // de forma conforme o lead aberto.
      name: "trafeGO",
      value: "trafego",
      icon: Megaphone,
      content: <LeadTrafegoTab leadId={initialData.lead.id} />,
    },
  ];
  const tabs = allTabs.filter((tab) => tab.value !== "products" || canViewProducts);
  const [activeTab, setActiveTab] = useState(
    tabFromUrl && tabs.some((tab) => tab.value === tabFromUrl) ? tabFromUrl : tabs[0].value,
  );

  // No celular, as quatro abas principais vão para o dock em órbita e saem da lista de cima.
  const toDockItem = (tabValue: string) => {
    const tab = allTabs.find((candidate) => candidate.value === tabValue)!;
    const TabIcon = tab.icon;
    return {
      label: tab.name,
      icon: <TabIcon />,
      isActive: activeTab === tab.value,
      onSelect: () => setActiveTab(tab.value),
    };
  };
  useRegisterOrbitDock({
    leftItems: [toDockItem("observations"), toDockItem("journey")],
    rightItems: [toDockItem("files"), toDockItem("forms")],
  });

  const leadInitial = (initialData.lead.name || "?").trim().charAt(0).toUpperCase();

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      {/* Celular: cabeçalho do lead; os dados completos abrem num sheet. */}
      <header className="flex items-center gap-3 px-3 py-3 sm:hidden">
        <SidebarTrigger className="shrink-0" />
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-knob text-sm font-semibold">
          {leadInitial}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {initialData.lead.name || "Sem nome"}
          </p>
          {initialData.lead.phone && (
            <p className="truncate text-xs text-muted-foreground">
              {initialData.lead.phone}
            </p>
          )}
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="shrink-0">
              <UserRoundIcon className="size-4" />
              Dados
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="overflow-y-auto">
            <LeadInfo initialData={initialData} className="w-full" />
          </SheetContent>
        </Sheet>
      </header>

      <aside className="min-w-0 flex-1 overflow-hidden px-3 sm:px-8">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="mt-3 flex h-full w-full flex-col gap-4 pb-8 sm:mt-8"
        >
          <TabsList className="w-full shrink-0 justify-start gap-1 overflow-x-auto bg-muted/20 p-0 [scrollbar-width:none] sm:justify-center">
            {tabs.map(({ icon: Icon, name, value }) => (
              <TabsTrigger
                key={value}
                value={value}
                className={cn(
                  "shrink-0 px-3 sm:w-full sm:shrink",
                  DOCK_TAB_VALUES.includes(value) && "max-lg:hidden",
                )}
              >
                <Icon className="size-4" />
                {name}
              </TabsTrigger>
            ))}
          </TabsList>

          {tabs.map((tab) => (
            <TabsContent
              key={tab.value}
              value={tab.value}
              className="min-w-0 flex-1 overflow-y-auto sm:overflow-hidden"
            >
              {tab.content}
            </TabsContent>
          ))}
        </Tabs>
      </aside>
    </div>
  );
}
