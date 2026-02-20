"use client";

import { SearchLeadModal } from "@/components/modals/search-lead-modal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useSearchModal } from "@/hooks/modal/use-search-modal";
import { orpc } from "@/lib/orpc";
import { DropdownMenu } from "@radix-ui/react-dropdown-menu";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarPlusIcon,
  ClockIcon,
  Grid2x2Plus,
  MoreHorizontalIcon,
  Plus,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useState } from "react";
import { AddParticipantDialog } from "./add-participant-dialog";

export function NavTracking() {
  const params = useParams<{ trackingId: string; workflowId: string }>();
  const pathname = usePathname();
  const searchLead = useSearchModal();
  const [addMemberDialogIsOpen, setAddMemberDialogIsOpen] = useState(false);
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
      label: "Automações",
      href: `/tracking/${params.trackingId}/workflows`,
    },
    {
      label: "Configurações",
      href: `/tracking/${params.trackingId}/settings`,
    },
  ];

  return (
    <>
      <div className="sticky top-0 bg-background z-10 flex justify-between items-center px-4 py-2 gap-2 border-b border-border">
        <div className="flex items-center gap-x-2">
          <SidebarTrigger />

          <InputGroup onClick={() => searchLead.setIsOpen(true)}>
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
          <ButtonGroup>
            <ButtonGroup className="hidden sm:flex">
              {navItems.map((item) => (
                <Button
                  key={item.label}
                  variant="outline"
                  size="sm"
                  disabled={item.href === pathname}
                >
                  <Link href={item.href} prefetch>
                    {item.label}
                  </Link>
                </Button>
              ))}
            </ButtonGroup>

            {/* Mobile */}
            <ButtonGroup>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="More Options"
                    className="sm:hidden"
                  >
                    <MoreHorizontalIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuGroup>
                    <DropdownMenuItem>
                      <Grid2x2Plus />
                      Coluna
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem>
                      <ClockIcon />
                      Automação
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link
                        href={`/tracking/${params.trackingId}/settings`}
                        prefetch
                      >
                        <CalendarPlusIcon />
                        Configurações
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </ButtonGroup>
          </ButtonGroup>
        </div>
      </div>

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
