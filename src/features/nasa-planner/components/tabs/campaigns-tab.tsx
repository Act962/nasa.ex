"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  PlusIcon, RocketIcon, CalendarIcon, CheckSquareIcon,
  ImageIcon, Trash2Icon, ChevronRightIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { useDeleteCampaign } from "../../hooks/use-campaign-planner";
import { CampaignPlannerWizard } from "../campaign-planner-wizard";
import { useNasaPlanner } from "../../hooks/use-nasa-planner";

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  DRAFT: { label: "Rascunho", variant: "secondary" },
  ACTIVE: { label: "Ativa", variant: "default" },
  PAUSED: { label: "Pausada", variant: "outline" },
  COMPLETED: { label: "Concluída", variant: "outline" },
  CANCELLED: { label: "Cancelada", variant: "destructive" },
};

export function CampaignsTab({ plannerId }: { plannerId: string }) {
  const router = useRouter();
  const { planner } = useNasaPlanner(plannerId);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const deleteCampaign = useDeleteCampaign();

  const { data, isLoading } = useQuery(
    orpc.nasaPlanner.campaigns.list.queryOptions({ input: { plannerId } }),
  );
  const campaigns = data?.campaigns ?? [];

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteCampaign.mutateAsync({ campaignId: deleteId });
    setDeleteId(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
        <div>
          <h2 className="font-semibold text-base">Campanhas</h2>
          <p className="text-xs text-muted-foreground">{campaigns.length} campanha{campaigns.length !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={() => setWizardOpen(true)} className="gap-2" size="sm">
          <PlusIcon className="size-4" />
          Planejar Campanha
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
          </div>
        ) : campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="size-16 rounded-2xl bg-muted flex items-center justify-center">
              <RocketIcon className="size-8 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-lg">Nenhuma campanha</p>
              <p className="text-muted-foreground text-sm mt-1">Crie a primeira campanha deste planner</p>
            </div>
            <Button onClick={() => setWizardOpen(true)} className="gap-2">
              <PlusIcon className="size-4" />
              Planejar Campanha
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {campaigns.map((campaign: any) => {
              const statusInfo = STATUS_LABELS[campaign.status] ?? { label: campaign.status, variant: "secondary" as const };
              const nextEvent = campaign.events?.[0];
              return (
                <Card
                  key={campaign.id}
                  className="group cursor-pointer hover:shadow-md transition-all border hover:border-violet-300 dark:hover:border-violet-700"
                  onClick={() => router.push(`/nasa-planner/campanhas/${campaign.id}`)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="size-3 rounded-full shrink-0 mt-0.5"
                          style={{ backgroundColor: campaign.color ?? "#7c3aed" }}
                        />
                        <CardTitle className="text-sm line-clamp-2 leading-snug">{campaign.title}</CardTitle>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive shrink-0"
                        onClick={(e) => { e.stopPropagation(); setDeleteId(campaign.id); }}
                      >
                        <Trash2Icon className="size-4" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={statusInfo.variant} className="text-xs">{statusInfo.label}</Badge>
                      {campaign.campaignType && (
                        <span className="text-xs text-muted-foreground truncate">{campaign.campaignType}</span>
                      )}
                    </div>
                    {campaign.description && (
                      <CardDescription className="text-xs line-clamp-2 mt-1">{campaign.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="pt-0">
                    {nextEvent && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                        <CalendarIcon className="size-3 shrink-0" />
                        <span className="truncate">
                          {new Date(nextEvent.scheduledAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} — {nextEvent.title}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CalendarIcon className="size-3" />
                        {campaign._count?.events ?? 0} eventos
                      </span>
                      <span className="flex items-center gap-1">
                        <CheckSquareIcon className="size-3" />
                        {campaign._count?.tasks ?? 0} tarefas
                      </span>
                      <span className="flex items-center gap-1">
                        <ImageIcon className="size-3" />
                        {campaign._count?.brandAssets ?? 0} materiais
                      </span>
                    </div>
                    <div className="mt-2 flex justify-end">
                      <span className="text-xs text-violet-600 flex items-center gap-0.5">
                        Abrir <ChevronRightIcon className="size-3" />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Wizard */}
      <CampaignPlannerWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        plannerId={plannerId}
        plannerClientName={planner?.clientOrgName ?? undefined}
        plannerOrgProjectId={planner?.orgProjectId ?? undefined}
      />

      {/* Delete */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Campanha</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os eventos, tarefas e materiais desta campanha serão excluídos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
