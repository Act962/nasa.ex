"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  ClipboardListIcon,
  FileText,
  PencilLine,
  UserSearch,
} from "lucide-react";
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
 * Dialog "Formulários do lead" — abre via clique no `<FormStatusIcon>` do
 * card do lead no kanban (`lead-item.tsx`).
 *
 * **Reformulado** (v2): em vez de listar só os formulários **com resposta**
 * pra esse lead, agora mostra **TODOS os formulários publicados da org**
 * — leads são protagonistas, mas o operador às vezes quer **iniciar um
 * preenchimento NOVO** de um formulário que esse lead ainda não tem. Pra
 * isso, o card mostra:
 *
 *  - **Formulário sem resposta vinculada**: badge "Sem preenchimento" +
 *    botão "Preencher" → `/formulario/novo/<formId>/<leadId>`
 *  - **Formulário com 1 ou mais respostas**: state pill agregado +
 *    contador "N resposta(s)" + click → última resposta em modo edição
 *    `/formulario/<formId>/<lastResponseId>`
 *
 * Ordem: forms SEM resposta primeiro (CTA "Preencher" — chamada à ação),
 * depois com resposta ordenados por estado (não preenchido → preenchido).
 * Tudo num grid 3 colunas (responsivo 1/2/3) com 95vw × 90vh — preserva o
 * tamanho original.
 *
 * O botão "Detalhes do lead" (substitui o antigo "Todos os Forms") fica
 * disponível pra casos onde o user quer ver tudo aprofundadamente —
 * histórico, edição de label, etc. A página `/contatos/<leadId>?tab=forms`
 * continua tendo a LISTA AGRUPADA (FormGroupItem) por design.
 */

const STATE_COLORS: Record<string, string> = {
  empty: "#94a3b8", // slate-400 — iniciado sem resposta
  in_progress: "#3b82f6", // blue
  waiting_client_signature: "#f59e0b", // amber
  stale: "#ef4444", // red
  complete: "#10b981", // emerald
  unfilled: "#6b7280", // gray — form sem nenhuma resposta vinculada
};

const STATE_LABELS: Record<string, string> = {
  empty: "Iniciado",
  in_progress: "Em preenchimento",
  waiting_client_signature: "Aguardando assinatura",
  stale: "Atrasado",
  complete: "Preenchido",
  unfilled: "Sem preenchimento",
};

const SORT_ORDER: Record<string, number> = {
  unfilled: 0, // forms sem resposta primeiro (CTA pra "Preencher")
  empty: 1,
  in_progress: 2,
  waiting_client_signature: 3,
  stale: 4,
  complete: 5,
};

interface FormItem {
  id: string;
  name: string;
  jsonBlock: unknown;
  settings: unknown;
  published: boolean;
}

interface FormResponse {
  id: string;
  createdAt: Date | string;
  completedAt: Date | string | null;
  label: string | null;
  state: string;
  deadline: string | null;
}

/** Forma agregada usada pra renderizar 1 card por form. */
interface FormCardData {
  form: FormItem;
  /** Mais recente primeiro. Vazio = sem resposta vinculada. */
  responses: FormResponse[];
  /** Estado agregado (pior caso entre as responses, ou "unfilled" se nenhuma). */
  aggregateState: string;
  /** Data mais relevante (última resposta criada, ou null pra unfilled). */
  lastActivityAt: Date | null;
}

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
  // Fetch 2 queries em paralelo (só quando dialog abre):
  //  1. Respostas vinculadas a este lead (com `state` derivado server-side)
  //  2. Todos os forms publicados da org (pra mostrar mesmo sem resposta)
  const { data: responsesData, isLoading: respLoading } = useQuery({
    ...orpc.leads.listFormResponses.queryOptions({
      input: { leadId },
    }),
    enabled: open,
  });

  const { data: formsData, isLoading: formsLoading } = useQuery({
    ...orpc.form.list.queryOptions({ input: {} }),
    enabled: open,
  });

  const isLoading = respLoading || formsLoading;

  // Agrega: 1 entrada por form, com responses[] vinculadas ao lead embaixo.
  const cards = useMemo<FormCardData[]>(() => {
    const responses = (responsesData?.responses ?? []) as unknown as (FormResponse & {
      form: FormItem;
    })[];
    const allForms = ((formsData as any)?.forms ?? []) as FormItem[];

    // Só forms publicados aparecem no dialog (operador não pica rascunho)
    const publishedForms = allForms.filter((f) => f.published);

    // Agrupa responses por formId
    const respByForm = new Map<string, FormResponse[]>();
    for (const r of responses as any[]) {
      const fid = r.form?.id;
      if (!fid) continue;
      const list = respByForm.get(fid) ?? [];
      list.push({
        id: r.id,
        createdAt: r.createdAt,
        completedAt: r.completedAt,
        label: r.label,
        state: r.state,
        deadline: r.deadline,
      });
      respByForm.set(fid, list);
    }

    const result: FormCardData[] = publishedForms.map((form) => {
      const respList = (respByForm.get(form.id) ?? []).sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

      // Estado agregado: pior caso (mais urgente) entre responses.
      // Sem resposta → "unfilled" (gray, CTA "Preencher").
      let aggregateState = "unfilled";
      if (respList.length > 0) {
        // Ordena por SORT_ORDER e pega o de menor índice (mais "urgente")
        const sorted = [...respList].sort(
          (a, b) =>
            (SORT_ORDER[a.state] ?? 99) - (SORT_ORDER[b.state] ?? 99),
        );
        aggregateState = sorted[0]?.state ?? "unfilled";
      }

      const lastActivityAt =
        respList.length > 0 ? new Date(respList[0].createdAt) : null;

      return { form, responses: respList, aggregateState, lastActivityAt };
    });

    // Ordenação: forms SEM resposta primeiro (CTA), depois por estado
    return result.sort((a, b) => {
      const ord =
        (SORT_ORDER[a.aggregateState] ?? 99) -
        (SORT_ORDER[b.aggregateState] ?? 99);
      if (ord !== 0) return ord;
      // Dentro do mesmo estado: mais recente atividade primeiro
      const aT = a.lastActivityAt?.getTime() ?? 0;
      const bT = b.lastActivityAt?.getTime() ?? 0;
      return bT - aT;
    });
  }, [responsesData, formsData]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
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
                Não preenchidos primeiro (clique em &ldquo;Preencher&rdquo;),
                depois os já iniciados. Tudo num lugar só — sem precisar
                abrir os detalhes do lead.
              </DialogDescription>
            </div>
            {/* Atalho pro tab "Formulários" no detalhe do lead — quem
                quiser uma visão linear/agrupada com histórico vai pra lá. */}
            <Button asChild variant="outline" size="sm" className="shrink-0">
              <Link href={`/contatos/${leadId}?tab=forms`}>
                <UserSearch className="size-3.5" />
                Detalhes do lead
              </Link>
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto pr-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Spinner />
            </div>
          ) : cards.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
              <div className="size-14 rounded-2xl bg-muted flex items-center justify-center">
                <ClipboardListIcon className="size-7 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                Nenhum formulário publicado nesta organização ainda.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {cards.map((c) => (
                <FormCard
                  key={c.form.id}
                  card={c}
                  leadId={leadId}
                  onPickedAction={() => onOpenChange(false)}
                />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Card por form ────────────────────────────────────────────────────────────

