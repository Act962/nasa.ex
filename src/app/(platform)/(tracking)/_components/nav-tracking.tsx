"use client";

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
import { useAddLead } from "@/hooks/use-add-lead-sheet";
import { useSearchLead } from "@/hooks/use-search-lead";
import { DropdownMenu } from "@radix-ui/react-dropdown-menu";
import {
  CalendarPlusIcon,
  ClockIcon,
  Grid2x2Plus,
  MoreHorizontalIcon,
  Search,
  UserRoundPlus,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

export function NavTracking() {
  const params = useParams<{ trackingId: string }>();
  const triggerModalSearch = useSearchLead();
  const { onOpen } = useAddLead();

  return (
    <div className="flex justify-between items-center px-4 py-5 gap-2">
      <div className="flex items-center gap-x-2">
        <SidebarTrigger />
        <InputGroup>
          <InputGroupInput
            onClick={() => {
              triggerModalSearch.onOpen();
            }}
            placeholder="Pesquisar..."
            className="h-6"
          />
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
        </InputGroup>
      </div>
      <div>
        <ButtonGroup>
          <ButtonGroup className="hidden sm:flex">
            <Button variant="outline">Automações</Button>
            <Button variant="outline">
              <Link href={`/tracking/${params.trackingId}/settings`} prefetch>
                Configurações
              </Link>
            </Button>
            <Button onClick={() => onOpen(params.trackingId)}>Novo Lead</Button>
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
                  <DropdownMenuItem onClick={() => onOpen(params.trackingId)}>
                    <UserRoundPlus />
                    Lead
                  </DropdownMenuItem>
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
  );
}
