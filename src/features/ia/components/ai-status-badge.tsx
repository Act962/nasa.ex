"use client";

import Link from "next/link";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAiResourceStatus } from "@/features/ia/hooks/use-ai-resources";
import type { AiBadgeState } from "@/features/ia/lib/ai-badge-state";
import { formatBrl } from "@/features/ia/lib/format-brl";
import { cn } from "@/lib/utils";

// Selo de IA no cabeçalho dos Apps (spec 0093, RF-11): mostra se o recurso roda na chave da empresa,
// na IA básica da plataforma ou se está desligado. Dono e admin abrem o resumo; os demais só veem o selo.

const AI_SETTINGS_HREF = "/integrations#ia-da-empresa";

const STATE_STYLE: Record<AiBadgeState, { dot: string; pill: string; label: string; memberLabel: string; action: string }> = {
  own: { dot: "bg-success", pill: "bg-success/10 text-success", label: "IA ligada", memberLabel: "IA ligada", action: "Trocar em Satélites" },
  platform: { dot: "bg-warning", pill: "bg-warning/15 text-warning", label: "IA básica da plataforma", memberLabel: "IA ligada", action: "Usar minha chave" },
  off: { dot: "bg-muted-foreground", pill: "bg-muted text-muted-foreground", label: "IA desligada", memberLabel: "IA desligada", action: "Cadastrar chave" },
};

const KEY_SOURCE_LABEL: Record<string, string> = {
  company: "sua chave",
  funnel: "chave deste funil",
  planner: "chave do Planner",
  platform: "plataforma, modelo básico",
  free: "serviço gratuito",
  none: "nenhuma",
};

export function AiStatusBadge({ resourceId, trackingId, className }: { resourceId: string; trackingId?: string; className?: string }) {
  const { data: status } = useAiResourceStatus(resourceId, { trackingId });
  if (!status) return null;

  const style = STATE_STYLE[status.state];
  const { detail } = status;
  const pillClassName = cn("inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium", style.pill, className);
  const dot = <span className={cn("size-2 rounded-full", style.dot)} aria-hidden />;

  if (!detail) {
    return (
      <span className={pillClassName}>
        {dot}
        {style.memberLabel}
      </span>
    );
  }

  const ownKeyLabel = status.state === "own" ? ` · ${KEY_SOURCE_LABEL[detail.keySource]}${detail.providerLabel ? ` ${detail.providerLabel}` : ""}` : "";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={cn(pillClassName, "hover:opacity-80")}>
          {dot}
          {style.label}
          {ownKeyLabel}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-2 rounded-2xl text-sm">
        <p className="font-semibold">{status.label}</p>
        <div className="space-y-1 text-muted-foreground">
          <p>
            Chave:{" "}
            <span className="font-medium text-foreground">
              {KEY_SOURCE_LABEL[detail.keySource]}
              {detail.providerLabel && status.state === "own" ? ` ${detail.providerLabel}` : ""}
            </span>
            {detail.keyLast4 ? ` · final ${detail.keyLast4}` : ""}
          </p>
          {detail.modelName && (
            <p>
              Modelo: <span className="font-medium text-foreground">{detail.bandLabel ?? detail.modelName}</span>
              {detail.bandLabel ? ` · ${detail.modelName}` : ""}
            </p>
          )}
          <p>
            Este mês: <span className="font-medium text-foreground">{formatBrl(detail.monthCostBrl)}</span>
            {detail.isCostPartial ? " (parcial)" : ""} · {detail.monthCalls.toLocaleString("pt-BR")} usos
            {detail.monthStars > 0 ? ` · ${detail.monthStars.toLocaleString("pt-BR")} Stars` : ""}
          </p>
          {status.state === "platform" && <p>Funciona no modelo básico, pago em Stars.</p>}
          {detail.note && <p className="text-warning">{detail.note}</p>}
        </div>
        <Link href={AI_SETTINGS_HREF} className="inline-block font-medium text-primary hover:underline">
          {style.action} ›
        </Link>
      </PopoverContent>
    </Popover>
  );
}
