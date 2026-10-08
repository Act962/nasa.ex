"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { PublishGroupPost } from "../../hooks/use-planner-publish-group";
import { accountHandleOf } from "./publish-group-bar";
import type { PlannerClient } from "./planner-v2-types";

/** Checklist da marca por conta (spec 0074, RF-8): cada conta usa o próprio kit, e uma reprovada não some atrás das outras. */
export function GroupChecklists({ groupPosts, client }: { groupPosts: PublishGroupPost[]; client: PlannerClient | undefined }) {
  return (
    <section className="rounded-2xl bg-panel p-3">
      <p className="mb-2 text-xs font-semibold text-muted-foreground">Checklist da marca por conta</p>
      <ul className="space-y-2 text-sm">
        {groupPosts.map((groupPost) => {
          const warnings = groupPost.checklist.filter((item) => item.status === "warn");
          return (
            <li key={groupPost.id} className="flex items-start gap-2">
              {warnings.length > 0 ? <AlertTriangle className="size-4 shrink-0 text-warning" /> : <CheckCircle2 className="size-4 shrink-0 text-success" />}
              <span>
                <span className="font-medium">{accountHandleOf(client, groupPost.targetIgAccountId)}</span>
                {groupPost.isGroupContentDetached && <span className="ml-1 text-[11px] text-warning">conteúdo diferente</span>}
                {warnings.length === 0 ? (
                  <span className="block text-xs text-muted-foreground">Sem pendências do kit desta conta.</span>
                ) : (
                  warnings.map((warning) => (
                    <span key={warning.id} className="block text-xs text-muted-foreground">
                      {warning.label}
                      {warning.detail && `: ${warning.detail}`}
                    </span>
                  ))
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
