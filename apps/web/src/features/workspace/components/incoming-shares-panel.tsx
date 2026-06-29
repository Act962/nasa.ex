"use client";

import { useState } from "react";
import { InboxIcon, CheckIcon, XIcon, Building2Icon, ClockIcon, ChevronDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  useListIncomingShares,
  useApproveShare,
  useRejectShare,
  useColumnsByWorkspace,
  useSuspenseWokspaces,
} from "@/features/workspace/hooks/use-workspace";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

// Sub-component: approval picker (workspace + column)
function ApprovePicker({ shareId, onClose }: { shareId: string; onClose: () => void }) {
  const { data } = useSuspenseWokspaces();
  const workspaces = data.workspaces;
  const [workspaceId, setWorkspaceId] = useState<string>("");
  const [columnId, setColumnId] = useState<string>("");
  const { columns } = useColumnsByWorkspace(workspaceId);
  const approveShare = useApproveShare();

  const handleApprove = () => {
    if (!workspaceId || !columnId) return;
    approveShare.mutate(
      { shareId, targetWorkspaceId: workspaceId, targetColumnId: columnId },
      { onSuccess: onClose },
    );
  };

  return (
    <div className="p-3 space-y-3 w-64">
      <p className="text-xs font-semibold">Onde colocar o card recebido?</p>

      <div className="space-y-2">
        <Select value={workspaceId} onValueChange={(v) => { setWorkspaceId(v); setColumnId(""); }}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Selecionar workspace..." />
          </SelectTrigger>
          <SelectContent>
            {workspaces.map((ws: any) => (
              <SelectItem key={ws.id} value={ws.id} className="text-xs">{ws.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {workspaceId && (
          <Select value={columnId} onValueChange={setColumnId}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Selecionar coluna..." />
            </SelectTrigger>
            <SelectContent>
              {columns.map((col: any) => (
                <SelectItem key={col.id} value={col.id} className="text-xs">{col.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          className="flex-1 h-7 text-xs"
          disabled={!workspaceId || !columnId || approveShare.isPending}
          onClick={handleApprove}
        >
          <CheckIcon className="size-3 mr-1" />
          {approveShare.isPending ? "Aprovando..." : "Confirmar"}
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

interface Props {
  className?: string;
}

export function IncomingSharesPanel({ className }: Props) {
  const { shares, isLoading } = useListIncomingShares("PENDING");
  const rejectShare = useRejectShare();
  const [approvingId, setApprovingId] = useState<string | null>(null);

  if (shares.length === 0 && !isLoading) return null;

  return (
    <div className={cn("border rounded-xl bg-card shadow-sm overflow-hidden", className)}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-amber-500/5">
        <InboxIcon className="size-4 text-amber-500 shrink-0" />
        <span className="text-sm font-semibold">Cards recebidos</span>
        <Badge className="h-4 px-1.5 text-[10px] bg-amber-500/20 text-amber-600 border-amber-300 ml-auto">
          {shares.length} pendente{shares.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      <div className="divide-y">
        {isLoading ? (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : (
          shares.map((share: any) => (
            <div key={share.id} className="px-4 py-3 space-y-2">
              {/* Source org + requester */}
              <div className="flex items-center gap-2">
                <Avatar className="size-6 shrink-0">
                  <AvatarImage src={share.sourceOrg?.logo || ""} />
                  <AvatarFallback className="text-[9px] font-bold">
                    {share.sourceOrg?.name?.[0] ?? "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">
                    <span className="text-violet-600">{share.sourceOrg?.name}</span>
                    <span className="text-muted-foreground font-normal"> enviou um card</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <ClockIcon className="size-2.5" />
                    {format(new Date(share.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>

              {/* Card preview */}
              <div className="ml-8 p-2.5 rounded-lg border bg-muted/40 space-y-1">
                <p className="text-xs font-medium line-clamp-2">{share.sourceAction?.title}</p>
                {share.message && (
                  <p className="text-[11px] text-muted-foreground italic">"{share.message}"</p>
                )}
              </div>

              {/* Action buttons */}
              <div className="ml-8 flex gap-2">
                <Popover
                  open={approvingId === share.id}
                  onOpenChange={(o) => setApprovingId(o ? share.id : null)}
                >
                  <PopoverTrigger asChild>
                    <Button
                      size="sm"
                      className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700"
                    >
                      <CheckIcon className="size-3" />
                      Aprovar
                      <ChevronDownIcon className="size-3 ml-0.5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 w-auto" align="start">
                    <ApprovePicker
                      shareId={share.id}
                      onClose={() => setApprovingId(null)}
                    />
                  </PopoverContent>
                </Popover>

                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => rejectShare.mutate({ shareId: share.id })}
                  disabled={rejectShare.isPending}
                >
                  <XIcon className="size-3" />
                  Rejeitar
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
