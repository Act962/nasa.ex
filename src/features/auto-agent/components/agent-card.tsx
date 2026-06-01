"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BotIcon, MoreVerticalIcon, UsersIcon } from "lucide-react";
import { useDeleteAgent, useUpdateAgent } from "../hooks/use-agents";

interface AgentCardProps {
  agent: {
    id: string;
    name: string;
    description: string | null;
    mode: string;
    isActive: boolean;
    trackingId: string | null;
    followUpSchedule: number[];
    sessionsActive: number;
    sessionsTotal: number;
  };
  onEdit?: () => void;
}

/**
 * Card de um agente IA. Mostra status + 2 contadores (sessões ativas, total),
 * tem toggle individual + dropdown de ações (editar, excluir).
 *
 * Toggle = `Agent.isActive`. Pausa global via /settings/astro é separada
 * (não tem indicador aqui — fica numa banner global no /tracking/.../agente).
 */
export function AgentCard({ agent, onEdit }: AgentCardProps) {
  const update = useUpdateAgent();
  const del = useDeleteAgent();

  return (
    <Card className="p-4 flex flex-col gap-3 group">
      <div className="flex items-start gap-3">
        <div className="size-10 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
          <BotIcon className="size-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm leading-tight">{agent.name}</h3>
          <div className="flex items-center gap-1.5 mt-1">
            <Badge
              variant="outline"
              className="text-[10px] uppercase tracking-wide"
            >
              {agent.mode}
            </Badge>
            {agent.isActive ? (
              <Badge className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-300">
                Ativo
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px]">
                Pausado
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Switch
            checked={agent.isActive}
            disabled={update.isPending}
            onCheckedChange={(v) =>
              update.mutate({ id: agent.id, isActive: v })
            }
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm">
                <MoreVerticalIcon className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>Editar</DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => {
                  if (
                    confirm(
                      `Excluir "${agent.name}"? Apaga ${agent.sessionsActive} sessão(ões) ativa(s).`,
                    )
                  ) {
                    del.mutate({ id: agent.id });
                  }
                }}
              >
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {agent.description && (
        <p className="text-xs text-muted-foreground line-clamp-2">
          {agent.description}
        </p>
      )}

      <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-2 border-t">
        <span className="inline-flex items-center gap-1">
          <UsersIcon className="size-3" />
          {agent.sessionsActive} ativa(s) / {agent.sessionsTotal} total
        </span>
        <span>· Follow-up: {agent.followUpSchedule.join("/")} dias</span>
      </div>
    </Card>
  );
}
