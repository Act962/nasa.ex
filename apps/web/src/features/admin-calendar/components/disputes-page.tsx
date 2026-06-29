"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import "dayjs/locale/pt-br";
import {
  CheckCircle2,
  ExternalLink,
  Flag,
  Loader2,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { orpc } from "@/lib/orpc";

dayjs.locale("pt-br");

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Aguardando criador",
  REJECTED: "Contestado — decisão admin",
  ACCEPTED: "Aceito (criador)",
  EXPIRED: "Expirado (sem resposta)",
  ADMIN_RESOLVED: "Resolvido por admin",
};

/**
 * Painel admin pra resolver disputas (claims que criadores rejeitaram).
 * Lista REJECTED por padrão (precisa decisão). Filtros por status.
 *
 * Acesso restrito a `User.isSystemAdmin` (validado server-side em cada
 * procedure). Layout simples: tabs + cards.
 */
export function DisputesPage() {
  const [status, setStatus] = useState<"REJECTED" | "ADMIN_RESOLVED" | "ALL">(
    "REJECTED",
  );

  const query = useQuery({
    ...orpc.admin.calendarDisputes.list.queryOptions({
      input: { status, page: 1, limit: 50 },
    }),
  });

  const data = query.data as
    | { claims: Array<DisputeRow>; total: number; pages: number }
    | undefined;

  return (
    <div className="container mx-auto max-w-5xl p-4 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Disputas do Calendário Público</h1>
          <p className="text-sm text-muted-foreground">
            Reivindicações contestadas por criadores aguardando decisão.
          </p>
        </div>
      </div>

      <Tabs
        value={status}
        onValueChange={(v) => setStatus(v as typeof status)}
      >
        <TabsList>
          <TabsTrigger value="REJECTED" className="gap-1.5">
            <ShieldAlert className="size-3.5" />
            Pendentes
          </TabsTrigger>
          <TabsTrigger value="ADMIN_RESOLVED">Resolvidos</TabsTrigger>
          <TabsTrigger value="ALL">Todos</TabsTrigger>
        </TabsList>

        <TabsContent value={status} className="space-y-3 mt-4">
          {query.isLoading && (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {!query.isLoading && (!data || data.claims.length === 0) && (
            <Card>
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                Nenhuma disputa nesse filtro.
              </CardContent>
            </Card>
          )}
          {data?.claims.map((c) => <DisputeCard key={c.id} claim={c} />)}
        </TabsContent>
      </Tabs>
    </div>
  );
}

type DisputeRow = {
  id: string;
  status: string;
  claimantEmail: string;
  claimantName: string;
  reason: string;
  creatorResponse: string | null;
  adminNote: string | null;
  createdAt: string | Date;
  resolvedAt: string | Date | null;
  action: {
    id: string;
    title: string;
    publicSlug: string | null;
    isPublic: boolean;
    isDisputed: boolean;
    disputeReason: string | null;
    reportScore: number;
    creator: { name: string; email: string } | null;
    organization: { name: string; isVerified: boolean } | null;
    _count: { reports: number };
  };
};

function DisputeCard({ claim }: { claim: DisputeRow }) {
  const isResolved = claim.status === "ADMIN_RESOLVED";
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base">{claim.action.title}</CardTitle>
            <CardDescription className="text-xs flex items-center gap-2 flex-wrap">
              <span>{STATUS_LABEL[claim.status] ?? claim.status}</span>
              <span>•</span>
              <span>{dayjs(claim.createdAt).fromNow()}</span>
              {claim.action._count.reports > 0 && (
                <Badge variant="secondary" className="gap-1 text-[10px]">
                  <Flag className="size-2.5" />
                  {claim.action._count.reports} denúncias
                </Badge>
              )}
              {claim.action.organization?.isVerified && (
                <Badge className="bg-blue-500 text-[10px]">Org verificada</Badge>
              )}
            </CardDescription>
          </div>
          {claim.action.publicSlug && (
            <Link
              href={`/calendario/evento/${claim.action.publicSlug}`}
              target="_blank"
              className="text-xs text-primary hover:underline inline-flex items-center gap-1 shrink-0"
            >
              Ver <ExternalLink className="size-3" />
            </Link>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Reivindicação */}
        <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm">
          <div className="font-semibold text-xs uppercase tracking-wider text-amber-700 dark:text-amber-300 mb-1">
            Reivindicação
          </div>
          <div className="text-sm">
            <strong>{claim.claimantName}</strong>{" "}
            <span className="text-xs text-muted-foreground">
              ({claim.claimantEmail})
            </span>
          </div>
          <div className="mt-1 text-sm whitespace-pre-wrap leading-relaxed">
            {claim.reason}
          </div>
        </div>

        {/* Resposta do criador */}
        {claim.creatorResponse && (
          <div className="rounded-md border border-blue-300 bg-blue-50 dark:bg-blue-950/30 p-3 text-sm">
            <div className="font-semibold text-xs uppercase tracking-wider text-blue-700 dark:text-blue-300 mb-1">
              Resposta do criador ({claim.action.creator?.name})
            </div>
            <div className="text-sm whitespace-pre-wrap leading-relaxed">
              {claim.creatorResponse}
            </div>
          </div>
        )}

        {/* Nota do admin (se já resolvido) */}
        {isResolved && claim.adminNote && (
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <div className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-1">
              Decisão do admin
            </div>
            <div className="text-sm">{claim.adminNote}</div>
          </div>
        )}

        {/* Ações */}
        {!isResolved && <ResolveActions claim={claim} />}
      </CardContent>
    </Card>
  );
}

function ResolveActions({ claim }: { claim: DisputeRow }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState<"UPHOLD" | "DISMISS" | null>(null);
  const [note, setNote] = useState("");

  const mutation = useMutation(
    orpc.admin.calendarDisputes.resolve.mutationOptions({
      onSuccess: () => {
        toast.success("Disputa resolvida");
        setOpen(null);
        setNote("");
        queryClient.invalidateQueries({
          queryKey: orpc.admin.calendarDisputes.list.queryKey({ input: {} }),
        });
      },
      onError: (err) => {
        toast.error(
          (err as { message?: string })?.message ?? "Falha ao resolver",
        );
      },
    }),
  );

  return (
    <>
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen("DISMISS")}
        >
          <XCircle className="mr-1.5 size-3.5" />
          Descartar reivindicação (criador venceu)
        </Button>
        <Button size="sm" onClick={() => setOpen("UPHOLD")}>
          <CheckCircle2 className="mr-1.5 size-3.5" />
          Manter reivindicação (despublica evento)
        </Button>
      </div>

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {open === "UPHOLD"
                ? "Manter reivindicação"
                : "Descartar reivindicação"}
            </DialogTitle>
            <DialogDescription>
              {open === "UPHOLD"
                ? "O evento será despublicado. Reivindicante e criador serão notificados."
                : "A disputa será descartada. O evento volta a ficar público normalmente."}
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label className="text-xs">Nota (opcional — vai pros 2 lados)</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={2000}
              className="mt-1 min-h-[80px] resize-none text-sm"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() =>
                open &&
                mutation.mutate({
                  claimId: claim.id,
                  decision: open,
                  note: note.trim() || undefined,
                })
              }
              disabled={mutation.isPending}
            >
              {mutation.isPending && (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              )}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
