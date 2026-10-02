"use client";

import { SearchLeadModal } from "@/components/modals/search-lead-modal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useSearchModal } from "@/hooks/modal/use-search-modal";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";
import {
  Plus,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useState } from "react";
import { AddParticipantDialog } from "./add-participant-dialog";
import { cn } from "@/lib/utils";
import { useAddLead } from "@/hooks/modal/use-add-lead";
import AddLeadSheet from "@/features/trackings/components/modal/add-lead-sheet";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";

export function NavTracking() {
  const params = useParams<{ trackingId: string; workflowId: string }>();
  const pathname = usePathname();
  const searchLead = useSearchModal();
  const [addMemberDialogIsOpen, setAddMemberDialogIsOpen] = useState(false);
  const addLeadSheet = useAddLead();
  const isBoardPage = pathname === `/tracking/${params.trackingId}`;
  const { data, isPending } = useQuery(
    orpc.tracking.listParticipants.queryOptions({
      input: {
        trackingId: params.trackingId,
      },
    }),
  );

  const navItems = [
    {
      label: "Tracking",
      href: `/tracking/${params.trackingId}`,
    },
    {
      label: "Chat",
      href: `/tracking-chat?trackingId=${params.trackingId}`,
    },
    {
      label: "Agendamentos",
      href: `/tracking/${params.trackingId}/appointments`,
    },
    {
      label: "Gatilhos Automáticos",
      href: `/tracking/${params.trackingId}/workflows`,
    },
    {
      label: "Configurações",
      href: `/tracking/${params.trackingId}/settings`,
    },
  ];

  return (
    <>
      <div className="sticky top-0 bg-background z-10 flex justify-between items-center px-4 py-2 gap-2">
        <div className="flex items-center gap-x-2">
          <SidebarTrigger />

          <InputGroup className="hidden lg:flex" onClick={() => searchLead.setIsOpen(true)}>
            <InputGroupInput placeholder="Pesquisar..." className="h-6" />
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
          </InputGroup>
        </div>

        <div className="flex items-center gap-2">
          {!isPending && data?.participants && data.participants.length > 0 && (
            <div className="flex items-center gap-0.5">
              <div className="*:data-[slot=avatar]:ring-background flex -space-x-2 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:grayscale">
                {data.participants.slice(0, 6).map((participant) => (
                  <Avatar className="size-6" key={participant.id}>
                    <AvatarImage
                      src={participant?.user?.image || ""}
                      alt={participant.user.name}
                    />
                    <AvatarFallback>{participant.user.name[0]}</AvatarFallback>
                  </Avatar>
                ))}
                {data.participants.length > 6 && (
                  <Avatar className="size-6">
                    <AvatarFallback>
                      +{data.participants.length - 6}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>

              <button
                className="size-6 flex items-center justify-center border-dashed border border-border rounded-full transition-colors hover:bg-primary hover:text-primary-foreground hover:border-primary"
                onClick={() => setAddMemberDialogIsOpen(true)}
              >
                <Plus className="size-4" />
              </button>
            </div>
          )}
          <nav
            aria-label="Seções do tracking"
            className="hidden lg:inline-flex gap-0.5 rounded-full border border-line bg-panel p-[3px]"
          >
            {navItems.map((item) => {
              const isActive = pathname.startsWith("/tracking-chat")
                ? item.href.startsWith("/tracking-chat")
                : item.href === pathname;

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  prefetch
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex h-8 items-center rounded-full px-3.5 text-sm whitespace-nowrap transition-colors",
                    isActive
                      ? "bg-foreground font-medium text-background"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          {isBoardPage && (
            <Button
              size="sm"
              className="lg:hidden"
              onClick={() => addLeadSheet.setIsOpen(true)}
              data-guide={GUIDE_ANCHORS.boardNewLeadButton.id}
            >
              <Plus className="size-4" />
              Novo Lead
            </Button>
          )}
        </div>
      </div>

      {isBoardPage && (
        <AddLeadSheet
          trackingId={params.trackingId}
          open={addLeadSheet.isOpen}
          onOpenChange={addLeadSheet.setIsOpen}
        />
      )}

      <SearchLeadModal
        open={searchLead.isOpen}
        onOpenChange={searchLead.setIsOpen}
      />

      <AddParticipantDialog
        open={addMemberDialogIsOpen}
        onOpenChange={setAddMemberDialogIsOpen}
        participantsIds={
          data?.participants.map((participant) => participant.user.id) || []
        }
      />
    </>
  );
}
