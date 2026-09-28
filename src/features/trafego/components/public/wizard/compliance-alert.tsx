"use client";

import { ExternalLink, ShieldAlert, ShieldX } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ComplianceLevel, PolicyHit } from "@/features/trafego/lib/ad-policies";

/**
 * Alerta de política. BLOCKED trava o botão e oferece o gestor; WARNING pede o
 * reconhecimento — o cliente segue, mas sabendo o que pode acontecer.
 *
 * O texto cita o motivo e a correção porque "seu anúncio foi recusado" sem
 * explicação só gera ticket de suporte.
 */
export function ComplianceAlert({
  level,
  issues,
  acknowledged,
  onAcknowledge,
  supportWhatsapp,
}: {
  level: ComplianceLevel;
  issues: PolicyHit[];
  acknowledged?: boolean;
  onAcknowledge?: (value: boolean) => void;
  supportWhatsapp?: string | null;
}) {
  if (level === "OK" || issues.length === 0) return null;

  const isBlocked = level === "BLOCKED";
  const Icon = isBlocked ? ShieldX : ShieldAlert;

  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        isBlocked
          ? "border-rose-400/30 bg-rose-500/[0.08]"
          : "border-amber-400/30 bg-amber-500/[0.08]",
      )}
    >
      <div className="flex items-start gap-2.5">
        <Icon
          className={cn(
            "mt-0.5 size-4 shrink-0",
            isBlocked ? "text-rose-300" : "text-amber-300",
          )}
        />
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-sm font-semibold",
              isBlocked ? "text-rose-100" : "text-amber-100",
            )}
          >
            {isBlocked
              ? "Isso não pode ser anunciado"
              : "Atenção às regras da plataforma"}
          </p>

          <ul className="mt-2.5 space-y-2.5">
            {issues.map((issue, index) => (
              <li key={`${issue.ruleId}-${index}`} className="text-xs leading-relaxed">
                <p className="font-medium text-white/85">
                  {issue.label}
                  {issue.excerpt && (
                    <span className="ml-1.5 font-normal text-white/40">
                      — “{issue.excerpt}”
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-white/55">{issue.reason}</p>
                <p className="mt-0.5 text-white/70">
                  <strong className="font-medium">O que fazer:</strong> {issue.fix}
                </p>
                {issue.sourceUrl && (
                  <a
                    href={issue.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-0.5 inline-flex items-center gap-1 text-white/40 underline underline-offset-2 transition hover:text-white/70"
                  >
                    Regra da plataforma
                    <ExternalLink className="size-2.5" />
                  </a>
                )}
              </li>
            ))}
          </ul>

          {isBlocked && supportWhatsapp && (
            <a
              href={`https://wa.me/${supportWhatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(
                "Olá! Meu anúncio foi sinalizado pelas regras da plataforma e queria falar com um gestor.",
              )}`}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
            >
              Falar com um gestor
            </a>
          )}

          {!isBlocked && onAcknowledge && (
            <label className="mt-3 flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                checked={acknowledged ?? false}
                onChange={(event) => onAcknowledge(event.target.checked)}
                className="mt-0.5 size-3.5 shrink-0 accent-amber-500"
              />
              <span className="text-xs leading-relaxed text-amber-100/90">
                Entendi. Sei que a plataforma pode recusar o anúncio por isso e que a
                taxa de serviço não é devolvida nesse caso.
              </span>
            </label>
          )}
        </div>
      </div>
    </div>
  );
}
