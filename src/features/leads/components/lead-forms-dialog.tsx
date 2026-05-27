"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Calendar, ClipboardListIcon, FolderOpen } from "lucide-react";
import { orpc } from "@/lib/orpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { FormFirstGroupThumbnail } from "@/features/form/components/form-first-group-thumbnail";
import { cn } from "@/lib/utils";

/**
 * Dialog "Formulários do lead" — abre via clique em qualquer
 * `<FormStatusIcon>` no card do lead no kanban (`lead-item.tsx`).
 *
 * Substitui a navegação direta (`/formulario/<slug>/<responseId>` ou
 * `/contatos/<leadId>?tab=forms`) por uma visualização consolidada de
 * **todos** os formulários do lead, com cards no estilo do carousel
 * "Últimos formulários preenchidos" do app `/formularios` (thumbnail
 * 2:1 + nome + data + label + estado).
 *
 * Layout:
 *  - Dialog 95% da largura/altura da tela (`max-w-[95vw]`, `max-h-[90vh]`)
 *  - Grid de 3 colunas em desktop (responsivo: 1/2/3 conforme breakpoint)
 *  - Ordenação: NÃO preenchidos primeiro (`empty`/`in_progress`/
 *    `waiting_client_signature`/`stale`), `complete` por último
 *  - Click em card → navega pra `/formulario/<formId>/<responseId>`
 *
 * Reusa `orpc.leads.listFormResponses({ leadId })` (já retorna
 * preenchidos + não preenchidos com `state` derivado server-side).
 */

const STATE_COLORS: Record<string, string> = {
  empty: "#94a3b8", // slate-400 — neutro pra iniciado sem resposta
  in_progress: "#3b82f6", // blue
  waiting_client_signature: "#f59e0b", // amber
  stale: "#ef4444", // red
  complete: "#10b981", // emerald
};

const STATE_LABELS: Record<string, string> = {
  empty: "Iniciado",
  in_progress: "Em preenchimento",
  waiting_client_signature: "Aguardando assinatura",
  stale: "Atrasado",
  complete: "Preenchido",
};

const SORT_ORDER: Record<string, number> = {
  // Não preenchidos primeiro
  empty: 0,
  in_progress: 1,
  waiting_client_signature: 2,
  stale: 3,
  // Preenchidos por último
  complete: 4,
};

