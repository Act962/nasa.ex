"use client";
import { EntityHeader } from "@/components/entity-components";
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

export const WorkspaceHeader = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <EntityHeader
        title="Workspace"
        description="Aqui está uma visão geral deste espaço de trabalho!"
        newButtonLabel="Novo workspace"
        onNew={() => setOpen(true)}
      />

      <CreateWorkspaceModal open={open} onOpenChange={setOpen} />
    </>
  );
};

export const WorkspaceAnalytics = () => {
  const { data, isLoading } = useQueryActionsAnalytics();

  return (
    <div className="grid gap-4 md:gap-5 lg:grid-cols-2 xl:grid-cols-3">
      <AnalyticsCard
        isLoading={isLoading}
        title="Total Actions"
        value={data?.total ?? 0}
        type="task"
      />
      <AnalyticsCard
        isLoading={isLoading}
        title="Ações Atrasadas"
        value={data?.delayed ?? 0}
        type="project"
      />
      <AnalyticsCard
        isLoading={isLoading}
        title="Ações Concluídas (7 dias)"
        value={data?.completed ?? 0}
        type="task"
      />
    </div>
  );
};

export const WorkspaceContainer = () => {
  return (
    <div className="h-full w-full px-8 py-6 space-y-6">
      <main className="flex flex-1 flex-col py-4">
        <WorkspaceHeader />
        <div className="mt-8">
          <WorkspaceAnalytics />
        </div>
        <div className="mt-8">
          <Tabs
            defaultValue="projects"
            className="w-full border rounded-lg p-2"
          >
            <TabsList className=" justify-start border-0 w-fit">
              <TabsTrigger className="py-2" value="projects">
                Projetos
              </TabsTrigger>
              <TabsTrigger className="py-2" value="tasks">
                Ações recentes
              </TabsTrigger>
              <TabsTrigger className="py-2" value="members">
                Membros recentes
              </TabsTrigger>
            </TabsList>
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

  const workspaces = data.workspaces;

  return (
    <div className="flex flex-col pt-2">
      {workspaces.map((workspace) => {
        return (
          <Item key={workspace.id} asChild>
            <Link href={`/workspaces/${workspace.id}`}>
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
          </Item>
        );
      })}
    </div>
  );
};
