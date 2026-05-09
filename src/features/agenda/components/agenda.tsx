"use client";

import {
  useDeleteAgenda,
  useDuplicateAgenda,
  useQueryAppointmentsByOrg,
  useSuspenseAgendas,
  useToggleActiveAgenda,
} from "../hooks/use-agenda";
import { useState } from "react";
import { CreateAgendaModal } from "./create-agenda-modal";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  ArrowUpRight,
  CalendarIcon,
  CopyIcon,
  EditIcon,
  EllipsisIcon,
  LinkIcon,
  PanelLeftClose,
  PanelLeftOpen,
  PlusIcon,
  TrashIcon,
} from "lucide-react";
import { AgendaMonthCalendar } from "./agenda-month-calendar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { DeleteAgendaModal } from "./delete-agenda-modal";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const SIDEBAR_PALETTE = [
  "#7c3aed",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#84cc16",
  "#f97316",
  "#ec4899",
  "#14b8a6",
  "#a855f7",
];

interface AgendaSummary {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  slotDuration: number;
  slug: string;
}

export const AgendaList = () => {
  const [open, setOpen] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);
  const [agendaId, setAgendaId] = useState<string | null>(null);
  const { appointments, isLoading: isLoadingAppointments } =
    useQueryAppointmentsByOrg();
  // Sidebar inicia retraída — usuário expande clicando no botão
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { data } = useSuspenseAgendas();
  const duplicateAgenda = useDuplicateAgenda();
  const deleteAgenda = useDeleteAgenda();

  const baseUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/agenda/${data?.organization?.slug}`;

  const handleCopyLink = (agendaSlug: string) => {
    navigator.clipboard.writeText(`${baseUrl}/${agendaSlug}`);
    toast.success("Link copiado para a área de transferência", {
      position: "bottom-center",
    });
  };

  const handleDuplicateAgenda = (id: string) => {
    duplicateAgenda.mutate({ agendaId: id });
  };

  const handleDeleteAgenda = (id: string) => {
    deleteAgenda.mutate({ agendaId: id });
    setOpenDelete(false);
  };

  const summaries: AgendaSummary[] = data.agendas;

  return (
    <div className="flex h-[calc(100vh-12rem)] min-h-[600px] w-full flex-col gap-4 lg:flex-row">
      {/* Sidebar de agendas — retrátil */}
      <aside
        className={cn(
          "flex w-full shrink-0 flex-col gap-3 transition-[width,padding] duration-200 lg:overflow-hidden",
          sidebarOpen
            ? "lg:w-[300px] lg:border-r lg:pr-4"
            : "lg:w-9 lg:border-r lg:pr-0",
        )}
      >
        <div className="flex items-center justify-between gap-2">
          {sidebarOpen ? (
            <>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold">Minhas agendas</h2>
                <p className="text-xs text-muted-foreground">
                  {summaries.length}{" "}
                  {summaries.length === 1 ? "agenda" : "agendas"}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" onClick={() => setOpen(true)}>
                  <PlusIcon className="size-4" />
                  Nova
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="hidden size-8 lg:inline-flex"
                  onClick={() => setSidebarOpen(false)}
                  title="Recolher agendas"
                >
                  <PanelLeftClose className="size-4" />
                </Button>
              </div>
            </>
          ) : (
            <Button
              size="icon"
              variant="ghost"
              className="hidden size-8 lg:inline-flex"
              onClick={() => setSidebarOpen(true)}
              title="Mostrar agendas"
            >
              <PanelLeftOpen className="size-4" />
            </Button>
          )}
        </div>

        {sidebarOpen &&
          (summaries.length === 0 ? (
            <Empty className="border border-dashed">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <CalendarIcon />
                </EmptyMedia>
                <EmptyTitle>Nenhuma agenda ainda</EmptyTitle>
                <EmptyDescription>
                  Crie uma agenda para capturar leads.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button onClick={() => setOpen(true)}>Criar agenda</Button>
              </EmptyContent>
            </Empty>
          ) : (
            <div className="flex max-h-full flex-col gap-2 overflow-y-auto pr-1">
              {summaries.map((agenda, idx) => (
                <AgendaSidebarItem
                  key={agenda.id}
                  agenda={agenda}
                  color={SIDEBAR_PALETTE[idx % SIDEBAR_PALETTE.length]}
                  baseUrl={baseUrl}
                  onCopyLink={handleCopyLink}
                  onDuplicate={handleDuplicateAgenda}
                  onAskDelete={(id) => {
                    setAgendaId(id);
                    setOpenDelete(true);
                  }}
                />
              ))}
            </div>
          ))}
      </aside>

      {/* Calendário principal */}
      <main className="relative flex min-w-0 flex-1 flex-col rounded-xl border bg-card/30">
        <AgendaMonthCalendar
          agendas={summaries}
          appointments={appointments as Parameters<typeof AgendaMonthCalendar>[0]["appointments"]}
          isLoading={isLoadingAppointments}
        />
      </main>

      {openDelete && agendaId && (
        <DeleteAgendaModal
          open={openDelete}
          onOpenChange={setOpenDelete}
          onDelete={handleDeleteAgenda}
          agendaId={agendaId}
        />
      )}

      <CreateAgendaModal open={open} onOpenChange={setOpen} />
    </div>
  );
};

export function SkeletonAgendaList() {
  return (
    <div className="flex h-[calc(100vh-12rem)] gap-4">
      <div className="flex w-[300px] shrink-0 flex-col gap-2 lg:border-r lg:pr-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
      <div className="flex-1">
        <Skeleton className="h-full w-full" />
      </div>
    </div>
  );
}

interface AgendaSidebarItemProps {
  agenda: AgendaSummary;
  color: string;
  baseUrl: string;
  onCopyLink: (slug: string) => void;
  onDuplicate: (agendaId: string) => void;
  onAskDelete: (agendaId: string) => void;
}

function AgendaSidebarItem({
  agenda,
  color,
  baseUrl,
  onCopyLink,
  onDuplicate,
  onAskDelete,
}: AgendaSidebarItemProps) {
  const toggleActiveAgenda = useToggleActiveAgenda();
  const [isActive, setIsActive] = useState(agenda.isActive);

  const handleToggle = (checked: boolean) => {
    toggleActiveAgenda.mutate({
      agendaId: agenda.id,
      isActive: checked,
    });
    setIsActive(checked);
  };

  return (
    <div
      className={cn(
        "group relative flex flex-col gap-1.5 rounded-lg border bg-card p-3 transition hover:border-primary/40 hover:shadow-sm",
        !isActive && "opacity-60",
      )}
    >
      <Link
        href={`/agendas/${agenda.id}`}
        className="absolute inset-0 rounded-lg"
        aria-label={`Editar ${agenda.name}`}
      />

      <div className="relative z-10 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
          />
          <p className="truncate text-sm font-semibold">{agenda.name}</p>
        </div>
        <div
          className="flex items-center gap-1"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <Switch
            className="scale-75"
            checked={isActive}
            onCheckedChange={handleToggle}
          />
        </div>
      </div>

      {agenda.description && (
        <p className="relative z-10 line-clamp-2 text-xs text-muted-foreground">
          {agenda.description}
        </p>
      )}

      <div
        className="relative z-10 flex items-center justify-between gap-2"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <Badge variant="secondary" className="text-[10px]">
          {agenda.slotDuration} min
        </Badge>

        <div className="flex items-center gap-1 opacity-70 transition-opacity group-hover:opacity-100">
          <Button
            size="sm"
            variant="ghost"
            className="size-7"
            onClick={() => window.open(`${baseUrl}/${agenda.slug}`, "_blank")}
            title="Abrir página pública"
          >
            <ArrowUpRight className="size-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="size-7"
            onClick={() => onCopyLink(agenda.slug)}
            title="Copiar link"
          >
            <LinkIcon className="size-3.5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="size-7">
                <EllipsisIcon className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild className="cursor-pointer">
                <Link href={`/agendas/${agenda.id}`}>
                  <EditIcon /> Editar
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => onDuplicate(agenda.id)}
              >
                <CopyIcon /> Duplicar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                className="cursor-pointer"
                onClick={() => onAskDelete(agenda.id)}
              >
                <TrashIcon /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

export const AgendaHeader = () => {
  return (
    <div className="flex flex-row items-center justify-between gap-x-4">
      <div className="flex flex-col">
        <h1 className="text-lg md:text-xl font-semibold">Agenda</h1>
        <p className="text-xs md:text-sm text-muted-foreground">
          Gerencie seus compromissos e visualize todos os agendamentos
        </p>
      </div>
    </div>
  );
};

export const AgendaContainer = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  return (
    <div className="h-full w-full px-6 py-4 space-y-4">
      <AgendaHeader />
      {children}
    </div>
  );
};
