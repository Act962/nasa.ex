"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ExternalLink, FileText, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useClientRecordResponse, useClientRecords } from "@/features/form-records/hooks/use-client-records";
import { formatCents } from "@/features/form-records/lib/measure-units";
import { ClientMemberOrgChart } from "@/features/lead-members/components/client-member-org-chart";
import { FormRecordQuickView, parseFormBlocks, parseResponseValues } from "./form-record-quick-view";
import { formatPeriodKey } from "./form-records-section";

function ClientQuickView({ token, responseId, onClose }: { token: string; responseId: string; onClose: () => void }) {
  const { data, isLoading } = useClientRecordResponse({ token, responseId });
  const response = data?.response;
  return (
    <FormRecordQuickView
      isOpen
      onOpenChange={(isOpen) => !isOpen && onClose()}
      title={response?.form?.name ?? "Ficha"}
      recordKey={responseId}
      blocks={parseFormBlocks(response?.form?.jsonBlock)}
      settings={response?.form?.settings}
      responseValues={parseResponseValues(response?.jsonResponse)}
      isLoading={isLoading}
      actions={
        <Button asChild size="sm" variant="outline">
          <Link href={`/lead/${token}/formulario/${responseId}`}>
            <ExternalLink className="size-4" />
            Abrir ficha completa
          </Link>
        </Button>
      }
    />
  );
}

/** Fichas do cliente pelo link secreto (spec 0075, RF-11). Somente leitura. */
export function ClientRecordsPage({ token }: { token: string }) {
  const [periodKey, setPeriodKey] = useState<string | undefined>();
  const [openResponseId, setOpenResponseId] = useState<string | null>(null);
  // O organograma leva a `?vinculado=<id>`, que filtra as fichas de um vinculado.
  const memberId = useSearchParams().get("vinculado") ?? undefined;
  const { data, isLoading, isError } = useClientRecords({ token, periodKey, memberId });

  if (isLoading && !data) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <Lock className="size-12 text-muted-foreground" />
        <h1 className="text-lg font-semibold">Link inválido ou expirado</h1>
        <p className="max-w-md text-sm text-muted-foreground">Confirme com o estabelecimento se o link está correto.</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-3">
          <Link href={`/lead/${token}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" />
            Voltar
          </Link>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Suas fichas</h1>
              <p className="text-sm text-muted-foreground">Olá, {data.clientFirstName}. Toque numa ficha para ver os detalhes.</p>
            </div>
            {data.periodKey && data.periodKeys.length > 0 && (
              <Select value={data.periodKey} onValueChange={setPeriodKey}>
                <SelectTrigger className="w-52" aria-label="Período">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {data.periodKeys.map((key) => (
                    <SelectItem key={key} value={key}>
                      {formatPeriodKey(key)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </header>

        <ClientMemberOrgChart
          token={token}
          clientName={data.clientName}
          rootSubtitle="Todas as fichas"
          members={data.members}
          selectedMemberId={data.selectedMemberId}
        />

        {data.records.length === 0 ? (
          <p className="rounded-md border p-6 text-sm text-muted-foreground">Nenhuma ficha por enquanto.</p>
        ) : (
          <>
            <section className="space-y-2 rounded-md border p-4" aria-label="Resumo do período">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold">Resumo de {data.periodKey ? formatPeriodKey(data.periodKey) : "todo o período"}</h2>
                {data.hasOpenPeriod && <Badge variant="outline">Prévia</Badge>}
              </div>
              {data.closedSummaries.map((summary) => (
                <dl key={`${summary.formName}|${summary.leadMemberName ?? ""}`} className="space-y-1 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">
                      {summary.leadMemberName ? `${summary.leadMemberName} · ` : ""}
                      {summary.formName} · {summary.recordCount} {summary.recordCount === 1 ? "ficha" : "fichas"} · itens
                    </dt>
                    <dd className="tabular-nums">{formatCents(summary.usageCents)}</dd>
                  </div>
                  {summary.shares.map((share) => (
                    <div key={share.groupId} className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">{share.name}</dt>
                      <dd className="tabular-nums">{formatCents(share.cents)}</dd>
                    </div>
                  ))}
                  <div className="flex justify-between gap-3 border-t pt-1 font-semibold">
                    <dt>Total</dt>
                    <dd className="tabular-nums">{formatCents(summary.totalCents)}</dd>
                  </div>
                </dl>
              ))}
              {data.hasOpenPeriod && (
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Itens das fichas até agora</span>
                    <span className="tabular-nums">{formatCents(data.usageCents)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    O período ainda não foi fechado. O total final, com os custos compartilhados, aparece depois do fechamento.
                  </p>
                </div>
              )}
            </section>

            <ul className="space-y-2" aria-label="Fichas">
              {data.records.map((record) => (
                <li key={record.responseId}>
                  <button
                    type="button"
                    onClick={() => setOpenResponseId(record.responseId)}
                    className="flex w-full items-start justify-between gap-3 rounded-md border p-3 text-left hover:bg-accent"
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        <FileText className="size-4 shrink-0 text-muted-foreground" />
                        <span className="break-words">
                          {record.formName}
                          {record.label ? ` · ${record.label}` : ""}
                        </span>
                      </p>
                      <p className="break-words text-xs text-muted-foreground">
                        {[
                          new Date(record.referenceDate).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }),
                          ...(record.leadMemberName ? [record.leadMemberName] : []),
                          ...record.fields.map((field) => `${field.label}: ${field.value}`),
                        ].join(" · ")}
                      </p>
                    </div>
                    {record.usageTotalCents > 0 && (
                      <span className="shrink-0 text-sm font-medium tabular-nums">{formatCents(record.usageTotalCents)}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {openResponseId && <ClientQuickView token={token} responseId={openResponseId} onClose={() => setOpenResponseId(null)} />}
    </main>
  );
}

/** Atalho na página do lead: só aparece quando o cliente tem alguma ficha. */
export function ClientRecordsCard({ token }: { token: string }) {
  const { data } = useClientRecords({ token });
  if (!data || (data.periodKeys.length === 0 && data.members.length === 0)) return null;
  if (data.periodKeys.length === 0) {
    return <ClientMemberOrgChart token={token} clientName={data.clientName} rootSubtitle="Todas as fichas" members={data.members} selectedMemberId={null} />;
  }
  return (
    <div className="space-y-3">
      <ClientMemberOrgChart token={token} clientName={data.clientName} rootSubtitle="Todas as fichas" members={data.members} selectedMemberId={null} />
      <ClientRecordsLink token={token} />
    </div>
  );
}

function ClientRecordsLink({ token }: { token: string }) {
  return (
    <Link href={`/lead/${token}/fichas`} className="flex items-center justify-between gap-3 rounded-md border p-4 hover:bg-accent">
      <span className="flex items-center gap-2 text-sm font-medium">
        <FileText className="size-4 text-muted-foreground" />
        Ver fichas e valores
      </span>
      <ExternalLink className="size-4 text-muted-foreground" />
    </Link>
  );
}