export function LeadFormsDialog({
  leadId,
  leadName,
  open,
  onOpenChange,
}: {
  leadId: string;
  leadName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading } = useQuery({
    ...orpc.leads.listFormResponses.queryOptions({
      input: { leadId },
    }),
    // Só busca quando o dialog abre — evita query desnecessária na lista
    // do kanban (1 query por lead aberto, não por lead renderizado).
    enabled: open,
  });

  const sorted = useMemo(() => {
    const list = data?.responses ?? [];
    return [...list].sort((a, b) => {
      const orderDiff =
        (SORT_ORDER[a.state] ?? 99) - (SORT_ORDER[b.state] ?? 99);
      if (orderDiff !== 0) return orderDiff;
      // Dentro do mesmo estado: mais recentes primeiro
      return (
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    });
  }, [data?.responses]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        // sm:max-w-[95vw] precisa do prefixo `sm:` pra sobrepor o
        // `sm:max-w-lg` (32rem ≈ 512px) que o shadcn Dialog injeta por
        // padrão. Sem o prefixo, o overrride não bate no breakpoint
        // ≥640px e o dialog fica preso em ~32rem.
        className={cn(
          "w-[95vw] max-w-[95vw] sm:max-w-[95vw]",
          "h-[90vh] max-h-[90vh]",
          "flex flex-col gap-3 p-6 overflow-hidden",
        )}
      >
        <DialogHeader className="space-y-2">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1 min-w-0 flex-1">
              <DialogTitle className="text-lg">
                Formulários{leadName ? ` de ${leadName}` : ""}
              </DialogTitle>
              <DialogDescription>
                Não preenchidos primeiro, depois os concluídos. Clique
                num card pra abrir o formulário.
              </DialogDescription>
            </div>
            {/* Botão "Todos os Forms" — leva pra aba Formulários do
                detalhe do lead. Como esse navegação é via Link, ela
                entra no history; ao clicar "Voltar" lá, o browser
                retorna pra esta URL com `?leadForms=<id>` e o dialog
                reabre (mesmo mecanismo da página /formulario). */}
            <Button asChild variant="outline" size="sm" className="shrink-0">
              <Link href={`/contatos/${leadId}?tab=forms`}>
                <FolderOpen className="size-3.5" />
                Todos os Forms
              </Link>
            </Button>
          </div>
        </DialogHeader>

        {/* Grid scrollável dentro do dialog */}
        <div className="flex-1 min-h-0 overflow-y-auto pr-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Spinner />
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
              <div className="size-14 rounded-2xl bg-muted flex items-center justify-center">
                <ClipboardListIcon className="size-7 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                Nenhum formulário vinculado a este lead ainda.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sorted.map((r) => (
                <LeadFormCard key={r.id} response={r} />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────
// Espelha o estilo do `ResponseCard` em recent-responses-carousel.tsx
// (thumbnail 2:1 + nome/data + label/estado), mas em layout full-width
// pra encaixar no grid 3-cols. Link envolve o card todo.

interface LeadFormResponseItem {
  id: string;
  createdAt: Date | string;
  completedAt: Date | string | null;
  label: string | null;
  state: string;
  deadline: string | null;
  form: {
    id: string;
    name: string;
    jsonBlock: unknown;
    settings: unknown;
  };
}

function LeadFormCard({ response }: { response: LeadFormResponseItem }) {
  const createdAt = new Date(response.createdAt);
  // Slug é cosmético na rota — page usa apenas `responseId`. Por isso
  // passamos `form.id` (que sempre temos) no lugar do slug.
  const href = `/formulario/${response.form.id}/${response.id}`;

  const stateColor = STATE_COLORS[response.state] ?? "#6b7280";
  const stateLabel = STATE_LABELS[response.state] ?? response.state;

  return (
    <Link
      href={href}
      className={cn(
        "group flex flex-col gap-2 rounded-xl border border-border bg-card p-3 transition-all",
        "hover:border-violet-400 hover:shadow-md hover:-translate-y-0.5",
      )}
    >
      {/* Label customizada (campo "Usar como título") — acima do
          thumbnail, alinhada à esquerda, com largura proporcional ao
          texto (w-fit) pra não estourar o card em labels longas. */}
      {response.label && (
        <div className="flex justify-start">
          <div className="w-fit max-w-full rounded-md border border-violet-200 bg-violet-50 px-2 py-1 text-xs font-medium text-violet-900 dark:border-violet-800/40 dark:bg-violet-900/20 dark:text-violet-200">
            <span className="line-clamp-1">{response.label}</span>
          </div>
        </div>
      )}

      <FormFirstGroupThumbnail
        jsonBlock={response.form.jsonBlock as any}
        settings={response.form.settings as any}
      />

      <div className="flex items-start justify-between gap-2">
        <h3
          className="text-sm font-semibold leading-tight line-clamp-1"
          title={response.form.name}
        >
          {response.form.name}
        </h3>
        <span className="inline-flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
          <Calendar className="size-3" />
          {createdAt.toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
          })}
        </span>
      </div>

      {/* Estado pill — visual dominante (não preenchidos primeiro) */}
      <div className="flex items-center justify-between gap-2 mt-auto pt-1">
        <span
          className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium"
          style={{
            borderColor: `${stateColor}66`,
            color: stateColor,
            background: `${stateColor}15`,
          }}
        >
          <span
            className="inline-block size-1.5 rounded-full"
            style={{ background: stateColor }}
          />
          {stateLabel}
        </span>
        {response.deadline && (
          <span className="text-[10px] text-muted-foreground">
            Prazo:{" "}
            {new Date(response.deadline).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
            })}
          </span>
        )}
      </div>
    </Link>
  );
}
