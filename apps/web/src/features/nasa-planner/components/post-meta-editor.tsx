"use client";

import { useState, useEffect } from "react";
import { BuildingIcon, FolderIcon, CalendarIcon, MegaphoneIcon, XIcon, CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";
import { useUpdatePlannerPost } from "../hooks/use-nasa-planner";

interface PostMeta {
  id: string;
  clientOrgName?: string | null;
  orgProjectId?: string | null;
  orgProject?: { id: string; name: string } | null;
  scheduledAt?: string | null;
  isAd?: boolean;
}

function toLocalDatetimeValue(scheduledAt: string | null | undefined): string {
  if (!scheduledAt) return "";
  const d = new Date(scheduledAt);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function PostMetaEditor({ post }: { post: PostMeta }) {
  const updatePost = useUpdatePlannerPost();
  const { data: organizations } = authClient.useListOrganizations();

  const matchedOrg = (organizations ?? []).find((o: any) => o.name === post.clientOrgName);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(matchedOrg?.id ?? null);
  const [orgOpen, setOrgOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [dateValue, setDateValue] = useState(() => toLocalDatetimeValue(post.scheduledAt));

  // Sync only when post.id changes (dialog opened for different post)
  useEffect(() => {
    setDateValue(toLocalDatetimeValue(post.scheduledAt));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id]);

  const { data: projectsData } = useQuery({
    ...orpc.orgProjects.list.queryOptions({ input: { orgId: selectedOrgId ?? undefined, isActive: true } }),
    enabled: !!selectedOrgId,
  });
  const orgProjects = projectsData?.projects ?? [];

  const clientOrgName = post.clientOrgName ?? "";
  const orgProjectId = post.orgProjectId ?? null;
  const selectedProject = orgProjects.find((p: any) => p.id === orgProjectId);

  return (
    <div className="space-y-3">
      {/* Empresa */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
          <BuildingIcon className="size-3" />Empresa
        </Label>
        <Popover open={orgOpen} onOpenChange={setOrgOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" role="combobox" className="w-full justify-between font-normal h-8 text-xs">
              {clientOrgName ? (
                <span className="truncate">{clientOrgName}</span>
              ) : <span className="text-muted-foreground">Selecionar empresa...</span>}
              <ChevronsUpDownIcon className="ml-1 size-3 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar empresa..." className="h-8 text-xs" />
              <CommandList>
                <CommandEmpty className="text-xs py-3">Nenhuma encontrada.</CommandEmpty>
                <CommandGroup>
                  <CommandItem value="__none__" onSelect={() => {
                    setSelectedOrgId(null);
                    updatePost.mutate({ postId: post.id, clientOrgName: "" });
                    setOrgOpen(false);
                  }} className="text-xs text-muted-foreground">
                    <BuildingIcon className="size-3 mr-2 opacity-50" />Nenhuma
                  </CommandItem>
                  {(organizations ?? []).map((org: any) => (
                    <CommandItem key={org.id} value={org.name} className="text-xs" onSelect={() => {
                      setSelectedOrgId(org.id);
                      updatePost.mutate({ postId: post.id, clientOrgName: org.name });
                      setOrgOpen(false);
                    }}>
                      <BuildingIcon className="size-3 mr-2 opacity-60" />
                      <span className="flex-1 truncate">{org.name}</span>
                      <CheckIcon className={cn("size-3", clientOrgName === org.name ? "opacity-100" : "opacity-0")} />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Projeto / Cliente */}
      {selectedOrgId && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
            <FolderIcon className="size-3" />Projeto / Cliente
          </Label>
          <Popover open={projectOpen} onOpenChange={setProjectOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" role="combobox" className="w-full justify-between font-normal h-8 text-xs">
                {selectedProject ? (
                  <span className="truncate">{(selectedProject as any).name}</span>
                ) : <span className="text-muted-foreground">Selecionar projeto...</span>}
                <ChevronsUpDownIcon className="ml-1 size-3 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0" align="start">
              <Command>
                <CommandInput placeholder="Buscar projeto..." className="h-8 text-xs" />
                <CommandList>
                  <CommandEmpty className="text-xs py-3">Nenhum encontrado.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem value="__none__" className="text-xs text-muted-foreground" onSelect={() => {
                      updatePost.mutate({ postId: post.id, orgProjectId: undefined });
                      setProjectOpen(false);
                    }}>
                      <FolderIcon className="size-3 mr-2 opacity-50" />Nenhum
                    </CommandItem>
                    {orgProjects.map((p: any) => (
                      <CommandItem key={p.id} value={p.name} className="text-xs" onSelect={() => {
                        updatePost.mutate({ postId: post.id, orgProjectId: p.id });
                        setProjectOpen(false);
                      }}>
                        <div className="size-2.5 rounded-full mr-2 shrink-0" style={{ backgroundColor: p.color ?? "#7c3aed" }} />
                        <span className="flex-1 truncate">{p.name}</span>
                        <CheckIcon className={cn("size-3", orgProjectId === p.id ? "opacity-100" : "opacity-0")} />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Data de publicação */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
          <CalendarIcon className="size-3" />Data de Publicação
        </Label>
        <div className="flex gap-2 items-center">
          <Input
            type="datetime-local"
            value={dateValue}
            className="flex-1 h-8 text-xs"
            onChange={(e) => setDateValue(e.target.value)}
            onBlur={() => {
              if (dateValue) {
                // Convert local datetime string to UTC ISO so the server stores the correct time
                updatePost.mutate({ postId: post.id, scheduledAt: new Date(dateValue).toISOString() });
              } else {
                updatePost.mutate({ postId: post.id, scheduledAt: undefined });
              }
            }}
          />
          {dateValue && (
            <Button size="sm" variant="ghost" className="h-8 px-2 text-muted-foreground hover:text-destructive"
              onClick={() => {
                setDateValue("");
                updatePost.mutate({ postId: post.id, scheduledAt: null });
              }}>
              <XIcon className="size-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Post para anúncio */}
      <div className="flex items-center justify-between rounded-md border px-3 py-2">
        <Label className="text-xs flex items-center gap-1.5 cursor-pointer">
          <MegaphoneIcon className="size-3 text-orange-500" />
          Post para anúncio
        </Label>
        <Switch
          checked={post.isAd ?? false}
          onCheckedChange={(v) => updatePost.mutate({ postId: post.id, isAd: v })}
        />
      </div>
    </div>
  );
}
