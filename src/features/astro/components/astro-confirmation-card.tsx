"use client";

import { AlertTriangleIcon, CheckIcon, ExternalLinkIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  buildCancelMessage,
  buildConfirmMessage,
  type AstroConfirmationPayload,
  type AstroConfirmationResultPayload,
} from "@/features/astro/lib/astro-confirmation";

/**
 * Card de confirmação de uma escrita proposta pelo Astro (spec 0014, D-2).
 * Os botões não chamam API: enviam a resposta como mensagem, e o próprio
 * orquestrador executa via `confirm_action` — o mesmo caminho do "sim"
 * digitado ou respondido pelo WhatsApp.
 */
export function AstroConfirmationCard({
  payload,
  onRespond,
  disabled,
}: {
  payload: AstroConfirmationPayload;
  onRespond: (text: string) => void;
  disabled?: boolean;
}) {
  const isExpired = new Date(payload.expiresAt).getTime() < Date.now();

  return (
    <div className="w-full overflow-hidden rounded-lg border border-violet-500/30 bg-violet-500/[0.06]">
      <div className="border-b border-violet-500/20 px-3 py-2">
        <p className="text-[11px] uppercase tracking-wider text-violet-300/80">
          Confirme para eu gravar
        </p>
        <p className="text-sm font-semibold text-zinc-100">{payload.title}</p>
      </div>

      <dl className="divide-y divide-zinc-800/60">
        {payload.lines.map((line) => (
          <div key={`${line.label}-${line.value}`} className="flex gap-3 px-3 py-1.5 text-xs">
            <dt className="w-32 shrink-0 text-zinc-500">{line.label}</dt>
            <dd className="min-w-0 flex-1 break-words text-zinc-200">{line.value}</dd>
          </div>
        ))}
      </dl>

      {payload.warnings.length > 0 && (
        <ul className="space-y-1 border-t border-amber-500/20 bg-amber-500/[0.06] px-3 py-2">
          {payload.warnings.map((warning) => (
            <li key={warning} className="flex gap-2 text-xs text-amber-300/90">
              <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" />
              <span>{warning}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2 border-t border-zinc-800/60 px-3 py-2">
        <button
          type="button"
          disabled={disabled || isExpired}
          onClick={() => onRespond(buildConfirmMessage(payload.proposalId))}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition",
            "hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40",
          )}
        >
          <CheckIcon className="size-3.5" />
          Confirmar
        </button>
        <button
          type="button"
          disabled={disabled || isExpired}
          onClick={() => onRespond(buildCancelMessage(payload.proposalId))}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-40"
        >
          <XIcon className="size-3.5" />
          Cancelar
        </button>
        <span className="ml-auto text-[10px] text-zinc-500">
          {isExpired
            ? "Proposta expirada — peça de novo"
            : `Vale até ${new Date(payload.expiresAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
        </span>
      </div>
    </div>
  );
}

export function AstroConfirmationResultCard({
  payload,
}: {
  payload: AstroConfirmationResultPayload;
}) {
  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-lg border",
        payload.ok ? "border-emerald-500/30 bg-emerald-500/[0.06]" : "border-rose-500/30 bg-rose-500/[0.06]",
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        {payload.ok ? (
          <CheckIcon className="size-4 text-emerald-400" />
        ) : (
          <XIcon className="size-4 text-rose-400" />
        )}
        <p className="text-sm text-zinc-100">{payload.summary}</p>
      </div>

      {payload.lines && payload.lines.length > 0 && (
        <dl className="divide-y divide-zinc-800/60 border-t border-zinc-800/60">
          {payload.lines.map((line) => (
            <div key={`${line.label}-${line.value}`} className="flex gap-3 px-3 py-1.5 text-xs">
              <dt className="w-32 shrink-0 text-zinc-500">{line.label}</dt>
              <dd className="min-w-0 flex-1 break-words text-zinc-200">{line.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {payload.links && payload.links.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-zinc-800/60 px-3 py-2">
          {payload.links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex items-center gap-1.5 text-xs text-violet-300 hover:text-violet-200"
            >
              {link.label}
              <ExternalLinkIcon className="size-3" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
