"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { useState } from "react";
import { WorkspaceSettingsModal } from "./modals/workspace-settings-modal";
import { Button } from "@/components/ui/button";
import { PlusIcon, SettingsIcon } from "lucide-react";
import { useWorkspaceMembers } from "../hooks/use-workspace";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQueryState } from "nuqs";

interface Props {
  title: string;
  workspaceId: string;
}

export function NavWorkspace({ workspaceId, title }: Props) {
  const [open, setOpen] = useState(false);
  const [_, setView] = useQueryState("workspace_settings");
  const { members, isLoading } = useWorkspaceMembers(workspaceId);
  return (
    <>
      <div className="sticky top-0 bg-background z-10 h-12 flex justify-between items-center px-4 py-2 gap-2 border-b border-border">
        <div className="flex items-center gap-x-2">
          <SidebarTrigger />

          <h2 className="text-sm font-semibold">{title}</h2>
        </div>

        <div className="flex items-center gap-2">
          {!isLoading && members && members.length > 0 && (
            <div className="flex items-center gap-0.5">
              <div className="*:data-[slot=avatar]:ring-background flex -space-x-2 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:grayscale">
                {members.slice(0, 6).map((participant) => (
                  <Avatar className="size-6" key={participant.id}>
                    <AvatarImage
                      src={participant?.user?.image || ""}
                      alt={participant.user.name}
                    />
                    <AvatarFallback>{participant.user.name[0]}</AvatarFallback>
                  </Avatar>
                ))}
                {members.length > 6 && (
                  <Avatar className="size-6">
                    <AvatarFallback>+{members.length - 6}</AvatarFallback>
                  </Avatar>
                )}
              </div>

              <button
                className="size-6 flex items-center justify-center border-dashed border border-border rounded-full transition-colors hover:bg-primary hover:text-primary-foreground hover:border-primary"
                onClick={() => {
                  setOpen(true);
                  setView("members");
                }}
              >
                <PlusIcon className="size-4" />
              </button>
            </div>
          )}
          <Button variant="ghost" size="icon" onClick={() => setOpen(true)}>
            <SettingsIcon className="size-4" />
          </Button>
        </div>
      </div>

      <WorkspaceSettingsModal
        workspaceId={workspaceId}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
