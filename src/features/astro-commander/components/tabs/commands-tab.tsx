"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Archive,
  FlaskConical,
  MoreVertical,
  Pause,
  Play,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAstroCommands,
  useRunAstroCommandNow,
  useSetAstroCommandStatus,
} from "@/features/astro-commander/hooks/use-astro-commands";
import {
  PERSONA_LABELS,
  STATUS_LABELS,
  formatDateTime,
} from "@/features/astro-commander/lib/labels";
import { CommandAvatar } from "@/features/astro-commander/components/command-avatar";
import { StatusPill } from "@/features/astro-commander/components/status-pill";
import { CreateCommandDialog } from "@/features/astro-commander/components/create-command-dialog";

/**
 * Tela inicial do App ASTRO: a lista de comandos (spec 0023, RF-9).
 * "Criar comando", não "criar assistente" — o assistente é sempre o ASTRO.
 */

type StatusFilter = "TODOS" | "ACTIVE" | "PAUSED" | "DRAFT";

const COLUMNS = [
  "Nome do comando",
  "Papel",
  "Modelo IA",
  "Quando roda",
  "Última edição",
  "Status",
];

export function CommandsTab() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("TODOS");
  const [createOpen, setCreateOpen] = useState(false);

  const filters = useMemo(
    () => ({
      search: search.trim() || undefined,
      status: status === "TODOS" ? undefined : status,
    }),
    [search, status],
  );
  const { commands, isLoading } = useAstroCommands(filters);
  const setCommandStatus = useSetAstroCommandStatus();
  const runNow = useRunAstroCommandNow();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <div className="relative w-full max-w-sm sm:w-72">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar"
            className="h-11 rounded-xl pl-9"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="size-11 rounded-xl">
              <SlidersHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Status</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={status}
              onValueChange={(value) => setStatus(value as StatusFilter)}
            >
              <DropdownMenuRadioItem value="TODOS">Todos</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="ACTIVE">Ativos</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="PAUSED">Pausados</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="DRAFT">Rascunhos</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          onClick={() => setCreateOpen(true)}
          className="h-11 rounded-xl bg-primary px-5"
        >
          <Plus className="size-4" />
          Criar comando
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2 rounded-2xl border p-4">
          {[0, 1, 2, 3].map((row) => (
            <Skeleton key={row} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : commands.length === 0 ? (
        <EmptyState onCreate={() => setCreateOpen(true)} />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card">
          <div className="hidden grid-cols-[minmax(0,2.2fr)_1fr_1fr_1.2fr_1fr_auto_40px] items-center gap-4 border-b bg-muted/40 px-6 py-4 text-sm font-medium text-muted-foreground lg:grid">
            {COLUMNS.map((column) => (
              <span key={column}>{column}</span>
            ))}
            <span />
          </div>

          <div className="divide-y">
            {commands.map((command) => (
              <div
                key={command.id}
                className="grid grid-cols-1 items-center gap-3 px-6 py-4 transition-colors hover:bg-muted/30 lg:grid-cols-[minmax(0,2.2fr)_1fr_1fr_1.2fr_1fr_auto_40px] lg:gap-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <CommandAvatar persona={command.persona} iconUrl={command.iconUrl} />
                  <div className="min-w-0">
                    <Link
                      href={`/astro/comandos/${command.id}`}
                      className="block truncate font-medium hover:underline"
                    >
                      {command.title}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground lg:hidden">
                      {command.triggerLabel}
                    </p>
                  </div>
                </div>

                <span className="hidden text-sm text-muted-foreground lg:block">
                  {PERSONA_LABELS[command.persona]}
                </span>
                <span className="hidden truncate text-sm text-muted-foreground lg:block">
                  {command.modelId ?? "Automático"}
                </span>
                <span className="hidden text-sm text-muted-foreground lg:block">
                  {command.triggerLabel}
                </span>
                <span className="hidden text-sm text-muted-foreground lg:block">
                  {formatDateTime(command.updatedAt)}
                </span>

                <div className="flex items-center justify-between gap-2 lg:justify-start">
                  <StatusPill status={command.status} label={STATUS_LABELS[command.status]} />

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="lg:hidden">
                        <MoreVertical className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <CommandMenu
                      command={command}
                      onRun={(test) =>
                        runNow.mutate(
                          { id: command.id, test },
                          {
                            onSuccess: (result) =>
                              toast.success(
                                test
                                  ? result.summary?.slice(0, 120) || "Teste concluído"
                                  : "Execução enfileirada",
                              ),
                            onError: (error) => toast.error(error.message),
                          },
                        )
                      }
                      onStatus={(next, message) =>
                        setCommandStatus.mutate(
                          { id: command.id, status: next },
                          { onSuccess: () => toast.success(message) },
                        )
                      }
                    />
                  </DropdownMenu>
                </div>

                <div className="hidden justify-end lg:flex">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <CommandMenu
                      command={command}
                      onRun={(test) =>
                        runNow.mutate(
                          { id: command.id, test },
                          {
                            onSuccess: (result) =>
                              toast.success(
                                test
                                  ? result.summary?.slice(0, 120) || "Teste concluído"
                                  : "Execução enfileirada",
                              ),
                            onError: (error) => toast.error(error.message),
                          },
                        )
                      }
                      onStatus={(next, message) =>
                        setCommandStatus.mutate(
                          { id: command.id, status: next },
                          { onSuccess: () => toast.success(message) },
                        )
                      }
                    />
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <CreateCommandDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function CommandMenu({
  command,
  onRun,
  onStatus,
}: {
  command: { status: string };
  onRun: (test: boolean) => void;
  onStatus: (status: "ACTIVE" | "PAUSED" | "ARCHIVED", message: string) => void;
}) {
  return (
    <DropdownMenuContent align="end">
      <DropdownMenuItem onClick={() => onRun(false)}>
        <Play className="size-4" />
        Rodar agora
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => onRun(true)}>
        <FlaskConical className="size-4" />
        Testar comando
      </DropdownMenuItem>
      {command.status === "ACTIVE" ? (
        <DropdownMenuItem onClick={() => onStatus("PAUSED", "Comando pausado")}>
          <Pause className="size-4" />
          Pausar
        </DropdownMenuItem>
      ) : (
        <DropdownMenuItem onClick={() => onStatus("ACTIVE", "Comando ativo")}>
          <Play className="size-4" />
          Ativar
        </DropdownMenuItem>
      )}
      <DropdownMenuItem onClick={() => onStatus("ARCHIVED", "Comando arquivado")}>
        <Archive className="size-4" />
        Arquivar
      </DropdownMenuItem>
    </DropdownMenuContent>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed py-20 text-center">
      <Sparkles className="size-8 text-muted-foreground" />
      <div>
        <p className="font-medium">Nenhum comando ainda</p>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          Descreva o que o ASTRO deve fazer, por exemplo &quot;todo dia às 8h
          conciliar extrato&quot;, e ele passa a executar sozinho.
        </p>
      </div>
      <Button onClick={onCreate} className="rounded-xl">
        <Plus className="size-4" />
        Criar comando
      </Button>
    </div>
  );
}
