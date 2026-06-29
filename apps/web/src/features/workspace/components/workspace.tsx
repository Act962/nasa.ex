"use client";

import { ActionsViewSwitcher } from "@/features/actions/components/actions-view-switcher";
import { useWorkspace } from "../hooks/use-workspace";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { NavWorkspace } from "@/features/actions/components/nav-workspace";
import { FavoritesSection } from "./favorites-section";

interface Props {
  workspaceId: string;
}

export function WorkspaceBoard({ workspaceId }: Props) {
  const { data } = useWorkspace(workspaceId);
  const coverImageUrl = useConstructUrl(data?.workspace?.coverImage || "");

  return (
    <div className="h-full w-full relative overflow-x-auto scroll-cols-tracking">
      {data?.workspace?.coverImage && (
        <div
          className="absolute inset-0 z-0 pointer-events-none opacity-[0.08] dark:opacity-[0.12] bg-cover bg-center"
          style={{
            backgroundImage: `url(${coverImageUrl})`,
          }}
        />
      )}
      <div className="relative z-10 h-full flex flex-col">
        <FavoritesSection workspaceId={workspaceId} />
        <div className="flex-1 min-h-0">
          <ActionsViewSwitcher workspaceId={workspaceId} />
        </div>
      </div>
      <NavWorkspace />
    </div>
  );
}
