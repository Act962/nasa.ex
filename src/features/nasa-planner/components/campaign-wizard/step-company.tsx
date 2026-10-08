"use client";

import { useState } from "react";
import { BuildingIcon, FolderIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import type { WizardProject } from "./wizard-options";

/** Passo 0 do assistente de campanha: empresa e projeto/cliente. */

interface StepCompanyProps {
  selectedOrgId: string | null;
  selectedOrgName: string;
  selectedProjectId: string | null;
  selectedProject: WizardProject | undefined;
  orgProjects: WizardProject[];
  onSelectOrg: (orgId: string, orgName: string) => void;
  onSelectProject: (projectId: string | null) => void;
}

export function StepCompany({
  selectedOrgId, selectedOrgName, selectedProjectId, selectedProject, orgProjects, onSelectOrg, onSelectProject,
}: StepCompanyProps) {
  const { data: organizations } = authClient.useListOrganizations();
  const [orgOpen, setOrgOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">Selecione a empresa e o projeto/cliente para qual esta campanha será criada.</p>

      {/* Org selector */}
      <div className="space-y-1.5">
        <Label>Empresa *</Label>
        <Popover open={orgOpen} onOpenChange={setOrgOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
              <div className="flex items-center gap-2 truncate">
                {selectedOrgName ? (
                  <span className="truncate">{selectedOrgName}</span>
                ) : (
                  <span className="text-muted-foreground">Selecionar empresa...</span>
                )}
              </div>
              <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar empresa..." />
              <CommandList>
                <CommandEmpty>Nenhuma empresa encontrada.</CommandEmpty>
                <CommandGroup>
                  {(organizations ?? []).map((org) => (
                    <CommandItem
                      key={org.id}
                      value={org.name}
                      onSelect={() => {
                        onSelectOrg(org.id, org.name);
                        setOrgOpen(false);
                      }}
                    >
                      <BuildingIcon className="size-4 mr-2 opacity-60" />
                      <span className="flex-1 truncate">{org.name}</span>
                      <CheckIcon className={cn("size-4", selectedOrgId === org.id ? "opacity-100" : "opacity-0")} />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Project selector — only visible after org selected */}
      {selectedOrgId && (
        <div className="space-y-1.5">
          <Label>Projeto / Cliente <span className="text-muted-foreground text-xs">(opcional)</span></Label>
          <Popover open={projectOpen} onOpenChange={setProjectOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                <div className="flex items-center gap-2 truncate">
                  {selectedProject ? (
                    <>
                      <div className="size-3.5 rounded-full shrink-0" style={{ backgroundColor: selectedProject.color ?? "#7c3aed" }} />
                      <span className="truncate">{selectedProject.name}</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">Selecionar projeto/cliente...</span>
                  )}
                </div>
                <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="start">
              <Command>
                <CommandInput placeholder="Buscar projeto..." />
                <CommandList>
                  <CommandEmpty>Nenhum projeto/cliente encontrado.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem value="__none__" onSelect={() => { onSelectProject(null); setProjectOpen(false); }} className="text-muted-foreground">
                      <FolderIcon className="size-4 mr-2 opacity-50" />
                      Nenhum
                    </CommandItem>
                    {orgProjects.map((p) => (
                      <CommandItem
                        key={p.id}
                        value={p.name}
                        onSelect={() => { onSelectProject(p.id); setProjectOpen(false); }}
                      >
                        <div className="size-3.5 rounded-full shrink-0 mr-2" style={{ backgroundColor: p.color ?? "#7c3aed" }} />
                        <span className="flex-1 truncate">{p.name}</span>
                        <CheckIcon className={cn("size-4", selectedProjectId === p.id ? "opacity-100" : "opacity-0")} />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  );
}
