"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { useQueryState } from "nuqs";
import dayjs from "dayjs";
import "dayjs/locale/pt-br";
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  ClockIcon,
  ListChecksIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

dayjs.locale("pt-br");

export type AnalyticsBucket = "total" | "delayed" | "completed";

const BUCKET_META: Record<
  AnalyticsBucket,
  { title: string; description: string; Icon: typeof ListChecksIcon; tone: string }
> = {
  total: {
    title: "Total Actions",
    description: "Suas ações ativas (não concluídas).",
    Icon: ListChecksIcon,
    tone: "text-violet-600 dark:text-violet-400",
  },
  delayed: {
    title: "Ações Atrasadas",
    description: "Ações com data de vencimento já passada.",
    Icon: AlertCircleIcon,
    tone: "text-red-600 dark:text-red-400",
  },
  completed: {
    title: "Ações Concluídas (7 dias)",
    description: "Ações que você fechou nos últimos 7 dias.",
    Icon: CheckCircle2Icon,
    tone: "text-emerald-600 dark:text-emerald-400",
  },
};

interface Props {
  bucket: AnalyticsBucket | null;
  onClose: () => void;
}

export function AnalyticsDetailsModal({ bucket, onClose }: Props) {
  const open = bucket !== null;
  const meta = bucket ? BUCKET_META[bucket] : null;
  const [, setActionId] = useQueryState("actionId");

  // Ao clicar numa linha: fecha esse popup e abre o ViewActionModal via
  // `?actionId=...` (o `ModalProvider` global escuta esse param).
  const handleSelectAction = (actionId: string) => {
    onClose();
    setActionId(actionId);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="flex h-[85dvh] w-[95vw] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle className="flex items-center gap-2">
            {meta && <meta.Icon className={cn("size-5", meta.tone)} />}
            {meta?.title ?? ""}
          </DialogTitle>
          {meta && (
            <DialogDescription>{meta.description}</DialogDescription>
          )}
        </DialogHeader>
        <div className="flex-1 overflow-auto">
          {bucket && (
            <BucketList bucket={bucket} onSelectAction={handleSelectAction} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BucketList({
  bucket,
  onSelectAction,
}: {
  bucket: AnalyticsBucket;
  onSelectAction: (actionId: string) => void;
}) {
  const { data, isLoading } = useQuery(
    orpc.action.listAnalyticsDetails.queryOptions({
      input: { bucket },
    }),
  );

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  const actions = data?.actions ?? [];

  if (actions.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Empty className="border-none">
          <EmptyMedia variant="icon">
            <ListChecksIcon className="size-6 text-muted-foreground" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>Nenhuma ação por aqui</EmptyTitle>
            <EmptyDescription>
              Quando houver ações nessa categoria, elas aparecem nesta lista.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <div className="divide-y">
      {actions.map((a) => (
        <ActionRow key={a.id} action={a} onSelect={onSelectAction} />
      ))}
    </div>
  );
}

interface ActionRowProps {
  action: {
    id: string;
    title: string;
    dueDate: Date | string | null;
    isDone: boolean;
    isOverdue: boolean;
    workspace: { id: string; name: string } | null;
    column: { id: string; name: string; color?: string | null } | null;
    createdBy: string;
    creator: {
      id: string;
      name: string;
      image: string | null;
      email?: string;
    } | null;
    participants: Array<{
      id: string;
      name: string;
      image: string | null;
      email?: string;
    } | null>;
    subActions: { total: number; done: number };
  };
  onSelect: (actionId: string) => void;
}

function ActionRow({ action, onSelect }: ActionRowProps) {
  const dueDate = action.dueDate ? dayjs(action.dueDate) : null;
  const dueLabel = dueDate ? dueDate.format("DD MMM YYYY") : "Sem prazo";
  const validParticipants = action.participants.filter(Boolean) as NonNullable<
    ActionRowProps["action"]["participants"][number]
  >[];

  return (
    <button
      type="button"
      onClick={() => onSelect(action.id)}
      className="w-full cursor-pointer px-5 py-3 text-center transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {/* Linha 1: Título + Workspace */}
      <div className="flex flex-wrap items-baseline justify-center gap-2">
        <span className="truncate font-medium">{action.title}</span>
        {action.workspace && (
          <Badge variant="outline" className="shrink-0 text-[10px]">
            {action.workspace.name}
          </Badge>
        )}
      </div>

      {/* Linha 2: meta */}
      <div className="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {/* Data de vencimento */}
        <span
          className={cn(
            "flex items-center gap-1",
            action.isOverdue && "font-semibold text-red-600 dark:text-red-400",
          )}
        >
          <ClockIcon className="size-3" />
          {dueLabel}
        </span>

        {/* Status (coluna) */}
        {action.column && (
          <span className="flex items-center gap-1.5">
            <span
              className="size-2 rounded-full"
              style={{
                backgroundColor: action.column.color ?? "#888",
              }}
            />
            {action.column.name}
          </span>
        )}

        {/* Subtarefas — só mostra quando há ao menos uma */}
        {action.subActions.total > 0 && (
          <span className="flex items-center gap-1">
            <ListChecksIcon className="size-3" />
            {action.subActions.done}/{action.subActions.total} subtarefa
            {action.subActions.total > 1 ? "s" : ""}
          </span>
        )}

        {/* Participantes */}
        {validParticipants.length > 0 && (
          <div className="flex -space-x-1.5">
            {validParticipants.slice(0, 5).map((u) => {
              const isCreator = u.id === action.createdBy;
              return (
                <Tooltip key={u.id}>
                  <TooltipTrigger asChild>
                    <Avatar
                      className={cn(
                        "size-5 border",
                        isCreator
                          ? "border-2 border-white shadow ring-1 ring-violet-500"
                          : "border-background",
                      )}
                    >
                      <AvatarImage src={u.image ?? undefined} />
                      <AvatarFallback className="text-[9px]">
                        {u.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {u.name}
                    {isCreator ? " (criador)" : ""}
                  </TooltipContent>
                </Tooltip>
              );
            })}
            {validParticipants.length > 5 && (
              <span className="ml-1 text-[10px]">
                +{validParticipants.length - 5}
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}
