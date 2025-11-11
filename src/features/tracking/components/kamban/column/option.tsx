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
import { useSidebar } from "@/components/ui/sidebar";
import { Circle, MoreHorizontalIcon } from "lucide-react";
import { Pencil } from "lucide-react";

export function OptionColumn() {
  const { isMobile } = useSidebar();

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm">
            <MoreHorizontalIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-40"
          align={isMobile ? "end" : "start"}
        >
          <DropdownMenuLabel>Mais ações</DropdownMenuLabel>
          <DropdownMenuGroup>
            <DropdownMenuItem>
              <Pencil className="rounded-2xl bg-foreground size-3" />
              Editar título
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Circle className="rounded-2xl bg-foreground size-3" /> Editar cor
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
