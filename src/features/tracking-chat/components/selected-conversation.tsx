"use client";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TagIcon } from "lucide-react";
import { useState } from "react";
import { AddTagLead } from "./add-tag-lead";
import { Instance } from "../types";

export interface SelectedConversationProps {
  lead: {
    id: string;
    name: string;
    leadTags?: { tag: { id: string } }[] | any;
  };
  trackingId: string;
  children: React.ReactNode;
  instance?: Instance | null;
}

export function SelectedConversationOptions({
  lead,
  trackingId,
  children,
  instance,
}: SelectedConversationProps) {
  const [showTagModal, setShowTagModal] = useState(false);

  const initialTagIds =
    lead.leadTags?.map((lt: any) => lt.tag?.id || lt.tagId || lt.id) || [];

  const MenuItems = ({
    isContextMenu = false,
  }: {
    isContextMenu?: boolean;
  }) => {
    const Item = isContextMenu ? ContextMenuItem : DropdownMenuItem;
    const Group = isContextMenu ? ContextMenuGroup : DropdownMenuGroup;
    return (
      <Group>
        <Item
          className="flex w-full px-3 py-2 cursor-pointer hover:bg-accent/10 rounded-lg text-sm font-medium justify-between"
          onClick={(e) => {
            e.stopPropagation();
            setShowTagModal(true);
          }}
        >
          Etiquetar lead <TagIcon className="size-4" />
        </Item>
      </Group>
    );
  };

  return (
    <>
      <DropdownMenu modal={false}>
        <ContextMenu modal={false}>
          <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
          <ContextMenuContent className="w-48 bg-background border-border shadow-xl rounded-xl p-1">
            <MenuItems isContextMenu />
          </ContextMenuContent>
        </ContextMenu>
        <DropdownMenuContent className="w-48 bg-background border-border shadow-xl rounded-xl p-1">
          <MenuItems />
        </DropdownMenuContent>
      </DropdownMenu>

      {showTagModal && (
        <AddTagLead
          open={showTagModal}
          onOpenChange={setShowTagModal}
          leadId={lead.id}
          trackingId={trackingId}
          initialSelectedTagIds={initialTagIds}
          instance={instance!}
        />
      )}
    </>
  );
}
