"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check, ChevronDown, Loader2, ShieldAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useApproveAstroAction,
  useRejectAstroAction,
} from "@/features/astro-commander/hooks/use-astro-runs";
import {
  notifyAstroApprovalsChanged,
  useAstroPendingApprovals,
} from "@/features/astro-commander/hooks/use-astro-pending-approvals";

/**
 * Fila de aprovação dentro do widget do ASTRO (spec 0028, RF-8 / RF-11).
 *
 * Fica no topo da conversa porque é o único ponto do fluxo em que uma ação
 * preparada pelo comando depende de alguém — esconder isso numa outra tela é
 * o que faz a execução automática parar sem ninguém perceber.
 */
export function AstroWidgetApprovals({
  defaultExpanded = false,
}: {
  /** Na aba Início a fila já abre expandida; na Conversa fica recolhida. */
  defaultExpanded?: boolean;
} = {}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const { approvals, pendingCount } = useAstroPendingApprovals();
  const approve = useApproveAstroAction();
  const reject = useRejectAstroAction();
  const isBusy = approve.isPending || reject.isPending;

  if (pendingCount === 0) return null;

  function resolve(id: string, action: "approve" | "reject") {
    const mutation = action === "approve" ? approve : reject;
    mutation.mutate(
      { id },
      {
        onSuccess: (result) => {
          notifyAstroApprovalsChanged();
          if (result.ok) toast.success(result.summary);
          else toast.error(result.summary);
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  return (
    <div className="shrink-0 border-b border-amber-400/20 bg-amber-400/[0.07]">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left"
      >
        <ShieldAlert className="size-4 shrink-0 text-amber-300" />
        <span className="min-w-0 flex-1 text-[13px] text-amber-100">
          {pendingCount === 1
            ? "1 ação esperando sua aprovação"
            : `${pendingCount} ações esperando sua aprovação`}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-amber-200/70 transition-transform",
            expanded && "rotate-180",
          )}
        />
      </button>

      {expanded && (
        <div className="max-h-56 space-y-2 overflow-y-auto px-3 pb-3">
          {approvals.map((approval) => (
            <div
              key={approval.id}
              className="rounded-xl border border-white/10 bg-black/30 p-3"
            >
              <p className="text-[12px] font-medium text-white">
                {approval.commandTitle ?? "Ação do ASTRO"}
              </p>
              <p className="mt-0.5 line-clamp-3 text-[11px] leading-relaxed text-white/60">
                {approval.summary}
              </p>

              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => resolve(approval.id, "approve")}
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-500/90 px-2 py-1.5 text-[11px] font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50"
                >
                  {approve.isPending ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Check className="size-3" />
                  )}
                  Aprovar
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => resolve(approval.id, "reject")}
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-white/[0.08] px-2 py-1.5 text-[11px] text-white/70 transition hover:bg-white/[0.14] disabled:opacity-50"
                >
                  <X className="size-3" />
                  Rejeitar
                </button>
              </div>
            </div>
          ))}

          <Link
            href="/astro?aba=aprovacoes"
            className="block py-1 text-center text-[11px] text-white/40 underline-offset-2 hover:text-white/70 hover:underline"
          >
            Ver todas no App ASTRO
          </Link>
        </div>
      )}
    </div>
  );
}
