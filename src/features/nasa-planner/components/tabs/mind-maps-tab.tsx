"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { addDays, format, startOfWeek } from "date-fns";
import { CalendarRange, Network, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { useNasaPlannerMindMaps, useCreateMindMap, useDeleteMindMap } from "../../hooks/use-nasa-planner";
import { useCreateWeeklyMindMap } from "../../hooks/use-planner-weekly-mind-map";
import { WEEKLY_TEMPLATE } from "../../lib/mind-map/weekly-map";
import { MIND_MAP_TEMPLATES } from "../../constants";

/** Mapas mentais do planner: lista, novo mapa por modelo e "Planejar a semana" (spec 0068). */

type TemplateKey = (typeof MIND_MAP_TEMPLATES)[number]["key"];
type MindMapSummary = { id: string; name: string; template: string | null; updatedAt: Date | string; _count?: { cards: number } };

const SHEET_ON_MOBILE =
  "max-sm:top-auto max-sm:bottom-0 max-sm:max-w-full max-sm:translate-y-0 max-sm:rounded-t-[26px] max-sm:rounded-b-none max-sm:border-x-0 max-sm:border-b-0 max-sm:pb-[calc(1rem+env(safe-area-inset-bottom))] max-sm:data-[state=open]:slide-in-from-bottom max-sm:data-[state=open]:zoom-in-100";

export function MindMapsTab({ plannerId }: { plannerId: string }) {
  const router = useRouter();
  const { data: activeOrganization } = authClient.useActiveOrganization();
  const { mindMaps, isLoading } = useNasaPlannerMindMaps(plannerId);
  const createMindMap = useCreateMindMap();
  const createWeeklyMindMap = useCreateWeeklyMindMap();
  const deleteMindMap = useDeleteMindMap();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isWeeklyOpen, setIsWeeklyOpen] = useState(false);
  const [deleteMapId, setDeleteMapId] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateKey>("mindmap");
  const [mapName, setMapName] = useState("");

  const weekOptions = useMemo(() => {
    const thisMonday = addDays(startOfWeek(new Date(), { weekStartsOn: 0 }), 1);
    return [
      { label: "Esta semana", monday: thisMonday },
      { label: "Próxima semana", monday: addDays(thisMonday, 7) },
      { label: "Daqui a duas semanas", monday: addDays(thisMonday, 14) },
    ];
  }, []);

  const openMap = (mindMapId: string) => router.push(`/nasa-planner/${plannerId}/mindmap/${mindMapId}`);

  const handleCreate = async () => {
    if (!mapName.trim()) return;
    const result = await createMindMap.mutateAsync({ plannerId, name: mapName, template: selectedTemplate });
    setIsCreateOpen(false);
    setMapName("");
    setSelectedTemplate("mindmap");
    if (result?.mindMap?.id) openMap(result.mindMap.id);
  };

  const handleCreateWeekly = (weekMonday: Date) => {
    if (!activeOrganization?.id) return;
    createWeeklyMindMap.mutate(
      { plannerId, organizationId: activeOrganization.id, weekMonday },
      {
        onSuccess: (result) => {
          setIsWeeklyOpen(false);
          openMap(result.mindMap.id);
        },
        onError: (error) => toast.error(error.message || "Não deu para montar o mapa da semana."),
      },
    );
  };

  if (isLoading) {
    return (
      <div className="grid h-48 place-items-center">
        <OrbitaSpinner className="size-6" />
      </div>
    );
  }

  const templateByKey = Object.fromEntries(MIND_MAP_TEMPLATES.map((template) => [template.key, template]));
  const maps = mindMaps as MindMapSummary[];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-sm text-muted-foreground">
          {maps.length} mapa{maps.length === 1 ? "" : "s"}
        </p>
        <button
          type="button"
          data-guide={GUIDE_ANCHORS.plannerWeeklyMindMap.id}
          onClick={() => setIsWeeklyOpen(true)}
          className="inline-flex h-10 items-center gap-1.5 rounded-full bg-foreground px-4 text-sm font-semibold text-background max-sm:flex-1 max-sm:justify-center"
        >
          <CalendarRange className="size-4" /> Planejar a semana
        </button>
        <button type="button" onClick={() => setIsCreateOpen(true)} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-panel px-4 text-sm font-medium max-sm:flex-1 max-sm:justify-center">
          <Plus className="size-4" /> Novo mapa
        </button>
      </div>

      {maps.length === 0 ? (
        <div className="grid place-items-center gap-3 rounded-[22px] border border-dashed border-line px-4 py-12 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-muted">
            <Network className="size-5 text-muted-foreground" />
          </span>
          <p className="max-w-xs text-sm text-muted-foreground">Nenhum mapa ainda. Comece por &ldquo;Planejar a semana&rdquo;: o mapa já vem com os dias, os temas e os posts do roteiro.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
          {maps.map((map) => {
            const isWeekly = map.template === WEEKLY_TEMPLATE;
            const template = templateByKey[map.template ?? ""] ?? templateByKey.mindmap;
            const MapIcon = isWeekly ? CalendarRange : template.icon;
            return (
              <div key={map.id} role="button" tabIndex={0} onClick={() => openMap(map.id)} onKeyDown={(event) => event.key === "Enter" && openMap(map.id)} className="group flex cursor-pointer items-center gap-3 rounded-[20px] bg-card p-3 hover:bg-panel">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-info/15">
                  <MapIcon className="size-4.5 text-info" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{map.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {isWeekly ? "Planejamento semanal" : template.label} · atualizado {format(new Date(map.updatedAt), "dd/MM")}
                  </span>
                </span>
                <button
                  type="button"
                  aria-label="Excluir mapa"
                  onClick={(event) => {
                    event.stopPropagation();
                    setDeleteMapId(map.id);
                  }}
                  className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive md:opacity-0 md:group-hover:opacity-100"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={isWeeklyOpen} onOpenChange={setIsWeeklyOpen}>
        <DialogContent className={cn("rounded-[22px] sm:max-w-sm", SHEET_ON_MOBILE)}>
          <DialogHeader className="text-left">
            <DialogTitle>Planejar a semana</DialogTitle>
            <DialogDescription>
              O mapa nasce com segunda a domingo, o tema de cada dia e os posts que já estão no roteiro{activeOrganization?.name ? ` de ${activeOrganization.name}` : ""}. Depois é só acrescentar cards, links e notas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            {weekOptions.map((option) => (
              <button
                key={option.label}
                type="button"
                disabled={createWeeklyMindMap.isPending}
                onClick={() => handleCreateWeekly(option.monday)}
                className="flex h-12 w-full items-center justify-between rounded-full bg-panel px-4 text-sm hover:bg-knob/60 disabled:opacity-50"
              >
                <span className="font-semibold">{option.label}</span>
                <span className="text-xs text-muted-foreground">
                  {format(option.monday, "dd/MM")} a {format(addDays(option.monday, 6), "dd/MM")}
                </span>
              </button>
            ))}
            {createWeeklyMindMap.isPending && (
              <p className="flex items-center justify-center gap-2 pt-1 text-xs text-muted-foreground">
                <OrbitaSpinner className="size-3.5" /> Montando o mapa…
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className={cn("rounded-[22px] sm:max-w-md", SHEET_ON_MOBILE)}>
          <DialogHeader className="text-left">
            <DialogTitle>Novo mapa</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Nome. Ex.: Estratégia de conteúdo" value={mapName} onChange={(event) => setMapName(event.target.value)} className="h-11 rounded-full text-base sm:text-sm" />
            <div className="grid grid-cols-2 gap-2">
              {MIND_MAP_TEMPLATES.map(({ key, label, icon: TemplateIcon, description }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedTemplate(key)}
                  className={cn("rounded-[18px] p-3 text-left ring-1 transition", selectedTemplate === key ? "bg-info/15 ring-info" : "bg-panel ring-transparent")}
                >
                  <TemplateIcon className="mb-1.5 size-5 text-info" />
                  <p className="text-sm font-medium">{label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
                </button>
              ))}
            </div>
            <button type="button" onClick={() => void handleCreate()} disabled={!mapName.trim() || createMindMap.isPending} className="h-11 w-full rounded-full bg-foreground text-sm font-semibold text-background disabled:opacity-40">
              {createMindMap.isPending ? "Criando…" : "Criar mapa"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteMapId)} onOpenChange={() => setDeleteMapId(null)}>
        <AlertDialogContent className="rounded-[22px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir mapa</AlertDialogTitle>
            <AlertDialogDescription>O mapa e os cards de ação dele são apagados. Os posts do Planner continuam onde estão.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteMapId) deleteMindMap.mutate({ mindMapId: deleteMapId });
                setDeleteMapId(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
