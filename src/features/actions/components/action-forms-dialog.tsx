"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ClipboardListIcon, SparklesIcon, Trash2Icon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { FormFirstGroupThumbnail } from "@/features/form/components/form-first-group-thumbnail";
import { STATE_COLORS, STATE_LABELS } from "@/features/form/lib/form-state-ui";
import { useQueryListForms } from "@/features/form/hooks/use-form";
import {
  useActionForms,
  useAttachFormToAction,
  useDetachFormFromAction,
} from "@/features/actions/hooks/use-action-forms";
import { cn } from "@/lib/utils";

type ActionFormsDialogProps = {
  actionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type DialogForm = {
  id: string;
  name: string;
  jsonBlock: unknown;
  settings: unknown;
  published: boolean;
};

/**
 * Formulários de UMA tarefa. Diferente do dialog do lead, que mostra o
 * histórico inteiro do contato: aqui o escopo é a tarefa (spec 0002).
 *
 * A pauta vem primeiro; abaixo, numa seção claramente separada, os demais
 * formulários publicados da org — preencher um deles o vincula à tarefa.
 */
export function ActionFormsDialog({
  actionId,
  open,
  onOpenChange,
}: ActionFormsDialogProps) {
  const router = useRouter();
  const { action, forms, isLoading } = useActionForms(actionId, {
    enabled: open,
  });
  const leadId = action?.leadId ?? null;
  const attachMutation = useAttachFormToAction(leadId);
  const detachMutation = useDetachFormFromAction(leadId);
  const { forms: organizationForms } = useQueryListForms({ enabled: open });

  const availableForms = useMemo(() => {
    const inPauta = new Set(forms.map((card) => card.form.id));
    return (organizationForms as unknown as DialogForm[]).filter(
      (candidate) => candidate.published && !inPauta.has(candidate.id),
    );
  }, [organizationForms, forms]);

  function goToFill(formId: string) {
    if (!leadId) return;
    onOpenChange(false);
    // `fromAction`, não `actionId`: o modal-provider do layout escuta
    // `?actionId=` globalmente (useQueryState) e abriria o ViewActionModal
    // por cima do formulário.
    router.push(
      `/formulario/novo/${formId}/${leadId}?fromAction=${encodeURIComponent(actionId)}`,
    );
  }

  /** Preencher um formulário de fora da pauta o adiciona à tarefa antes. */
  function attachAndFill(formId: string) {
    attachMutation.mutate(
      { actionId, formId },
      {
        onSuccess: () => goToFill(formId),
        onError: (error) =>
          toast.error(error.message || "Falha ao vincular formulário"),
      },
    );
  }

  function detachForm(formId: string, responseCount: number) {
    if (responseCount > 0) {
      const noun = responseCount === 1 ? "resposta" : "respostas";
      const verb = responseCount === 1 ? "voltará" : "voltarão";
      const adjective = responseCount === 1 ? "avulsa" : "avulsas";
      const confirmed = window.confirm(
        `${responseCount} ${noun} ${verb} a ser ${adjective} no lead. Continuar?`,
      );
      if (!confirmed) return;
    }

    detachMutation.mutate(
      { actionId, formId, detachResponses: responseCount > 0 },
      {
        onSuccess: () => toast.success("Formulário removido da tarefa"),
        onError: (error) =>
          toast.error(error.message || "Falha ao remover formulário"),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* `sm:max-w-5xl` é obrigatório: o DialogContent traz `sm:max-w-lg` por
          padrão e, sendo media query, vence um `max-w-*` base. */}
      <DialogContent className="flex h-[85vh] max-h-[85vh] w-[95vw] max-w-[95vw] flex-col gap-3 overflow-hidden p-6 sm:max-w-5xl">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-lg">
            Formulários da tarefa
            {action?.title ? ` — ${action.title}` : ""}
          </DialogTitle>
          <DialogDescription>
            Apenas os formulários e respostas desta tarefa.
            {action?.lead?.name ? ` Lead: ${action.lead.name}.` : ""}
            {!leadId && " Esta tarefa não tem lead vinculado."}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <Spinner />
          </div>
        ) : (
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Na pauta desta tarefa ({forms.length})
              </h3>

              {forms.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum formulário vinculado a esta tarefa ainda.
                </p>
              ) : (
                <div className="grid grid-cols-1 content-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {forms.map((card) => (
                    <PautaCard
                      key={card.form.id}
                      form={card.form as DialogForm}
                      isOrigin={card.isOrigin}
                      responses={card.responses}
                      canFill={!!leadId}
                      onOpenResponse={(responseId) => {
                        onOpenChange(false);
                        router.push(`/formulario/${card.form.id}/${responseId}`);
                      }}
                      onFill={() => goToFill(card.form.id)}
                      onDetach={() =>
                        detachForm(card.form.id, card.responses.length)
                      }
                      isDetaching={detachMutation.isPending}
                    />
                  ))}
                </div>
              )}
            </section>

            {availableForms.length > 0 && (
              <section className="space-y-2 border-t pt-4">
                <div className="space-y-0.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Outros formulários da organização ({availableForms.length})
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Ainda não fazem parte desta tarefa. Preencher um deles o
                    vincula automaticamente à pauta.
                  </p>
                </div>

                <div className="grid grid-cols-1 content-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {availableForms.map((candidate) => (
                    <AvailableCard
                      key={candidate.id}
                      form={candidate}
                      canFill={!!leadId}
                      isPending={attachMutation.isPending}
                      onFill={() => attachAndFill(candidate.id)}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Cards ────────────────────────────────────────────────────────────────────

type ResponseSummary = {
  id: string;
  label: string | null;
  state: string;
  hasDivergentLead: boolean;
};

function CardShell({
  children,
  highlighted = false,
}: {
  children: React.ReactNode;
  highlighted?: boolean;
}) {
  return (
    // `h-full` + o `content-start` do grid: as linhas se dimensionam pelo
    // conteúdo, mas os cards de uma mesma linha ficam da mesma altura.
    <div
      className={cn(
        "flex h-full flex-col gap-2 rounded-xl border border-border bg-card p-3 transition-all",
        "hover:border-violet-400 hover:shadow-md",
        highlighted && "border-violet-500 ring-1 ring-violet-500/50",
      )}
    >
      {children}
    </div>
  );
}

function PautaCard({
  form,
  isOrigin,
  responses,
  canFill,
  onOpenResponse,
  onFill,
  onDetach,
  isDetaching,
}: {
  form: DialogForm;
  isOrigin: boolean;
  responses: ResponseSummary[];
  canFill: boolean;
  onOpenResponse: (responseId: string) => void;
  onFill: () => void;
  onDetach: () => void;
  isDetaching: boolean;
}) {
  const latest = responses[0];
  const state = latest?.state ?? "unfilled";

  return (
    <CardShell highlighted={isOrigin}>
      {/* Thumbnail sempre primeiro: badge e label acima dela empurrariam o
          conteúdo do card de origem, desalinhando as miniaturas da linha. */}
      <FormFirstGroupThumbnail
        jsonBlock={form.jsonBlock as never}
        settings={form.settings as never}
      />

      <div className="flex items-start justify-between gap-2">
        <h4
          className="line-clamp-2 text-sm font-semibold leading-tight"
          title={form.name}
        >
          {form.name}
        </h4>
        {!isOrigin && (
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            title="Remover da tarefa"
            onClick={onDetach}
            disabled={isDetaching}
          >
            <Trash2Icon className="size-3.5" />
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {isOrigin && (
          <span className="inline-flex items-center gap-1 rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-medium text-white">
            <SparklesIcon className="size-3" />
            Gerou esta tarefa
          </span>
        )}
        {latest?.label && (
          <span className="max-w-full truncate rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-900 dark:border-violet-800/40 dark:bg-violet-900/20 dark:text-violet-200">
            {latest.label}
          </span>
        )}
        {!form.published && (
          <span className="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">
            Não publicado
          </span>
        )}
        {responses.some((response) => response.hasDivergentLead) && (
          <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-medium text-white">
            Lead divergente
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span
          className="inline-flex items-center gap-1.5"
          title={STATE_LABELS[state] ?? state}
        >
          <span
            className="inline-block size-2 rounded-full"
            style={{ background: STATE_COLORS[state] ?? "#6b7280" }}
          />
          {STATE_LABELS[state] ?? state}
        </span>
        <span>·</span>
        <span>
          {responses.length} {responses.length === 1 ? "resposta" : "respostas"}
        </span>
      </div>

      {/* `mt-auto`: com os cards da linha na mesma altura, os botões encostam
          no rodapé em vez de flutuarem logo abaixo do texto. */}
      <div className="mt-auto flex flex-col gap-1.5 pt-1">
        {latest && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenResponse(latest.id)}
          >
            <ClipboardListIcon className="size-4" />
            Abrir última
          </Button>
        )}
        <Button
          size="sm"
          onClick={onFill}
          disabled={!canFill || !form.published}
          title={
            !canFill
              ? "Vincule um lead à tarefa para preencher"
              : !form.published
                ? "Formulário não publicado"
                : undefined
          }
        >
          {latest ? "Preencher novo" : "Preencher"}
        </Button>
      </div>
    </CardShell>
  );
}

function AvailableCard({
  form,
  canFill,
  isPending,
  onFill,
}: {
  form: DialogForm;
  canFill: boolean;
  isPending: boolean;
  onFill: () => void;
}) {
  return (
    <CardShell>
      <FormFirstGroupThumbnail
        jsonBlock={form.jsonBlock as never}
        settings={form.settings as never}
      />

      <h4
        className="line-clamp-2 text-sm font-semibold leading-tight"
        title={form.name}
      >
        {form.name}
      </h4>

      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <span
          className="inline-block size-2 rounded-full"
          style={{ background: STATE_COLORS.unfilled }}
        />
        {STATE_LABELS.unfilled}
      </span>

      <Button
        size="sm"
        variant="outline"
        className="mt-auto"
        onClick={onFill}
        disabled={!canFill || isPending}
        title={
          canFill
            ? "Preencher e vincular a esta tarefa"
            : "Vincule um lead à tarefa para preencher"
        }
      >
        Preencher
      </Button>
    </CardShell>
  );
}
