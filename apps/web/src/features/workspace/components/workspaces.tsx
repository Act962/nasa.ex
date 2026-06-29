"use client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Suspense, useState } from "react";
import AnalyticsCard from "./analytics-card";
import { CreateWorkspaceModal } from "./modals/create-workspace-modal";
import { useSuspenseWokspaces } from "../hooks/use-workspace";
import { useQueryActionsAnalytics } from "@/features/actions/hooks/use-tasks";
import { RecentTasks } from "./recent-tasks";
import { RecentMembers } from "./recent-members";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemHeader,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import dayjs from "dayjs";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { CalendarDaysIcon, FolderKanbanIcon, PlusIcon } from "lucide-react";
import { PatternsSection } from "@/features/admin/components/patterns-section";
import { Button } from "@/components/ui/button";
import { WorkspaceCalendarModal } from "./workspace-calendar-modal";
import {
  AnalyticsDetailsModal,
  type AnalyticsBucket,
} from "./analytics-details-modal";
import { IncomingSharesPanel } from "./incoming-shares-panel";

export const WorkspaceHeader = () => {
  const [open, setOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-x-4">
        <div className="flex flex-col">
          <h1 className="text-lg font-semibold md:text-xl">Workspace</h1>
          <p className="hidden text-xs text-muted-foreground sm:block md:text-sm">
            Aqui está uma visão geral deste espaço de trabalho!
          </p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:shrink-0 sm:flex-wrap sm:items-center">
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-1.5 sm:w-auto"
            onClick={() => setCalendarOpen(true)}
          >
            <CalendarDaysIcon className="size-4" />
            <span className="hidden sm:inline">Calendário Workspace</span>
            <span className="sm:hidden">Calendário</span>
          </Button>
          <Button
            size="sm"
            onClick={() => setOpen(true)}
            className="w-full gap-1.5 sm:w-auto"
          >
            <PlusIcon className="size-4" />
            <span className="hidden sm:inline">Novo workspace</span>
            <span className="sm:hidden">Novo</span>
          </Button>
        </div>
      </div>

      <CreateWorkspaceModal open={open} onOpenChange={setOpen} />
      <WorkspaceCalendarModal
        open={calendarOpen}
        onOpenChange={setCalendarOpen}
      />
    </>
  );
};

export const WorkspaceAnalytics = () => {
  const { data, isLoading } = useQueryActionsAnalytics();
  const [bucket, setBucket] = useState<AnalyticsBucket | null>(null);

  return (
    <>
      <div className="grid grid-cols-3 gap-2 md:gap-5 lg:grid-cols-2 xl:grid-cols-3">
        <AnalyticsCard
          isLoading={isLoading}
          title="Ações"
          value={data?.total ?? 0}
          type="task"
          onClick={() => setBucket("total")}
        />
        <AnalyticsCard
          isLoading={isLoading}
          title="Ações Atrasadas"
          value={data?.delayed ?? 0}
          type="project"
          onClick={() => setBucket("delayed")}
        />
        <AnalyticsCard
          isLoading={isLoading}
          title="Ações Concluídas (7 dias)"
          value={data?.completed ?? 0}
          type="task"
          onClick={() => setBucket("completed")}
        />
      </div>
      <AnalyticsDetailsModal bucket={bucket} onClose={() => setBucket(null)} />
    </>
  );
};

export const WorkspaceContainer = () => {
  return (
    <div className="h-full w-full space-y-6 px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6">
      <main className="flex flex-1 flex-col py-4">
        <WorkspaceHeader />
        {/* Caixa de aprovação de compartilhamentos cross-org. O componente
            já tem `if (shares.length === 0) return null` — só aparece
            quando há pendentes pra aprovar. */}
        <div className="mt-6">
          <IncomingSharesPanel />
        </div>
        <div className="mt-8">
          <WorkspaceAnalytics />
        </div>
        <div className="mt-8">
          <Tabs
            defaultValue="projects"
            className="w-full border rounded-lg p-2"
          >
            <div className="w-full overflow-x-auto">
              <TabsList className="grid w-full grid-cols-3 border-0 sm:flex sm:w-fit sm:justify-start">
                <TabsTrigger className="w-full py-2 sm:w-auto" value="projects">
                  Projetos
                </TabsTrigger>
                <TabsTrigger className="w-full py-2 sm:w-auto" value="tasks">
                  Ações recentes
                </TabsTrigger>
                <TabsTrigger className="w-full py-2 sm:w-auto" value="members">
                  Membros recentes
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="projects">
              <Suspense fallback={<div>Carregando...</div>}>
                <Workspaces />
              </Suspense>
            </TabsContent>
            <TabsContent value="tasks">
              <Suspense fallback={<div>Carregando...</div>}>
                <RecentTasks />
              </Suspense>
            </TabsContent>
            <TabsContent value="members">
              <Suspense fallback={<div>Carregando...</div>}>
                <RecentMembers />
              </Suspense>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export const Workspaces = () => {
  const { data } = useSuspenseWokspaces();
  const [open, setOpen] = useState(false);

  const workspaces = data.workspaces;

  return (
    <>
      <div className="flex flex-col pt-2 gap-2">
        {workspaces.length === 0 && (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FolderKanbanIcon />
              </EmptyMedia>
              <EmptyTitle>Nenhum workspace encontrado</EmptyTitle>
              <EmptyDescription>
                Crie um workspace para começar
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={() => setOpen(true)}>Criar workspace</Button>
            </EmptyContent>
          </Empty>
        )}

        {workspaces.map((workspace) => {
          return (
            <Item
              key={workspace.id}
              className="bg-muted/30 hover:bg-muted/60 transition-colors"
            >
              <Link
                href={`/workspaces/${workspace.id}`}
                className="flex flex-1 items-center gap-3 min-w-0"
              >
                <ItemMedia>{workspace.icon}</ItemMedia>
                <ItemContent>
                  <ItemTitle>{workspace.name}</ItemTitle>
                  <ItemDescription>
                    {dayjs(workspace.createdAt).format("MMMM DD, YYYY")}
                  </ItemDescription>
                </ItemContent>
                <ItemContent className="flex-row items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    Criado por
                  </span>
                  <Tooltip>
                    <TooltipTrigger>
                      <Avatar>
                        <AvatarImage src={workspace.creator.image || ""} />
                        <AvatarFallback>
                          {workspace.creator.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                    </TooltipTrigger>
                    <TooltipContent>{workspace.creator.name}</TooltipContent>
                  </Tooltip>
                </ItemContent>
              </Link>
              <div className="shrink-0 pr-3">
                <Button asChild size="sm" variant="secondary">
                  <Link href={`/workspaces/${workspace.id}`}>Abrir</Link>
                </Button>
              </div>
            </Item>
          );
        })}
      </div>

      <PatternsSection
        appType="workspace"
        redirectPath={(id) => `/workspaces/${id}`}
      />

      <CreateWorkspaceModal open={open} onOpenChange={setOpen} />
    </>
  );
};
