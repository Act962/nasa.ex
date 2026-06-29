"use client";

import { useMemo, useState } from "react";
import {
  Building2Icon,
  CheckCircle2Icon,
  ClockIcon,
  XCircleIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { ShareTargetsField } from "../../share-targets-field";
import {
  useListOutgoingShares,
  useShareActionWithOrgs,
} from "@/features/workspace/hooks/use-workspace";
import { cn } from "@/lib/utils";

interface Props {
  actionId: string;
  disabled?: boolean;
}

const STATUS_META = {
  PENDING: {
    label: "Aguardando aprovação",
    Icon: ClockIcon,
    className: "text-amber-600 dark:text-amber-400",
  },
  APPROVED: {
    label: "Compartilhado",
    Icon: CheckCircle2Icon,
    className: "text-emerald-600 dark:text-emerald-400",
  },
  REJECTED: {
    label: "Rejeitado",
    Icon: XCircleIcon,
    className: "text-red-600 dark:text-red-400",
  },
} as const;

/**
 * Card no sidebar do ViewActionModal: lista os shares já feitos pra essa
 * action + multi-select pra adicionar novos.
 */
export function ActionShareTargetsField({ actionId, disabled }: Props) {
  const [pendingSelection, setPendingSelection] = useState<string[]>([]);
  const { shares } = useListOutgoingShares();
  const shareWithOrgs = useShareActionWithOrgs();

  const actionShares = useMemo(
    () =>
      (shares as any[]).filter((s) => s.sourceAction?.id === actionId),
    [shares, actionId],
  );

  const alreadySharedOrgIds = useMemo(
    () =>
      new Set(
        actionShares
          .filter((s) => s.status === "PENDING" || s.status === "APPROVED")
          .map((s) => s.targetOrg?.id)
          .filter(Boolean),
      ),
    [actionShares],
  );

  const handleSubmit = () => {
    if (pendingSelection.length === 0) return;
    shareWithOrgs.mutate(
      { actionId, targetOrgIds: pendingSelection },
      { onSuccess: () => setPendingSelection([]) },
    );
  };

  return (
    <div className="space-y-2.5 rounded-lg border border-border/60 bg-card p-3">
      <div className="flex items-center gap-2">
        <Building2Icon className="h-4 w-4 text-muted-foreground" />
        <Label className="text-sm font-medium">Compartilhar com empresas</Label>
      </div>

      {/* Lista de shares já feitos */}
      {actionShares.length > 0 && (
        <div className="space-y-1">
          {actionShares.map((s) => {
            const meta =
              STATUS_META[s.status as keyof typeof STATUS_META] ??
              STATUS_META.PENDING;
            return (
              <div
                key={s.id}
                className="flex items-center gap-2 rounded border border-border/40 bg-muted/30 p-1.5"
              >
                <Avatar className="size-6">
                  <AvatarImage src={s.targetOrg?.logo ?? undefined} />
                  <AvatarFallback className="text-[10px]">
                    {s.targetOrg?.name?.charAt(0).toUpperCase() ?? "?"}
                  </AvatarFallback>
                </Avatar>
                <span className="flex-1 truncate text-xs">
                  {s.targetOrg?.name}
                </span>
                <span
                  className={cn(
                    "flex items-center gap-1 text-[10px]",
                    meta.className,
                  )}
                  title={meta.label}
                >
                  <meta.Icon className="size-3" />
                  {meta.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Multi-select pra adicionar novos */}
      <ShareTargetsField
        value={pendingSelection}
        onChange={(next) =>
          setPendingSelection(
            next.filter((id) => !alreadySharedOrgIds.has(id)),
          )
        }
        disabled={disabled || shareWithOrgs.isPending}
      />

      {pendingSelection.length > 0 && (
        <Button
          type="button"
          size="sm"
          className="w-full"
          onClick={handleSubmit}
          disabled={disabled || shareWithOrgs.isPending}
        >
          {shareWithOrgs.isPending
            ? "Compartilhando…"
            : `Compartilhar com ${pendingSelection.length} empresa${pendingSelection.length > 1 ? "s" : ""}`}
        </Button>
      )}
    </div>
  );
}
