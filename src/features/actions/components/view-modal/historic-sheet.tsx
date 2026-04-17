"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useQueryAction } from "../../hooks/use-tasks";
import { useWorkspaceMembers } from "@/features/workspace/hooks/use-workspace";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
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
} from "lucide-react";

interface Props {
  actionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
}

const ACTION_TYPE_CONFIG: Record<
  string,
  { label: string; icon: any; color: string }
> = {
  create: { label: "Criou a ação", icon: PlusIcon, color: "text-green-500" },
  update: {
    label: "Atualizou a ação",
    icon: Settings2Icon,
    color: "text-blue-500",
  },
  move: {
    label: "Moveu a ação",
    icon: ArrowRightIcon,
    color: "text-violet-500",
  },
  archive: {
    label: "Arquivou a ação",
    icon: ArchiveIcon,
    color: "text-amber-500",
  },
  unarchive: {
    label: "Restaurou a ação",
    icon: RefreshCcwIcon,
    color: "text-emerald-500",
  },
  isDone: {
    label: "Alterou status",
    icon: CheckCircle2Icon,
    color: "text-indigo-500",
  },
};

const FIELD_LABELS: Record<string, string> = {
  title: "Título",
  description: "Descrição",
  priority: "Prioridade",
  dueDate: "Data de entrega",
  isDone: "Conclusão",
  columnId: "Coluna",
  workspaceId: "Workspace",
  isArchived: "Arquivamento",
  isFavorited: "Favorito",
  attachments: "Anexos",
  links: "Links",
  youtubeUrl: "URL do YouTube",
};

import { useMemo } from "react";

export function HistoricSheet({
  actionId,
  open,
  onOpenChange,
  workspaceId,
}: Props) {
  const { action, isLoading } = useQueryAction(actionId);
  const { members } = useWorkspaceMembers(workspaceId);

  const getMember = (userId: string) => members.find((m) => m.id === userId);

  const history = useMemo(() => {
    if (!action?.history) return [];

    // Se for string (erro comum de redundância de serialização ou tipo Json no Prisma)
    if (typeof action.history === "string") {
      try {
        return JSON.parse(action.history) as any[];
      } catch (e) {
        console.error("Erro ao processar JSON de histórico:", e);
        return [];
      }
    }

    if (Array.isArray(action.history)) {
      return action.history;
    }

    return [];
  }, [action?.history]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md flex flex-col p-0">
        <SheetHeader className="p-6 border-b">
          <div className="flex items-center gap-2">
            <HistoryIcon className="size-5 text-muted-foreground" />
            <SheetTitle>Histórico da Ação</SheetTitle>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
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
                {history
                  .slice()
                  .reverse()
                  .map((entry, idx) => {
                    const member = getMember(entry.userId);
                    const config = ACTION_TYPE_CONFIG[entry.type] || {
                      label: entry.type,
                      icon: Settings2Icon,
                      color: "text-muted-foreground",
                    };
                    const Icon = config.icon;

                    return (
                      <div
                        key={idx}
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
                                new Date(entry.timestamp),
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
                              {member?.user.name || "Usuário desconhecido"}
                            </span>
                          </div>

                          {entry.changes && entry.changes.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {entry.changes.map((field: string) => (
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