function FormCard({
  card,
  leadId,
  onPickedAction,
}: {
  card: FormCardData;
  leadId: string;
  onPickedAction: () => void;
}) {
  const router = useRouter();
  const { form, responses, aggregateState, lastActivityAt } = card;

  const stateColor = STATE_COLORS[aggregateState] ?? "#6b7280";
  const stateLabel = STATE_LABELS[aggregateState] ?? aggregateState;

  const hasResponses = responses.length > 0;
  const latest = responses[0]; // ordenado mais recente primeiro

  // Ação primária do card depende de ter ou não respostas
  const handlePrimaryAction = () => {
    onPickedAction();
    if (hasResponses && latest) {
      router.push(`/formulario/${form.id}/${latest.id}`);
    } else {
      router.push(`/formulario/novo/${form.id}/${leadId}`);
    }
  };

  // Sempre permite iniciar NOVO preenchimento (mesmo se já tem respostas)
  const handleNewFill = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPickedAction();
    router.push(`/formulario/novo/${form.id}/${leadId}`);
  };

  return (
    <button
      type="button"
      onClick={handlePrimaryAction}
      className={cn(
        "group flex flex-col gap-2 rounded-xl border border-border bg-card p-3 transition-all text-left",
        "hover:border-violet-400 hover:shadow-md hover:-translate-y-0.5",
      )}
    >
      {/* Label da última resposta (campo "Usar como título") — se existe */}
      {latest?.label && (
        <div className="flex justify-start">
          <div className="w-fit max-w-full rounded-md border border-violet-200 bg-violet-50 px-2 py-1 text-xs font-medium text-violet-900 dark:border-violet-800/40 dark:bg-violet-900/20 dark:text-violet-200">
            <span className="line-clamp-1">{latest.label}</span>
          </div>
        </div>
      )}

      <FormFirstGroupThumbnail
        jsonBlock={form.jsonBlock as any}
        settings={form.settings as any}
      />

      <div className="flex items-start justify-between gap-2">
        <h3
          className="text-sm font-semibold leading-tight line-clamp-1"
          title={form.name}
        >
          {form.name}
        </h3>
        {lastActivityAt && (
          <span className="inline-flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
            <Calendar className="size-3" />
            {lastActivityAt.toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
            })}
          </span>
        )}
      </div>

      {/* Estado pill + contador de respostas */}
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
        {hasResponses && responses.length > 1 && (
          <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
            <FileText className="size-3" />
            {responses.length} respostas
          </span>
        )}
      </div>

      {/* CTA "Preencher" — destaque visual.
          - Sem respostas: ação primária (botão principal, mesmo do card)
          - Com respostas: ação secundária no canto pra iniciar nova
        */}
      {!hasResponses ? (
        <div className="flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-2.5 py-1.5 text-xs font-medium justify-center group-hover:bg-primary/90 transition-colors">
          <PencilLine className="size-3.5" />
          Preencher
        </div>
      ) : (
        <button
          type="button"
          onClick={handleNewFill}
          className="inline-flex items-center gap-1.5 rounded-md border border-violet-300 text-violet-700 dark:border-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/40 px-2.5 py-1 text-[11px] font-medium justify-center transition-colors"
          title="Iniciar novo preenchimento (sem mexer nas respostas existentes)"
        >
          <PencilLine className="size-3" />
          Preencher novo
        </button>
      )}
    </button>
  );
}
