"use client";

import { SearchLeadModal } from "@/components/modals/search-lead-modal";
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
import { useSearchModal } from "@/hooks/modal/use-search-modal";
import { useOrgRole } from "@/hooks/use-org-role";
import { useCheckPermission } from "@/hooks/use-check-permission";
import {
  DownloadCloud,
  FileSpreadsheet,
  MoreHorizontalIcon,
  Plus,
  Search,
} from "lucide-react";
import { LeadImportDialog } from "./lead-import-dialog";
import { LeadExportDialog } from "./lead-export-dialog";
import { useState } from "react";

export default function HeadingContacts() {
  const searchLead = useSearchModal();
  const [modalImportIsOpen, setImportIsModal] = useState(false);
  const [modalExportIsOpen, setExportIsModal] = useState(false);
  const { isSingle } = useOrgRole();
  const { checkPermission } = useCheckPermission();

  const canExport = checkPermission("tracking", "canView");

  return (
    <>
      <div className="flex items-center justify-between px-4 py-2 gap-2 border-b">
        <div className="flex items-center gap-2">
          <SidebarTrigger />
          <h1 className="hidden sm:block">Leads</h1>
        </div>

        <InputGroup
          className="w-fit"
          onClick={() => searchLead.setIsOpen(true)}
        >
          <InputGroupInput placeholder="Buscar contato" />
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
        </InputGroup>

        <div className="hidden sm:flex items-center gap-2">
          {!isSingle && (
            <>
              <Button
                variant={"outline"}
                onClick={() => setImportIsModal(true)}
              >
                <DownloadCloud className="size-4" />
                Importar
              </Button>
            </>
          )}
          {canExport && (
            <Button variant={"outline"} onClick={() => setExportIsModal(true)}>
              <FileSpreadsheet className="size-4" />
              Exportar
            </Button>
          )}
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
              {!isSingle && (
                <DropdownMenuItem onClick={() => setImportIsModal(true)}>
                  <DownloadCloud className="size-4" />
                  Importar
                </DropdownMenuItem>
              )}
              {canExport && (
                <DropdownMenuItem onClick={() => setExportIsModal(true)}>
                  <FileSpreadsheet className="size-4" />
                  Exportar
                </DropdownMenuItem>
              )}
              <DropdownMenuItem>
                <Plus className="size-4" />
                Novo lead
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <SearchLeadModal
        open={searchLead.isOpen}
        onOpenChange={searchLead.setIsOpen}
      />
      {!isSingle && (
        <LeadImportDialog
          onOpenChange={setImportIsModal}
          open={modalImportIsOpen}
        />
      )}
      {canExport && (
        <LeadExportDialog
          onOpenChange={setExportIsModal}
          open={modalExportIsOpen}
        />
      )}
    </>
  );
}
