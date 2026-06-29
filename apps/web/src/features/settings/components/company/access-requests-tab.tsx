"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Clock, Inbox, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { orpc } from "@/lib/orpc";

export function AccessRequestsTab() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"PENDING" | "APPROVED" | "REJECTED">("PENDING");

  const { data, isLoading } = useQuery(
    orpc.spaceStation.listAccessRequests.queryOptions({ input: { status: filter } }),
  );

  const mutation = useMutation({
    ...orpc.spaceStation.handleAccessRequest.mutationOptions(),
    onSuccess: (_res, vars) => {
      toast.success(vars.action === "approve" ? "Pedido aprovado" : "Pedido recusado");
      queryClient.invalidateQueries({ queryKey: orpc.spaceStation.listAccessRequests.queryKey({ input: { status: filter } }) });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao processar pedido"),
  });

  const requests = data?.requests ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Pedidos de acesso</h2>
          <p className="text-xs text-muted-foreground">
            Aprovar ou recusar pedidos de acesso ao mundo virtual da sua empresa.
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-md border p-0.5">
          {(["PENDING", "APPROVED", "REJECTED"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              className={`text-xs px-2.5 py-1 rounded transition-colors ${
                filter === s
                  ? "bg-violet-500/10 text-violet-600 dark:text-violet-400"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s === "PENDING" ? "Pendentes" : s === "APPROVED" ? "Aprovados" : "Recusados"}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Carregando...</div>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
          <Inbox className="size-8 mb-2 opacity-50" />
          <p className="text-sm">Nenhum pedido {filter === "PENDING" ? "pendente" : filter === "APPROVED" ? "aprovado" : "recusado"}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {requests.map((req) => (
            <div
              key={req.id}
              className="flex items-start gap-3 rounded-lg border p-3"
            >
              <Avatar className="size-9">
                <AvatarImage src={req.user.image ?? ""} alt={req.user.name} />
                <AvatarFallback>{req.user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{req.user.name}</span>
                  <span className="text-xs text-muted-foreground">{req.user.email}</span>
                </div>
                {req.message && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-3">
                    “{req.message}”
                  </p>
                )}
                <div className="flex items-center gap-1 mt-1.5 text-[11px] text-muted-foreground">
                  <Clock className="size-3" />
                  {new Date(req.createdAt).toLocaleString("pt-BR")}
                </div>
              </div>

              {req.status === "PENDING" ? (
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    disabled={mutation.isPending}
                    onClick={() => mutation.mutate({ requestId: req.id, action: "reject" })}
                  >
                    <X className="size-3.5 mr-1" /> Recusar
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 bg-violet-600 hover:bg-violet-700"
                    disabled={mutation.isPending}
                    onClick={() => mutation.mutate({ requestId: req.id, action: "approve" })}
                  >
                    <Check className="size-3.5 mr-1" /> Aprovar
                  </Button>
                </div>
              ) : (
                <span
                  className={`text-[11px] font-medium px-2 py-0.5 rounded-full border shrink-0 ${
                    req.status === "APPROVED"
                      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                      : "bg-rose-500/10 text-rose-600 border-rose-500/20"
                  }`}
                >
                  {req.status === "APPROVED" ? "Aprovado" : "Recusado"}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
