"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ChevronLeft,
  FlaskConical,
  LayoutDashboard,
  ListChecks,
  MessageSquareText,
  Settings2,
  Wrench,
} from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  useAstroCommand,
  useRunAstroCommandNow,
} from "@/features/astro-commander/hooks/use-astro-commands";
import { PERSONA_LABELS, STATUS_LABELS } from "@/features/astro-commander/lib/labels";
import { CommandAvatar } from "@/features/astro-commander/components/command-avatar";
import { StatusPill } from "@/features/astro-commander/components/status-pill";
import { CommandDashboardSection } from "@/features/astro-commander/components/sections/command-dashboard-section";
import { CommandConfigureSection } from "@/features/astro-commander/components/sections/command-configure-section";
import { CommandPromptSection } from "@/features/astro-commander/components/sections/command-prompt-section";
import { CommandActionsSection } from "@/features/astro-commander/components/sections/command-actions-section";
import { CommandRunsSection } from "@/features/astro-commander/components/sections/command-runs-section";

/**
 * Página de um comando (spec 0028, RF-18). Coluna lateral com o card do
 * comando e o menu de seções; o conteúdo troca à direita.
 */

const SECTIONS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "configurar", label: "Configurar", icon: Settings2 },
  { key: "prompt", label: "Prompt", icon: MessageSquareText },
  { key: "acoes", label: "Ações", icon: Wrench },
  { key: "execucoes", label: "Execuções", icon: ListChecks },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

export function CommandDetail({ commandId }: { commandId: string }) {
  const [section, setSection] = useState<SectionKey>("dashboard");
  const { command, runsToday, isLoading } = useAstroCommand(commandId);
  const runNow = useRunAstroCommandNow();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-4 lg:flex-row">
        <Skeleton className="h-96 w-full lg:w-72" />
        <Skeleton className="h-96 flex-1" />
      </div>
    );
  }

  if (!command) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        Comando não encontrado.{" "}
        <Link href="/astro" className="underline">
          Voltar para comandos
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-4 pb-10 pt-4 md:px-6 lg:flex-row lg:gap-8">
      <aside className="w-full shrink-0 space-y-5 lg:w-72">
        <Link
          href="/astro"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Voltar para comandos
        </Link>

        <div className="space-y-4 rounded-2xl border bg-card p-5">
          <div className="flex items-start gap-3">
            <CommandAvatar
              persona={command.persona}
              iconUrl={command.iconUrl}
              size="lg"
            />
            <div className="min-w-0 space-y-0.5">
              <p className="truncate font-semibold leading-tight">{command.title}</p>
              <p className="text-xs text-muted-foreground">
                ID: {command.id.slice(-8)}
              </p>
            </div>
          </div>

          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Papel</dt>
              <dd className="truncate">{PERSONA_LABELS[command.persona]}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Quando roda</dt>
              <dd className="truncate text-right">{command.triggerLabel}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Hoje</dt>
              <dd>
                {runsToday}/{command.maxRunsPerDay}
              </dd>
            </div>
          </dl>

          <StatusPill
            status={command.status}
            label={STATUS_LABELS[command.status]}
          />

          <Button
            className="h-11 w-full rounded-xl"
            onClick={() =>
              runNow.mutate(
                { id: command.id, test: true },
                {
                  onSuccess: (result) =>
                    toast.success(result.summary?.slice(0, 160) || "Teste concluído"),
                  onError: (error) => toast.error(error.message),
                },
              )
            }
            disabled={runNow.isPending}
          >
            {runNow.isPending ? (
              <OrbitaSpinner className="size-4 " />
            ) : (
              <FlaskConical className="size-4" />
            )}
            Testar comando
          </Button>
        </div>

        <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
          {SECTIONS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setSection(item.key)}
              className={cn(
                "flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors lg:w-full",
                section === item.key
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <section className="min-w-0 flex-1">
        {section === "dashboard" && <CommandDashboardSection commandId={command.id} />}
        {section === "configurar" && <CommandConfigureSection command={command} />}
        {section === "prompt" && <CommandPromptSection command={command} />}
        {section === "acoes" && <CommandActionsSection command={command} />}
        {section === "execucoes" && <CommandRunsSection commandId={command.id} />}
      </section>
    </div>
  );
}
