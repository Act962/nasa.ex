"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useQueryAction } from "../../hooks/use-tasks";
import { useWorkspaceMembers } from "@/features/workspace/hooks/use-workspace";
import type { Action, ActionHistoryType } from "../../types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import {
  HistoryIcon,
  UserIcon,
  ClockIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  ArchiveIcon,
  RefreshCcwIcon,
  PlusIcon,
  Settings2Icon,
  ListChecksIcon,
  Edit3Icon,
} from "lucide-react";

interface Props {
  actionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
}

import { useMemo } from "react";
import { ACTION_TYPE_CONFIG, FIELD_LABELS } from "../../data/historic";

export function HistoricSheet({
  actionId,
  open,
  onOpenChange,
  workspaceId,
}: Props) {
  const { action, isLoading } = useQueryAction(actionId);
  const parsedAction = action as Action | undefined;
  const { members } = useWorkspaceMembers(workspaceId);

  const getMember = (userId: string) => members.find((m) => m.id === userId);

  const history = useMemo(
    () => parsedAction?.activityLogs ?? [],
    [parsedAction?.activityLogs],
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md flex flex-col p-0 gap-0">
        <SheetHeader className="p-6 border-b">
          <div className="flex items-center gap-2">
            <HistoryIcon className="size-5 text-muted-foreground" />
            <SheetTitle>Histórico da Ação</SheetTitle>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 overflow-y-auto scroll-cols-tracking">
          <div className="p-6">
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-4 animate-pulse">
                    <div className="size-8 rounded-full bg-muted" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded w-1/4" />
                      <div className="h-3 bg-muted rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <HistoryIcon className="size-12 mb-4 opacity-20" />
                <p>Nenhum histórico disponível para esta ação.</p>
              </div>
            ) : (
              <div className="relative space-y-8 before:absolute before:inset-0 before:ml-4 before:-translate-x-px before:h-full before:w-0.5 before:bg-linear-to-b before:from-transparent before:via-border before:to-transparent">
                {history.map((entry: Action["activityLogs"][number]) => {
                  const member = getMember(entry.userId);
                  const metadata =
                    entry.metadata &&
                    typeof entry.metadata === "object" &&
                    !Array.isArray(entry.metadata)
                      ? (entry.metadata as {
                          changes?: string[];
                          title?: string;
                        })
                      : undefined;
                  const config = ACTION_TYPE_CONFIG[
                    entry.action as ActionHistoryType
                  ] || {
                    label: entry.action,
                    icon: Settings2Icon,
                    color: "text-muted-foreground",
                  };
                  const Icon = config.icon;

                  return (
                    <div
                      key={entry.id}
                      className="relative flex items-start gap-4"
                    >
                      <div className="absolute left-0 flex items-center justify-center size-8 rounded-full bg-background border shadow-sm z-10">
                        <Icon className={cn("size-4", config.color)} />
                      </div>

                      <div className="flex-1 ml-9 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium leading-none">
                            {config.label}
                          </p>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1 shrink-0">
                            <ClockIcon className="size-3" />
                            {format(
                              new Date(entry.createdAt),
                              "dd MMM, HH:mm",
                              {
                                locale: ptBR,
                              },
                            )}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <Avatar className="size-5 border">
                            <AvatarImage
                              src={member?.user.image ?? undefined}
                            />
                            <AvatarFallback>
                              <UserIcon className="size-3" />
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs text-muted-foreground">
                            {member?.user.name ||
                              entry.userName ||
                              "Usuário desconhecido"}
                          </span>
                        </div>

                        {metadata?.title &&
                          (entry.action === "action.checklist_added" ||
                            entry.action === "action.checklist_updated") && (
                            <p className="text-xs text-muted-foreground italic">
                              &quot;{metadata.title}&quot;
                            </p>
                          )}

                        {metadata?.changes && metadata.changes.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {metadata.changes.map((field: string) => (
                              <span
                                key={field}
                                className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground border"
                              >
                                {FIELD_LABELS[field] || field}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
