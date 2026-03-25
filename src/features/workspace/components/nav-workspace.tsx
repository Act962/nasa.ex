"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";

interface Props {
  title: string;
  workspaceId: string;
}

export function NavWorkspace({ workspaceId, title }: Props) {
  return (
    <>
      <div className="sticky top-0 bg-background z-10 h-12 flex justify-between items-center px-4 py-2 gap-2 border-b border-border">
        <div className="flex items-center gap-x-2">
          <SidebarTrigger />

          <h2 className="text-sm font-semibold">{title}</h2>

          {/* <InputGroup onClick={() => searchLead.setIsOpen(true)}>
            <InputGroupInput placeholder="Pesquisar..." className="h-6" />
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
          </InputGroup> */}
        </div>

        <div className="flex items-center gap-2"></div>
      </div>
    </>
  );
}
