"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, ChevronLeft, ChevronRight, MessageSquareWarning, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { cn } from "@/lib/utils";
import type { CorrectionStatus } from "@/features/astro-corrections/lib/parse-correction";
import {
  useAstroCorrections,
  useUpdateAstroCorrectionStatus,
} from "@/features/astro-corrections/hooks/use-astro-corrections";

const PAGE_SIZE = 20;

const STATUS_TABS: { status: CorrectionStatus; label: string }[] = [
  { status: "OPEN", label: "Abertas" },
  { status: "RESOLVED", label: "Corrigidas" },
  { status: "DISMISSED", label: "Descartadas" },
];

type Correction = NonNullable<ReturnType<typeof useAstroCorrections>["data"]>["corrections"][number];

function QuoteBlock({ label, text, tone }: { label: string; text: string; tone?: "expected" }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p
        className={cn(
          "whitespace-pre-wrap break-words rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm",
          tone === "expected" && "border-primary/40 bg-primary/10",
        )}
      >
        {text}
      </p>
    </div>
  );
}

function CorrectionCard({ correction }: { correction: Correction }) {
  const [resolutionNote, setResolutionNote] = useState(correction.resolutionNote ?? "");
  const updateStatus = useUpdateAstroCorrectionStatus();
  const isOpen = correction.status === "OPEN";

  const changeStatus = (status: CorrectionStatus, successMessage: string) => {
    updateStatus.mutate(
      { id: correction.id, status, resolutionNote: status === "OPEN" ? undefined : resolutionNote },
      {
        onSuccess: () => toast.success(successMessage),
        onError: () => toast.error("Não consegui atualizar. Tente de novo."),
      },
    );
  };

  const expectedText =
    correction.expected === null
      ? "Aguardando o usuário dizer o que era o certo."
      : correction.expected === ""
        ? "O usuário não informou."
        : correction.expected;

  return (
    <article className="space-y-4 rounded-2xl border border-border bg-card p-4">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="font-semibold">{correction.organizationName}</span>
        <span className="text-muted-foreground">{correction.userName}</span>
        <span className="text-muted-foreground">
          {format(new Date(correction.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
        </span>
        <Badge variant="secondary">{correction.route ?? "sem rota"}</Badge>
      </header>

      <div className="grid gap-3 md:grid-cols-3">
        <QuoteBlock label="O usuário pediu" text={correction.userMessage || "—"} />
        <QuoteBlock label="O ASTRO respondeu" text={correction.astroReply || "—"} />
        <QuoteBlock label="O certo era" text={expectedText} tone={correction.expected ? "expected" : undefined} />
      </div>

      {correction.transcript.length > 1 && (
        <Collapsible>
          <CollapsibleTrigger className="text-xs font-medium text-muted-foreground underline-offset-4 hover:underline">
            Ver a conversa ({correction.transcript.length} mensagens antes do aviso)
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-2 border-l-2 border-border pl-3">
            {correction.transcript.map((turn) => (
              <div key={turn.at} className="space-y-1 text-sm">
                <p className="whitespace-pre-wrap break-words">
                  <span className="font-medium">Usuário:</span> {turn.user}
                </p>
                <p className="whitespace-pre-wrap break-words text-muted-foreground">
                  <span className="font-medium">ASTRO:</span> {turn.astro || "—"}
                </p>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}

      {isOpen ? (
        <div className="flex flex-col gap-2 md:flex-row md:items-end">
          <Textarea
            value={resolutionNote}
            onChange={(event) => setResolutionNote(event.target.value)}
            placeholder="O que foi ajustado (opcional). Ex.: PR 437, título entre aspas"
            maxLength={1000}
            rows={1}
            className="min-h-9 md:flex-1"
          />
          <div className="flex gap-2">
            <Button size="sm" disabled={updateStatus.isPending} onClick={() => changeStatus("RESOLVED", "Marcada como corrigida.")}>
              <Check className="size-4" />
              Corrigido
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={updateStatus.isPending}
              onClick={() => changeStatus("DISMISSED", "Descartada.")}
            >
              <X className="size-4" />
              Descartar
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="text-muted-foreground">{correction.resolutionNote || "Sem anotação."}</p>
          <Button size="sm" variant="outline" disabled={updateStatus.isPending} onClick={() => changeStatus("OPEN", "Reaberta.")}>
            <RotateCcw className="size-4" />
            Reabrir
          </Button>
        </div>
      )}
    </article>
  );
}

export function AstroCorrectionsPage() {
  const [status, setStatus] = useState<CorrectionStatus>("OPEN");
  const [route, setRoute] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useAstroCorrections({ status, route, page });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const selectStatus = (nextStatus: CorrectionStatus) => {
    setStatus(nextStatus);
    setRoute(undefined);
    setPage(1);
  };
  const toggleRoute = (nextRoute: string) => {
    setRoute((current) => (current === nextRoute ? undefined : nextRoute));
    setPage(1);
  };

  return (
    <div className="dark w-full space-y-6 pb-10 text-foreground">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <MessageSquareWarning className="size-4" />
          <h2 className="text-xl font-semibold">Correções do ASTRO</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Respostas que os usuários marcaram com &quot;errou&quot; no WhatsApp, com o que eles disseram que era o certo.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <Button
            key={tab.status}
            size="sm"
            variant={status === tab.status ? "default" : "outline"}
            onClick={() => selectStatus(tab.status)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {status === "OPEN" && data && data.openByRoute.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Onde ele mais erra (abertas)</p>
          <div className="flex flex-wrap gap-2">
            {data.openByRoute.map((group) => (
              <Button
                key={group.route}
                size="sm"
                variant={route === group.route ? "secondary" : "outline"}
                onClick={() => toggleRoute(group.route)}
              >
                {group.route}
                <Badge variant="secondary">{group.count}</Badge>
              </Button>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex h-40 flex-col items-center justify-center gap-3 text-muted-foreground">
          <OrbitaSpinner className="size-8 text-primary/50" />
          <p className="text-sm font-medium">Carregando correções...</p>
        </div>
      ) : isError ? (
        <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Não consegui carregar as correções. Recarregue a página.
        </p>
      ) : !data || data.corrections.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          {status === "OPEN" ? "Nenhuma correção aberta." : "Nada por aqui ainda."}
        </p>
      ) : (
        <div className="space-y-4">
          {data.corrections.map((correction) => (
            <CorrectionCard key={correction.id} correction={correction} />
          ))}
        </div>
      )}

      {data && totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="size-4" />
            Anterior
          </Button>
          <span className="text-muted-foreground">
            {page} de {totalPages}
          </span>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            Próxima
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
