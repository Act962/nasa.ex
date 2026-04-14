"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SidebarField } from "./sidebar-field";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";
import { FolderOpen } from "lucide-react";

interface OrgProjectFieldProps {
  value?: string | null;
  onValueChange: (value: string | null) => void;
  disabled?: boolean;
}

export function OrgProjectField({
  value,
  onValueChange,
  disabled,
}: OrgProjectFieldProps) {
  const { data: projectsData } = useQuery(
    orpc.orgProjects.list.queryOptions({ input: {} })
  );
  const projects = projectsData?.projects ?? [];

  const current = projects.find((p) => p.id === value);

  return (
    <SidebarField label="Projetos/Clientes" icon={<FolderOpen className="size-3" />}>
      <Select
        value={value ?? "none"}
        onValueChange={(v) => onValueChange(v === "none" ? null : v)}
        disabled={disabled}
      >
        <SelectTrigger className="h-8 text-xs bg-background w-full">
          <SelectValue placeholder="Sem projeto">
            {current ? (
              <div className="flex items-center gap-2">
                <div
                  className="size-2 rounded-full shrink-0"
                  style={{ backgroundColor: current.color ?? "#7c3aed" }}
                />
                <span className="truncate">{current.name}</span>
              </div>
            ) : (
              <span className="text-muted-foreground">Sem projeto</span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">
            <span className="text-muted-foreground">Sem projeto</span>
          </SelectItem>
          {projects.map((project) => (
            <SelectItem key={project.id} value={project.id}>
              <div className="flex items-center gap-2">
                <div
                  className="size-2 rounded-full shrink-0"
                  style={{ backgroundColor: project.color ?? "#7c3aed" }}
                />
                {project.name}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </SidebarField>
  );
}
