"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Search,
  RotateCcw,
  SlidersHorizontal,
  ChevronDown,
  CheckSquare,
  FolderOpen,
  User as UserIcon,
  Flag,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Workspace {
  id: string;
  name: string;
}

interface OrgProjectOption {
  id: string;
  name: string;
  type?: string | null;
  color?: string | null;
}

interface LeadOption {
  id: string;
  name: string;
}

interface ResponsibleOption {
  id: string;
  name: string;
  image?: string | null;
}

export type ActionPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export const PRIORITY_META: Record<
  ActionPriority,
  { label: string; color: string }
> = {
  LOW: { label: "Baixa", color: "bg-emerald-500" },
  MEDIUM: { label: "Média", color: "bg-yellow-500" },
  HIGH: { label: "Alta", color: "bg-orange-500" },
  URGENT: { label: "Urgente", color: "bg-red-600" },
};

interface Props {
  workspaces: Workspace[];
  workspaceColorMap: Record<string, string>;
  selectedWorkspaceIds: Set<string>;
  // Clientes/Projetos
  orgProjects: OrgProjectOption[];
  selectedOrgProjectIds: Set<string>;
  // Leads
  leads: LeadOption[];
  selectedLeadIds: Set<string>;
  // Responsáveis (NOVO)
  responsibles: ResponsibleOption[];
  selectedResponsibleIds: Set<string>;
  // Prioridades (NOVO)
  selectedPriorities: Set<ActionPriority>;
  // Filtros básicos
  search: string;
  showOnlyPending: boolean;
  // Handlers
  onToggleWorkspace: (id: string) => void;
  onClearWorkspaces: () => void;
  onToggleOrgProject: (id: string) => void;
  onClearOrgProjects: () => void;
  onToggleLead: (id: string) => void;
  onClearLeads: () => void;
  onToggleResponsible: (id: string) => void;
  onClearResponsibles: () => void;
  onTogglePriority: (p: ActionPriority) => void;
  onClearPriorities: () => void;
  onSearchChange: (s: string) => void;
  onTogglePending: (v: boolean) => void;
  onReset: () => void;
  defaultOpen?: boolean;
}

