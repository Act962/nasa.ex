import React, { useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronDown, Orbit, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AI_PLATFORMS, PROVIDER_LABELS } from "../data/constants";
import { useQueryPlatformIntegrations } from "@/features/integrations/hooks/use-integrations";
import { useAstroAiMode, useSetAstroAiMode } from "@/features/astro/hooks/use-astro-ai-mode";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

interface MenuPlacement {
  widthPx: number;
  alignOffsetPx: number;
  sideOffsetPx: number;
}

const MENU_GAP_PX = 8;

// O menu abre com a mesma largura e as mesmas bordas da caixa de comando, logo acima dela.
function measureMenuPlacement(trigger: HTMLElement): MenuPlacement | null {
  const composer = trigger.closest<HTMLElement>("[data-home-composer]");
  if (!composer) return null;
  const triggerRect = trigger.getBoundingClientRect();
  const composerRect = composer.getBoundingClientRect();
  return {
    widthPx: composerRect.width,
    alignOffsetPx: composerRect.left - triggerRect.left,
    sideOffsetPx: triggerRect.top - composerRect.top + MENU_GAP_PX,
  };
}

/** IA do ASTRO (spec 0053): a da empresa, conectada como satélite, ou o modelo ÓRBITA. */
export function ModelSelector() {
  const { data: aiModeData } = useAstroAiMode();
  const setAstroAiMode = useSetAstroAiMode();
  const { data: integrationsData } = useQueryPlatformIntegrations();

  const connectedAiProviders = (integrationsData?.integrations ?? [])
    .filter(
      (integration) =>
        integration.isActive &&
        AI_PLATFORMS.includes(integration.platform as (typeof AI_PLATFORMS)[number]),
    )
    .map((integration) => PROVIDER_LABELS[integration.platform] ?? integration.platform);

  const mode = aiModeData?.mode ?? null;
  const isOwnKeyConnected = aiModeData?.isOwnKeyConnected ?? false;
  const chipLabel = mode === "OWN" ? "Sua IA" : mode === "PLATFORM" ? "ÓRBITA" : "Escolher IA";
  const chipDetail =
    mode === "OWN" ? connectedAiProviders[0] : mode === "PLATFORM" ? "GPT-4o mini" : undefined;

  const triggerRef = useRef<HTMLButtonElement>(null);
  const [menuPlacement, setMenuPlacement] = useState<MenuPlacement | null>(null);

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && triggerRef.current) setMenuPlacement(measureMenuPlacement(triggerRef.current));
  };

  const choosePlatformModel = () => {
    setAstroAiMode.mutate(
      { mode: "PLATFORM" },
      { onError: () => toast.error("Não consegui salvar a escolha. Tente de novo.") },
    );
  };

  return (
    <DropdownMenu onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          ref={triggerRef}
          className="flex h-10 max-w-[11rem] shrink-0 items-center gap-1.5 rounded-full bg-knob px-3.5 text-sm font-medium text-foreground outline-none transition-colors hover:bg-accent"
        >
          {mode === null ? (
            <Orbit className="size-3.5 shrink-0 text-warning" />
          ) : (
            <Sparkles className="size-3.5 shrink-0 text-info" />
          )}
          <span className="min-w-0 truncate">{chipLabel}</span>
          {chipDetail && <span className="shrink-0 text-muted-foreground">{chipDetail}</span>}
          <ChevronDown className="size-3.5 shrink-0 opacity-50" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        side="top"
        align={menuPlacement ? "start" : "end"}
        alignOffset={menuPlacement?.alignOffsetPx}
        sideOffset={menuPlacement?.sideOffsetPx ?? MENU_GAP_PX}
        avoidCollisions={!menuPlacement}
        style={menuPlacement ? { width: menuPlacement.widthPx } : undefined}
        className={cn("bg-card", !menuPlacement && "w-72")}
      >
        <DropdownMenuLabel className="px-2 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
          Inteligência do ASTRO
        </DropdownMenuLabel>
        <DropdownMenuGroup>
          <DropdownMenuItem
            asChild
            className={cn(
              "flex cursor-pointer flex-col items-start gap-1 rounded-[13px] p-3",
              mode === "OWN" ? "bg-info/15 focus:bg-info/20" : "focus:bg-accent",
            )}
          >
            <Link href="/integrations?connect=OPENAI">
              <div className="flex w-full items-center gap-2.5">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-info/20 text-info">
                  <Orbit className="size-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-foreground">Sua IA</span>
                    <span className="rounded-full bg-info/30 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-info">
                      Recomendado
                    </span>
                    {mode === "OWN" && <CheckCircle2 className="ml-auto size-3 text-info" />}
                  </div>
                  <p className="mt-0.5 whitespace-normal text-[10px] leading-snug text-muted-foreground">
                    {isOwnKeyConnected
                      ? `Conectada como satélite: ${connectedAiProviders.join(", ")}. Sem custo de tokens em Stars.`
                      : "Conecte a OpenAI, Gemini ou Anthropic da sua empresa — o primeiro satélite do ASTRO."}
                  </p>
                </div>
              </div>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={choosePlatformModel}
            disabled={isOwnKeyConnected}
            className={cn(
              "flex cursor-pointer items-center gap-2.5 rounded-[13px] px-3 py-2.5",
              mode === "PLATFORM" ? "bg-accent text-foreground" : "focus:bg-accent",
            )}
          >
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-knob text-foreground">
              <Sparkles className="size-3.5" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-xs font-medium leading-tight">Modelo ÓRBITA</span>
              <span className="text-[10px] leading-tight text-muted-foreground">
                GPT-4o mini · cobrado em Stars
              </span>
            </div>
            {mode === "PLATFORM" && <CheckCircle2 className="size-3.5 shrink-0 text-info" />}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
