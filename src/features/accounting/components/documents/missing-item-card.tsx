"use client";

import {
  AlertOctagon,
  CircleAlert,
  Clock,
  ExternalLink,
  FileQuestion,
  MoreHorizontal,
  Sparkles,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { openAstroWidget } from "@/features/astro/lib/open-astro-widget";
import {
  DOCUMENT_GROUP_LABELS,
  DOCUMENT_SCOPE_LABELS,
  type DocumentGroup,
  type DocumentScope,
} from "@/features/accounting/lib/compliance/document-catalog";
import { FiscalTermHint } from "../shared/fiscal-term-hint";
import { formatBps } from "@/features/accounting/lib/format";
import { astroPromptForDocument, describeRegularityReason, type RegularityStatus } from "./document-display";

export interface RegularityItemView {
  typeCode: string;
  label: string;
  group: string;
  scope: string;
  status: RegularityStatus;
  daysToExpire: number | null;
  openPeriods: string[];
  impactBps: number;
  blockingImpact: string | null;
  glossaryTermId: string | null;
  officialUrl: string | null;
  description: string;
}

const STATUS_ICONS: Record<RegularityStatus, { icon: typeof Clock; className: string }> = {
  OK: { icon: Clock, className: "text-emerald-500" },
  EXPIRING_SOON: { icon: Clock, className: "text-amber-500" },
  EXPIRED: { icon: AlertOctagon, className: "text-red-500" },
  OVERDUE: { icon: CircleAlert, className: "text-red-500" },
  MISSING: { icon: FileQuestion, className: "text-muted-foreground" },
};

interface MissingItemCardProps {
  item: RegularityItemView;
  onUpload: (typeCode: string, period?: string) => void;
  onDisable: (typeCode: string) => void;
  isDisabling: boolean;
}

export function MissingItemCard({ item, onUpload, onDisable, isDisabling }: MissingItemCardProps) {
  const statusIcon = STATUS_ICONS[item.status];
  const StatusIcon = statusIcon.icon;
  const reason = describeRegularityReason(item);
  const isCritical = item.status === "EXPIRED" || item.status === "OVERDUE" || item.status === "MISSING";
  const groupLabel = DOCUMENT_GROUP_LABELS[item.group as DocumentGroup] ?? item.group;
  const scopeLabel = DOCUMENT_SCOPE_LABELS[item.scope as DocumentScope] ?? item.scope;

  return (
    <li className="rounded-xl border bg-card p-3 sm:p-4">
      <div className="flex items-start gap-3">
        <StatusIcon className={cn("mt-0.5 size-5 shrink-0", statusIcon.className)} aria-hidden />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-sm font-semibold leading-snug">{item.label}</p>
            {item.glossaryTermId && <FiscalTermHint termId={item.glossaryTermId} />}
          </div>
          <p className="text-xs text-muted-foreground">
            {groupLabel} · {scopeLabel}
          </p>
          <p className={cn("text-sm", isCritical ? "text-red-700 dark:text-red-300" : "text-amber-700 dark:text-amber-300")}>
            {reason}
          </p>
          {item.impactBps > 0 && (
            <p className="text-xs font-medium text-violet-700 dark:text-violet-300">
              +{formatBps(item.impactBps, 0)} no score ao resolver
            </p>
          )}
          {item.blockingImpact && isCritical && (
            <p className="rounded-md bg-red-500/10 px-2 py-1 text-xs font-medium text-red-700 dark:text-red-300">
              {item.blockingImpact}
            </p>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label="Mais opções">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled={isDisabling} onClick={() => onDisable(item.typeCode)}>
              Não se aplica à minha empresa
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 sm:pl-8">
        <Button size="sm" className="bg-violet-600 text-white hover:bg-violet-700" onClick={() => onUpload(item.typeCode, item.openPeriods[0])}>
          <Upload className="size-3.5" /> Enviar documento
        </Button>
        {item.officialUrl && (
          <Button size="sm" variant="outline" asChild>
            <a href={item.officialUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-3.5" /> Emitir no site oficial
            </a>
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => openAstroWidget(astroPromptForDocument(item.label, reason))}>
          <Sparkles className="size-3.5" /> Pedir ao ASTRO
        </Button>
      </div>
    </li>
  );
}
