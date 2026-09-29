"use client";

import { useState, type ReactNode } from "react";
import { Check, ChevronDown, ExternalLink, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ChecklistLink {
  label: string;
  href: string;
  isPrimary?: boolean;
}

export interface ChecklistItem {
  id: string;
  title: string;
  /** Explicação em linguagem simples: o que é e por que precisa. */
  summary: ReactNode;
  links?: ChecklistLink[];
  /** Conteúdo próprio do passo (botão da Meta, código SMS...). */
  action?: ReactNode;
  /** Passo a passo aberto em "Não sei como". */
  howTo?: ReactNode;
  /** Concluído por evento do sistema (ex.: Meta confirmou), não pelo clique. */
  isAutoDone?: boolean;
  /** Esconde "Já fiz" quando só o sistema pode concluir. */
  isManualDoneHidden?: boolean;
  /** Passo a passo já aberto (com prints), sem o "Não sei como fazer". */
  isHowToOpen?: boolean;
  doneLabel?: string;
}

export function ChecklistProgress({
  doneCount,
  total,
  label,
  isCountHidden = false,
}: {
  doneCount: number;
  total: number;
  label: string;
  isCountHidden?: boolean;
}) {
  const percent = total ? Math.round((doneCount / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">
          {isCountHidden ? label : `${label} · ${doneCount} de ${total}`}
        </span>
        <span className={cn("font-semibold", percent === 100 ? "text-emerald-600" : "text-foreground")}>{percent}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-emerald-500 transition-all duration-700 ease-out" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

/** Lista de passos em sanfona: o atual aberto, os feitos em verde (spec 0040, RF-3). */
export function GuidedChecklist({
  items,
  doneIds,
  onMarkDone,
  onUndo,
  isProgressHidden = false,
}: {
  items: ChecklistItem[];
  doneIds: ReadonlySet<string>;
  onMarkDone: (id: string) => void;
  onUndo: (id: string) => void;
  /** Esconde a barra "Nesta etapa" quando a tela já tem a barra geral (um percentual só). */
  isProgressHidden?: boolean;
}) {
  const isItemDone = (item: ChecklistItem) => doneIds.has(item.id) || Boolean(item.isAutoDone);
  const currentId = items.find((item) => !isItemDone(item))?.id ?? null;
  const [openedId, setOpenedId] = useState<string | null>(null);
  const [helpOpenId, setHelpOpenId] = useState<string | null>(null);
  const expandedId = openedId ?? currentId;
  const doneCount = items.filter(isItemDone).length;

  return (
    <div className="space-y-3">
      {!isProgressHidden && <ChecklistProgress doneCount={doneCount} total={items.length} label="Nesta etapa" />}
      <ol className="space-y-2">
        {items.map((item, index) => {
          const isDone = isItemDone(item);
          const isCurrent = item.id === currentId;
          const isExpanded = item.id === expandedId;
          return (
            <li
              key={item.id}
              className={cn(
                "overflow-hidden rounded-xl border transition-all duration-500",
                isDone && "border-emerald-500/50 bg-emerald-500/5",
                isCurrent && "border-emerald-500 shadow-[0_0_0_3px] shadow-emerald-500/15",
              )}
            >
              <button
                type="button"
                onClick={() => setOpenedId(isExpanded ? "__none__" : item.id)}
                className="flex w-full items-center gap-3 p-3 text-left"
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-all duration-500",
                    isDone && "border-emerald-500 bg-emerald-500 text-white",
                    isCurrent && "border-emerald-500 text-emerald-600",
                  )}
                >
                  {isDone ? <Check className="size-4 animate-in zoom-in spin-in-45 duration-300" /> : index + 1}
                </span>
                <span className={cn("flex-1 text-sm font-medium", isDone && "text-emerald-700 dark:text-emerald-400")}>
                  {item.title}
                </span>
                {isCurrent && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">Agora</span>}
                <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", isExpanded && "rotate-180")} />
              </button>

              {isExpanded && (
                <div className="animate-in fade-in slide-in-from-top-1 min-w-0 space-y-3 px-3 pb-3 pl-13 duration-300">
                  <div className="text-sm text-muted-foreground">{item.summary}</div>

                  {item.links && item.links.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {item.links.map((link) => (
                        <Button
                          key={link.href}
                          size="sm"
                          variant={link.isPrimary ? "default" : "outline"}
                          className={cn(link.isPrimary && "bg-emerald-600 text-white hover:bg-emerald-700")}
                          asChild
                        >
                          <a href={link.href} target="_blank" rel="noreferrer">
                            {link.label} <ExternalLink className="size-3.5" />
                          </a>
                        </Button>
                      ))}
                    </div>
                  )}

                  {item.action}

                  {item.howTo && item.isHowToOpen && <div className="text-sm">{item.howTo}</div>}

                  {item.howTo && !item.isHowToOpen && (
                    <div>
                      <button
                        type="button"
                        onClick={() => setHelpOpenId(helpOpenId === item.id ? null : item.id)}
                        className="flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
                      >
                        <HelpCircle className="size-3.5" /> {helpOpenId === item.id ? "Esconder o passo a passo" : "Não sei como fazer"}
                      </button>
                      {helpOpenId === item.id && (
                        <div className="animate-in fade-in slide-in-from-top-1 mt-2 rounded-lg bg-muted/50 p-3 text-sm">{item.howTo}</div>
                      )}
                    </div>
                  )}

                  {!item.isAutoDone && !item.isManualDoneHidden && (
                    <div className="flex justify-end">
                      {isDone ? (
                        <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => onUndo(item.id)}>
                          Desfazer
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-emerald-500/60 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400"
                          onClick={() => {
                            onMarkDone(item.id);
                            setOpenedId(null);
                            setHelpOpenId(null);
                          }}
                        >
                          <Check className="size-4" /> {item.doneLabel ?? "Já fiz"}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Passo a passo numerado para o "Não sei como fazer". */
export function HowToSteps({ steps }: { steps: ReactNode[] }) {
  return (
    <ol className="space-y-1.5">
      {steps.map((step, index) => (
        <li key={index} className="flex gap-2">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
            {index + 1}
          </span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  );
}