function FilterSection({
  title,
  icon,
  count,
  onClear,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  onClear?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1.5 text-xs">
          {icon}
          {title}
          {count > 0 && (
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {count}
            </span>
          )}
        </Label>
        {count > 0 && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="text-[10px] text-muted-foreground transition hover:text-foreground"
          >
            Limpar
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

export function WorkspaceCalendarFilters({
  workspaces,
  workspaceColorMap,
  selectedWorkspaceIds,
  orgProjects,
  selectedOrgProjectIds,
  leads,
  selectedLeadIds,
  responsibles,
  selectedResponsibleIds,
  selectedPriorities,
  search,
  showOnlyPending,
  onToggleWorkspace,
  onClearWorkspaces,
  onToggleOrgProject,
  onClearOrgProjects,
  onToggleLead,
  onClearLeads,
  onToggleResponsible,
  onClearResponsibles,
  onTogglePriority,
  onClearPriorities,
  onSearchChange,
  onTogglePending,
  onReset,
  defaultOpen = true,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  // Separa cliente vs projeto para apresentar como dois grupos
  const clients = orgProjects.filter((p) => p.type === "client" || !p.type);
  const projects = orgProjects.filter((p) => p.type !== "client" && p.type);

  const activeCount =
    (search ? 1 : 0) +
    (showOnlyPending ? 1 : 0) +
    selectedWorkspaceIds.size +
    selectedOrgProjectIds.size +
    selectedLeadIds.size +
    selectedResponsibleIds.size +
    selectedPriorities.size;

  return (
    <aside className="flex flex-col">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-muted/40 lg:px-5"
      >
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Filtros</span>
          {activeCount > 0 && (
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {activeCount}
            </span>
          )}
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      <div
        className={cn(
          "overflow-hidden transition-all duration-200",
          open ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0",
        )}
      >
        <div className="flex flex-col gap-4 px-4 pb-4 pt-1 lg:px-5">
          {/* Busca */}
          <div className="space-y-1.5">
            <Label htmlFor="ws-cal-search" className="text-xs">
              Buscar
            </Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="ws-cal-search"
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Título da ação"
                className="h-9 pl-8"
              />
            </div>
          </div>

          {/* Apenas pendentes */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="ws-cal-pending"
              checked={showOnlyPending}
              onCheckedChange={(v) => onTogglePending(!!v)}
            />
            <Label
              htmlFor="ws-cal-pending"
              className="cursor-pointer text-xs font-normal"
            >
              <CheckSquare className="mr-1 inline h-3 w-3" />
              Apenas pendentes
            </Label>
          </div>

          {/* Workspaces */}
          <FilterSection
            title="Workspaces"
            icon={
              <span className="size-3 rounded-full bg-violet-500" aria-hidden />
            }
            count={selectedWorkspaceIds.size}
            onClear={onClearWorkspaces}
          >
            {workspaces.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nenhum workspace neste mês
              </p>
            ) : (
              <div className="space-y-1">
                {workspaces.map((ws) => (
                  <div
                    key={ws.id}
                    className="flex items-center gap-2 rounded p-1 hover:bg-muted/40"
                  >
                    <Checkbox
                      id={`ws-cal-filter-${ws.id}`}
                      checked={selectedWorkspaceIds.has(ws.id)}
                      onCheckedChange={() => onToggleWorkspace(ws.id)}
                    />
                    <div
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: workspaceColorMap[ws.id] }}
                    />
                    <Label
                      htmlFor={`ws-cal-filter-${ws.id}`}
                      className="cursor-pointer truncate text-xs font-normal"
                    >
                      {ws.name}
                    </Label>
                  </div>
                ))}
              </div>
            )}
          </FilterSection>

          {/* Clientes */}
          {clients.length > 0 && (
            <FilterSection
              title="Clientes"
              icon={<UserIcon className="size-3" />}
              count={
                clients.filter((c) => selectedOrgProjectIds.has(c.id)).length
              }
              onClear={() => {
                clients.forEach((c) => {
                  if (selectedOrgProjectIds.has(c.id))
                    onToggleOrgProject(c.id);
                });
              }}
            >
              <div className="space-y-1">
                {clients.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-2 rounded p-1 hover:bg-muted/40"
                  >
                    <Checkbox
                      id={`ws-cal-client-${c.id}`}
                      checked={selectedOrgProjectIds.has(c.id)}
                      onCheckedChange={() => onToggleOrgProject(c.id)}
                    />
                    <div
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: c.color ?? "#7c3aed" }}
                    />
                    <Label
                      htmlFor={`ws-cal-client-${c.id}`}
                      className="cursor-pointer truncate text-xs font-normal"
                    >
                      {c.name}
                    </Label>
                  </div>
                ))}
              </div>
            </FilterSection>
          )}

          {/* Projetos */}
          {projects.length > 0 && (
            <FilterSection
              title="Projetos"
              icon={<FolderOpen className="size-3" />}
              count={
                projects.filter((p) => selectedOrgProjectIds.has(p.id)).length
              }
              onClear={() => {
                projects.forEach((p) => {
                  if (selectedOrgProjectIds.has(p.id))
                    onToggleOrgProject(p.id);
                });
              }}
            >
              <div className="space-y-1">
                {projects.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 rounded p-1 hover:bg-muted/40"
                  >
                    <Checkbox
                      id={`ws-cal-project-${p.id}`}
                      checked={selectedOrgProjectIds.has(p.id)}
                      onCheckedChange={() => onToggleOrgProject(p.id)}
                    />
                    <div
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: p.color ?? "#7c3aed" }}
                    />
                    <Label
                      htmlFor={`ws-cal-project-${p.id}`}
                      className="cursor-pointer truncate text-xs font-normal"
                    >
                      {p.name}
                    </Label>
                  </div>
                ))}
              </div>
            </FilterSection>
          )}

          {/* Leads */}
          {leads.length > 0 && (
            <FilterSection
              title="Leads"
              icon={<UserIcon className="size-3 text-amber-500" />}
              count={selectedLeadIds.size}
              onClear={onClearLeads}
            >
              <div className="space-y-1">
                {leads.map((l) => (
                  <div
                    key={l.id}
                    className="flex items-center gap-2 rounded p-1 hover:bg-muted/40"
                  >
                    <Checkbox
                      id={`ws-cal-lead-${l.id}`}
                      checked={selectedLeadIds.has(l.id)}
                      onCheckedChange={() => onToggleLead(l.id)}
                    />
                    <Label
                      htmlFor={`ws-cal-lead-${l.id}`}
                      className="cursor-pointer truncate text-xs font-normal"
                    >
                      {l.name}
                    </Label>
                  </div>
                ))}
              </div>
            </FilterSection>
          )}

          {/* Prioridade — sempre visível (4 valores fixos) */}
          <FilterSection
            title="Prioridade"
            icon={<Flag className="size-3" />}
            count={selectedPriorities.size}
            onClear={onClearPriorities}
          >
            <div className="space-y-1">
              {(Object.keys(PRIORITY_META) as ActionPriority[]).map((p) => (
                <div
                  key={p}
                  className="flex items-center gap-2 rounded p-1 hover:bg-muted/40"
                >
                  <Checkbox
                    id={`ws-cal-priority-${p}`}
                    checked={selectedPriorities.has(p)}
                    onCheckedChange={() => onTogglePriority(p)}
                  />
                  <div
                    className={cn(
                      "size-2.5 shrink-0 rounded-full",
                      PRIORITY_META[p].color,
                    )}
                  />
                  <Label
                    htmlFor={`ws-cal-priority-${p}`}
                    className="cursor-pointer text-xs font-normal"
                  >
                    {PRIORITY_META[p].label}
                  </Label>
                </div>
              ))}
            </div>
          </FilterSection>

          {/* Responsáveis (deduzidos das ações no período) */}
          {responsibles.length > 0 && (
            <FilterSection
              title="Responsáveis"
              icon={<Users className="size-3" />}
              count={selectedResponsibleIds.size}
              onClear={onClearResponsibles}
            >
              <div className="space-y-1">
                {responsibles.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-2 rounded p-1 hover:bg-muted/40"
                  >
                    <Checkbox
                      id={`ws-cal-resp-${r.id}`}
                      checked={selectedResponsibleIds.has(r.id)}
                      onCheckedChange={() => onToggleResponsible(r.id)}
                    />
                    <Avatar className="size-5 shrink-0">
                      <AvatarImage src={r.image ?? undefined} alt={r.name} />
                      <AvatarFallback className="text-[9px]">
                        {r.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <Label
                      htmlFor={`ws-cal-resp-${r.id}`}
                      className="cursor-pointer truncate text-xs font-normal"
                    >
                      {r.name}
                    </Label>
                  </div>
                ))}
              </div>
            </FilterSection>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="justify-start text-xs text-muted-foreground"
          >
            <RotateCcw className="mr-1.5 h-3 w-3" />
            Limpar todos os filtros
          </Button>
        </div>
      </div>
    </aside>
  );
}
