import React from "react";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Bot, CheckCircle2, ChevronDown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ModelOption, ModelType } from "../types";
import {
  AI_PLATFORMS,
  PROVIDER_MODELS,
  PROVIDER_LABELS,
} from "../data/constants";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuGroup,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

interface ModelSelectorProps {
  value: ModelType;
  onChange: (v: ModelType) => void;
}

export function ModelSelector({ value, onChange }: ModelSelectorProps) {
  const { data: integrationsData } = useQuery(
    orpc.platformIntegrations.getMany.queryOptions({}),
  );

  const connectedPlatforms = (integrationsData?.integrations ?? [])
    .map((i) => i.platform)
    .filter((p) => AI_PLATFORMS.includes(p as (typeof AI_PLATFORMS)[number]));

  const connectedSet = new Set(connectedPlatforms);

  const individualOptions: ModelOption[] = [];
  for (const platform of AI_PLATFORMS) {
    if (connectedSet.has(platform)) {
      individualOptions.push(...(PROVIDER_MODELS[platform] ?? []));
    }
  }

  const isAstro = value === "astro";
  const selectedIndividual = individualOptions.find((o) => o.id === value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors border outline-none",
            isAstro
              ? "bg-violet-950/60 border-violet-700/50 text-violet-300 hover:bg-violet-900/60"
              : "bg-zinc-800 border-zinc-700/50 text-zinc-300 hover:bg-zinc-700",
          )}
        >
          {isAstro ? (
            <Sparkles className="w-3.5 h-3.5 text-violet-400" />
          ) : (
            (selectedIndividual?.icon ?? (
              <Bot className="w-3.5 h-3.5 text-zinc-400" />
            ))
          )}
          <span>
            {isAstro ? "Astro" : (selectedIndividual?.label ?? "Modelo")}
          </span>
          <ChevronDown className="w-3 h-3 opacity-50" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-64 bg-zinc-900 border-zinc-700/60 p-0!"
      >
        <DropdownMenuGroup className="p-0">
          <DropdownMenuItem
            onClick={() => onChange("astro")}
            className={cn(
              "flex flex-col items-start gap-1 p-3 cursor-pointer",
              isAstro
                ? "bg-violet-950/80 focus:bg-violet-950/80"
                : "focus:bg-zinc-800/80",
            )}
          >
            <div className="flex items-center gap-2.5 w-full">
              <div className="w-7 h-7 rounded-lg bg-violet-600/20 border border-violet-500/30 flex justify-center items-center shrink-0">
                <Sparkles className="w-3.5 h-3.5 text-violet-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-white">
                    Astro
                  </span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-600/30 text-violet-300 uppercase tracking-wide">
                    Recomendado
                  </span>
                  {isAstro && (
                    <CheckCircle2 className="w-3 h-3 text-violet-400 ml-auto" />
                  )}
                </div>
                <p className="text-[10px] text-zinc-400 mt-0.5 leading-snug whitespace-normal">
                  Consolida todas as IAs conectadas e direciona cada comando ao
                  modelo mais adequado.
                </p>
                {connectedPlatforms.length > 0 ? (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {connectedPlatforms.map((p) => (
                      <span
                        key={p}
                        className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-700/60 text-zinc-400 font-medium"
                      >
                        {PROVIDER_LABELS[p] ?? p}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[9px] text-zinc-600 mt-1">
                    Conecte IAs para potencializar.
                  </p>
                )}
              </div>
            </div>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        {individualOptions.length > 0 && (
          <>
            <DropdownMenuSeparator className="bg-zinc-800 m-0" />
            <DropdownMenuGroup className="p-1">
              <DropdownMenuLabel className="text-[9px] font-semibold uppercase tracking-widest text-zinc-600 px-2">
                Modelo específico
              </DropdownMenuLabel>
              {individualOptions.map((opt) => (
                <DropdownMenuItem
                  key={opt.id}
                  onClick={() => onChange(opt.id)}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2 cursor-pointer focus:bg-zinc-800",
                    value === opt.id
                      ? "bg-zinc-800 text-white"
                      : "text-zinc-400",
                  )}
                >
                  {opt.icon}
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-xs font-medium leading-tight">
                      {opt.label}
                    </span>
                    <span className="text-[10px] text-zinc-500 leading-tight">
                      {opt.sublabel}
                    </span>
                  </div>
                  {value === opt.id && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
