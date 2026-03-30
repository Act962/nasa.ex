import { ArrowUpRight, PlusIcon } from "lucide-react";
import { Button } from "../ui/button";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "../ui/sidebar";
import { Suspense, useState } from "react";
import { CreateWorkspaceModal } from "@/features/workspace/components/modals/create-workspace-modal";
import { useSuspenseWokspaces } from "@/features/workspace/hooks/use-workspace";
import Link from "next/link";
import { Skeleton } from "../ui/skeleton";

export function WorkspacesItems() {
  const [open, setOpne] = useState(false);

  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel className="justify-between">
          Projetos
          <div className="flex items-center gap-1.5">
            <Button size="icon-xs" variant="ghost" asChild>
              <Link href={"/workspaces"}>
                <ArrowUpRight />
              </Link>
            </Button>
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={() => setOpne(true)}
            >
              <PlusIcon />
            </Button>
          </div>
        </SidebarGroupLabel>

        <SidebarMenu>
          <Suspense fallback={<WorkspaceListSkeleton />}>
            <WoksapcesList />
          </Suspense>
        </SidebarMenu>
      </SidebarGroup>

      <CreateWorkspaceModal open={open} onOpenChange={setOpne} />
    </>
  );
}

export function WoksapcesList() {
  const { data } = useSuspenseWokspaces();

  const workspaces = data.workspaces;

  return (
    <>
      {workspaces.map((workscpace) => {
        return (
          <SidebarMenuItem key={`${workscpace.id}-${workscpace.name}`}>
            <SidebarMenuButton tooltip={workscpace.name} asChild>
              <Link href={`/workspaces/${workscpace.id}`}>
                {workscpace.icon}
                <span className="truncate">{workscpace.name}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </>
  );
}

export function WorkspaceListSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, index) => {
        return (
          <SidebarMenuItem key={`${index}`}>
            <SidebarMenuButton tooltip="" asChild>
              <Skeleton className="h-6 w-full" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </>
  );
}
