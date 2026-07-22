"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWorkspacesByTracking } from "@/features/workspace/hooks/use-workspace";
import { ArrowUpRightIcon, ChevronsUpDown, LayoutGridIcon } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

export function WorkspacesSwitcher() {
  const { trackingId } = useParams<{ trackingId: string }>();
  const { data, isPending } = useWorkspacesByTracking(trackingId);

  const workspaces = data?.workspaces ?? [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <LayoutGridIcon className="size-4" />
          <span className="hidden lg:inline">Workspaces</span>
          {workspaces.length > 0 && (
            <span className="rounded-sm bg-muted px-1.5 py-0.5 text-xs font-medium tabular-nums">
              {workspaces.length}
            </span>
          )}
          <ChevronsUpDown className="ml-auto" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Workspaces conectados</DropdownMenuLabel>

        {isPending && (
          <DropdownMenuLabel className="font-normal text-muted-foreground">
            Carregando...
          </DropdownMenuLabel>
        )}

        {!isPending && workspaces.length === 0 && (
          <p className="px-2 py-1.5 text-sm text-muted-foreground">
            Nenhum workspace conectado. Vincule um tracking nas configurações do
            workspace.
          </p>
        )}

        {workspaces.map((workspace) => (
          <DropdownMenuItem
            key={workspace.id}
            asChild
            className="cursor-pointer"
          >
            <Link
              href={`/workspaces/${workspace.id}?action-view=kanban`}
              prefetch
            >
              <span className="truncate">
                {workspace.icon ? `${workspace.icon} ` : ""}
                {workspace.name}
              </span>
              <ArrowUpRightIcon className="ml-auto size-4 shrink-0" />
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
