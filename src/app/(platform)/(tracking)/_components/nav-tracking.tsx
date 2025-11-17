"use client";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { DropdownMenu } from "@radix-ui/react-dropdown-menu";
import {
  ArrowLeftIcon,
  CalendarPlusIcon,
  ClockIcon,
  Grid2x2Plus,
  MoreHorizontalIcon,
  Search,
  TagIcon,
  Trash2Icon,
  UserRoundPlus,
} from "lucide-react";
import { useState } from "react";

export function NavTracking() {
  return (
    <div className="flex justify-between items-center px-4 py-5 ">
      <div className="flex items-center gap-x-2">
        <SidebarTrigger />
        <InputGroup>
          <InputGroupInput placeholder="Pesquisar..." className="h-6" />
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
        </InputGroup>
      </div>
      <div>
        <ButtonGroup>
          <ButtonGroup className="hidden sm:flex">
            <Button variant="outline" size="icon" aria-label="Go Back">
              <ArrowLeftIcon />
            </Button>
          </ButtonGroup>
          <ButtonGroup>
            <Button variant="outline">Archive</Button>
            <Button variant="outline">Report</Button>
          </ButtonGroup>
          <ButtonGroup>
            <Button variant="outline">Snooze</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="More Options">
                  <MoreHorizontalIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuGroup>
                  <DropdownMenuItem>
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
                  <DropdownMenuItem>
                    <CalendarPlusIcon />
                    Configurações
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
