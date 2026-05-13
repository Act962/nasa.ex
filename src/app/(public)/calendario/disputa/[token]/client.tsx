"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  Loader2,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import dayjs from "dayjs";
import "dayjs/locale/pt-br";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { orpc } from "@/lib/orpc";

dayjs.locale("pt-br");

/**
 * Página servida pelo magic-link que o criador recebe por email após
 * alguém reivindicar o evento dele. Sem auth (token é a credencial).
 *
 *  - Mostra resumo do evento + da reivindicação
 *  - Botões: ACEITO (despublica) / REJEITO (vira disputa, exige justificativa)
 *  - Estado final exibido se claim já foi resolvida
 */
export function ClaimResponseClient({ token }: { token: string }) {
  const [mode, setMode] = useState<"VIEW" | "REJECTING">("VIEW");
  const [justification, setJustification] = useState("");

  const claimQuery = useQuery({
    ...orpc.public.calendar.getClaimByToken.queryOptions({
      input: { token, mode: "respond" },
    }),
    retry: false,
  });

  const respondMutation = useMutation(
    orpc.public.calendar.respondToClaim.mutationOptions({
      onSuccess: () => {
        toast.success("Resposta registrada");
        claimQuery.refetch();
        setMode("VIEW");
      },
      onError: (err) => {
        toast.error((err as { message?: string })?.message ?? "Falha ao responder");
      },
    }),
  );

  if (claimQuery.isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-12">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (claimQuery.isError || !claimQuery.data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <XCircle className="size-5" />
            Reivindicação não encontrada
          </CardTitle>
          <CardDescription>
            O link expirou ou não é válido. Verifique no email recebido.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const { claim } = claimQuery.data as { claim: {
    id: string;
    status: string;
    claimantEmail: string;
    claimantName: string;
    reason: string;
    creatorResponse: string | null;
    expiresAt: string | Date;
    createdAt: string | Date;
    action: {
      id: string;
      title: string;
      description: string | null;
      publicSlug: string | null;
      coverImage: string | null;
      startDate: string | Date | null;
      isDisputed: boolean;
    };
  }};

  const isResolved = claim.status !== "PENDING";
  const eventStart = claim.action.startDate ? dayjs(claim.action.startDate) : null;
  const expiresAt = dayjs(claim.expiresAt);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShieldAlert className="size-5 text-amber-500" />
            Reivindicação do evento "{claim.action.title}"
          </CardTitle>
          <CardDescription>
            Submetida {dayjs(claim.createdAt).fromNow()} •{" "}
            {isResolved ? (
              <span className="font-medium">Status: {STATUS_LABEL[claim.status] ?? claim.status}</span>
            ) : (
              <>
                <CalendarDays className="inline size-3 mr-1" />
                Você tem até <strong>{expiresAt.format("DD/MM/YYYY")}</strong> pra responder
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Resumo do evento */}
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <div className="flex items-center gap-2 mb-1">
              <strong className="truncate">{claim.action.title}</strong>
              {claim.action.publicSlug && (
                <Link
                  href={`/calendario/evento/${claim.action.publicSlug}`}
                  target="_blank"
                  className="ml-auto inline-flex items-center text-xs text-primary hover:underline"
                >
                  Ver <ExternalLink className="size-3 ml-0.5" />
                </Link>
              )}
            </div>
            {eventStart && (
              <div className="text-xs text-muted-foreground">
                {eventStart.format("DD/MM/YYYY [às] HH:mm")}
              </div>
            )}
          </div>

          {/* Reivindicação */}
          <div className="space-y-1">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Reivindicação
            </Label>
            <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2">
              <div className="text-sm">
                <strong>{claim.claimantName}</strong>{" "}
                <span className="text-xs text-muted-foreground">({claim.claimantEmail})</span>
              </div>
              <div className="text-sm whitespace-pre-wrap leading-relaxed">
                {claim.reason}
              </div>
            </div>
          </div>

          {/* Estado final ou ações */}
          {isResolved ? (
            <ResolvedView claim={claim} />
          ) : mode === "REJECTING" ? (
            <RejectForm
              value={justification}
              onChange={setJustification}
              onSubmit={() =>
                respondMutation.mutate({
                  token,
                  decision: "REJECT",
                  response: justification,
                })
              }
              onCancel={() => setMode("VIEW")}
              loading={respondMutation.isPending}
            />
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                onClick={() => setMode("REJECTING")}
                disabled={respondMutation.isPending}
              >
                <XCircle className="mr-1.5 size-4" />
                Rejeito — quero defender
              </Button>
              <Button
                onClick={() =>
                  respondMutation.mutate({ token, decision: "ACCEPT" })
                }
                disabled={respondMutation.isPending}
              >
                {respondMutation.isPending ? (
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-1.5 size-4" />
                )}
                Aceito — despublica meu evento
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {!isResolved && (
        <Card className="border-amber-200 bg-amber-50/60 dark:border-amber-400/40 dark:bg-amber-950/20">
          <CardContent className="flex items-start gap-2 p-3 text-xs text-amber-900 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              Se você não responder até{" "}
              <strong>{expiresAt.format("DD/MM/YYYY")}</strong>, o evento
              será <strong>despublicado automaticamente</strong>. Você
              pode republicar manualmente depois caso julgue indevido.
            </span>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  ACCEPTED: "Aceito — evento despublicado",
  REJECTED: "Contestado — admin vai decidir",
  EXPIRED: "Expirado — evento despublicado por inação",
  ADMIN_RESOLVED: "Resolvido pelo admin",
};

function ResolvedView({
  claim,
}: {
  claim: { status: string; creatorResponse: string | null };
}) {
  return (
    <div className="rounded-md border bg-muted/30 p-3 text-sm">
      <strong>Esta reivindicação já foi resolvida.</strong>
      <div className="text-xs text-muted-foreground mt-1">
        Status: {STATUS_LABEL[claim.status] ?? claim.status}
      </div>
      {claim.creatorResponse && (
        <div className="mt-2 text-xs">
          <span className="font-semibold">Sua resposta:</span>{" "}
          <span className="whitespace-pre-wrap">"{claim.creatorResponse}"</span>
        </div>
      )}
    </div>
  );
}

function RejectForm({
  value,
  onChange,
  onSubmit,
  onCancel,
  loading,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const valid = value.trim().length >= 10;
  return (
    <div className="space-y-3 rounded-md border bg-card p-3">
      <div>
        <Label className="text-xs">Justifique sua rejeição (mín. 10 caracteres)</Label>
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Sou o organizador real, tenho contrato com..."
          className="mt-1 min-h-[100px] resize-none text-sm"
          maxLength={2000}
        />
        <p className="mt-1 text-[10px] text-muted-foreground">
          Sua justificativa vai pro admin da NASA + pro reivindicante.
        </p>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={loading}>
          Cancelar
        </Button>
        <Button onClick={onSubmit} disabled={!valid || loading}>
          {loading && <Loader2 className="mr-1.5 size-4 animate-spin" />}
          Enviar contestação
        </Button>
      </div>
    </div>
  );
}
