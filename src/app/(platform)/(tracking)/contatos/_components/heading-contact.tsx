"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useSearchLead } from "@/hooks/use-search-lead";
import { DownloadCloud, MoreHorizontalIcon, Plus, Search } from "lucide-react";

export default function HeadingContacts() {
  const { onOpen } = useSearchLead();

  return (
    <div className="flex items-center justify-between px-4 py-2 gap-2">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
        <h1 className="hidden sm:block">Leads</h1>
      </div>

      <InputGroup className="w-fit">
        <InputGroupInput placeholder="Buscar contato" onClick={onOpen} />
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
      </InputGroup>

      <div className="hidden sm:flex items-center gap-2">
        <Button variant={"outline"}>
          <DownloadCloud className="size-4" />
          Importar
        </Button>
        <Button>Adicionar novo lead</Button>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            aria-label="Open menu"
            size="icon-sm"
            className="sm:hidden"
          >
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-40" align="end">
          <DropdownMenuLabel>Ações</DropdownMenuLabel>
          <DropdownMenuGroup>
            <DropdownMenuItem>
              <DownloadCloud className="size-4" />
              Importar
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Plus className="size-4" />
              Novo lead
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
