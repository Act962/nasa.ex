"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check, ChevronDown, ShieldAlert, X } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
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
type ApprovalsSurface = "astro-panel" | "theme";

const SURFACE_CLASSES: Record<
  ApprovalsSurface,
  {
    container: string;
    title: string;
    chevron: string;
    item: string;
    itemTitle: string;
    itemSummary: string;
    rejectButton: string;
    footerLink: string;
  }
> = {
  "astro-panel": {
    container: "border-b border-warning/20 bg-warning/[0.07]",
    title: "text-foreground",
    chevron: "text-foreground/60",
    item: "border border-foreground/10 bg-foreground/[0.03] dark:bg-black/30",
    itemTitle: "text-foreground",
    itemSummary: "text-foreground/60",
    rejectButton: "bg-foreground/[0.08] text-foreground/70 hover:bg-foreground/[0.14]",
    footerLink: "text-foreground/40 hover:text-foreground/70",
  },
  theme: {
    container: "rounded-2xl border border-warning/30 bg-warning/15",
    title: "text-foreground",
    chevron: "text-muted-foreground",
    item: "border border-line bg-card",
    itemTitle: "text-foreground",
    itemSummary: "text-muted-foreground",
    rejectButton: "bg-knob text-muted-foreground hover:text-foreground",
    footerLink: "text-muted-foreground hover:text-foreground",
  },
};

export function AstroWidgetApprovals({
  defaultExpanded = false,
  surface = "astro-panel",
}: {
  /** Na aba Início a fila já abre expandida; na Conversa fica recolhida. */
  defaultExpanded?: boolean;
  /** O painel do ASTRO é sempre escuro; fora dele a fila segue o tema. */
  surface?: ApprovalsSurface;
} = {}) {
  const surfaceClasses = SURFACE_CLASSES[surface];
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
    <div className={cn("shrink-0", surfaceClasses.container)}>
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left"
      >
        <ShieldAlert className="size-4 shrink-0 text-warning" />
        <span className={cn("min-w-0 flex-1 text-[13px]", surfaceClasses.title)}>
          {pendingCount === 1
            ? "1 ação esperando sua aprovação"
            : `${pendingCount} ações esperando sua aprovação`}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 transition-transform",
            surfaceClasses.chevron,
            expanded && "rotate-180",
          )}
        />
      </button>

      {expanded && (
        <div className="max-h-56 space-y-2 overflow-y-auto px-3 pb-3">
          {approvals.map((approval) => (
            <div
              key={approval.id}
              className={cn("rounded-xl p-3", surfaceClasses.item)}
            >
              <p className={cn("text-[12px] font-medium", surfaceClasses.itemTitle)}>
                {approval.commandTitle ?? "Ação do ASTRO"}
              </p>
              <p className={cn("mt-0.5 line-clamp-3 text-[11px] leading-relaxed", surfaceClasses.itemSummary)}>
                {approval.summary}
              </p>

              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => resolve(approval.id, "approve")}
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-success/90 px-2 py-1.5 text-[11px] font-medium text-white transition hover:bg-success disabled:opacity-50"
                >
                  {approve.isPending ? (
                    <OrbitaSpinner className="size-3 " />
                  ) : (
                    <Check className="size-3" />
                  )}
                  Aprovar
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => resolve(approval.id, "reject")}
                  className={cn(
                    "inline-flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[11px] transition disabled:opacity-50",
                    surfaceClasses.rejectButton,
                  )}
                >
                  <X className="size-3" />
                  Rejeitar
                </button>
              </div>
            </div>
          ))}

          <Link
            href="/astro?aba=aprovacoes"
            className={cn(
              "block py-1 text-center text-[11px] underline-offset-2 hover:underline",
              surfaceClasses.footerLink,
            )}
          >
            Ver todas no App ASTRO
          </Link>
        </div>
      )}
    </div>
  );
}
