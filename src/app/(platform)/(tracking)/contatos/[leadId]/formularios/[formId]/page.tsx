"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { format, formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  Eye,
  Link2,
  Pencil,
  PlusCircle,
  X,
} from "lucide-react";
import type { FormBlockInstance } from "@/features/form/types";

const FormPrintButton = dynamic(
  () =>
    import("@/features/form/components/pdf/form-print-button").then(
      (module_) => ({ default: module_.FormPrintButton }),
    ),
  { ssr: false },
);
import { orpc } from "@/lib/orpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  STATE_COLOR,
  STATE_LABEL,
  type FormResponseState,
} from "@/features/form/lib/form-response-state";
import { buildResponseSlug } from "@/features/form/lib/response-slug";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { SquarePenIcon } from "lucide-react";

/**
 * Página dedicada das respostas de UM formulário pra UM lead.
 *
 * Fluxo de uso:
 *  - Vem do detalhe do lead (aba Formulários → Abrir).
 *  - Lista todas as respostas do par (lead, form) em ordem decrescente.
 *  - Cada linha tem título editável (form.name · label), badge de estado
 *    (5 cores), data, e ações (abrir, copiar link cliente).
 *  - Botão **"Preencher novo"** SEMPRE habilitado — múltiplos preenchimentos
 *    concorrentes são suportados (ex: cliente com 2 carros, cada qual com
 *    seu Checklist em andamento independente).
 */
export default function Page() {
  const params = useParams<{ leadId: string; formId: string }>();
  const leadId = params.leadId;
  const formId = params.formId;
  const router = useRouter();

  const queryClient = useQueryClient();
  const queryOpts = orpc.leads.listResponsesOfForm.queryOptions({
    input: { leadId, formId },
  });
  const { data, isLoading, isError } = useQuery(queryOpts);

  const updateLabelMutation = useMutation(
    orpc.form.updateResponseLabel.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: queryOpts.queryKey });
      },
    }),
  );

  const blocks = useMemo<FormBlockInstance[]>(() => {
    if (!data?.form.jsonBlock) return [];
    try {
      return JSON.parse(data.form.jsonBlock as unknown as string) as FormBlockInstance[];
    } catch {
      return [];
    }
  }, [data?.form.jsonBlock]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-3 p-6 text-center">
        <h2 className="text-lg font-semibold">Formulário ou lead não encontrado</h2>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="size-4" />
          Voltar
        </Button>
      </div>
    );
  }

  const responses = data.responses ?? [];

  return (
    <div className="w-full max-w-[920px] mx-auto py-6 px-4 space-y-4">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          title="Voltar"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight truncate">
            {data.form.name}
          </h1>
          <p className="text-xs text-muted-foreground truncate">
            Lead: <strong>{data.lead.name}</strong>
            {" · "}
            {responses.length}{" "}
            {responses.length === 1 ? "resposta" : "respostas"}
          </p>
        </div>
        <FormPrintButton
          blocks={blocks}
          formName={data.form.name}
          leadName={data.lead.name ?? undefined}
        />
        <Button
          size="sm"
          onClick={() =>
            router.push(`/formulario/novo/${formId}/${leadId}`)
          }
          title="Iniciar um novo preenchimento independente"
        >
          <PlusCircle className="size-4" />
          Preencher novo
        </Button>
      </div>

      {/* Lista de respostas — ou estado vazio */}
      {responses.length === 0 && (
        <Empty className="w-full">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SquarePenIcon />
            </EmptyMedia>
            <EmptyTitle>Ainda não há preenchimentos</EmptyTitle>
            <EmptyDescription>
              Clique em <strong>Preencher novo</strong> acima para iniciar a
              primeira resposta deste formulário.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {responses.length > 0 && (
        <div className="flex flex-col gap-3">
          {responses.map((r) => (
            <ResponseCard
              key={r.id}
              response={r}
              formName={data.form.name}
              leadId={leadId}
              isUpdatingLabel={updateLabelMutation.isPending}
              onSaveLabel={(label) =>
                updateLabelMutation.mutate({ id: r.id, label })
              }
              onOpen={() => {
                const slug = buildResponseSlug(
                  data.form.name,
                  new Date(r.createdAt),
                );
                router.push(`/formulario/${slug}/${r.id}`);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

type ResponseRow = {
  id: string;
  createdAt: Date | string;
  label: string | null;
  labelManuallyEdited: boolean;
  state: FormResponseState;
};

function ResponseCard({
  response,
  formName,
  leadId,
  isUpdatingLabel,
  onSaveLabel,
  onOpen,
}: {
  response: ResponseRow;
  formName: string;
  leadId: string;
  isUpdatingLabel: boolean;
  onSaveLabel: (label: string | null) => void;
  onOpen: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(response.label ?? "");
  const stateColor = STATE_COLOR[response.state];
  const stateLabel = STATE_LABEL[response.state];
  const created = new Date(response.createdAt);

  // Link de visualização do cliente (read-only com assinatura).
  const generateLink = useMutation(
    orpc.leads.generatePublicLink.mutationOptions({}),
  );
  function copyClientFormLink() {
    generateLink.mutate(
      { leadId, rotate: false },
      {
        onSuccess: (res) => {
          const r = res as { token?: string };
          if (!r.token) {
            toast.error("Não foi possível gerar o link");
            return;
          }
          const url = `${window.location.origin}/lead/${r.token}/formulario/${response.id}`;
          navigator.clipboard
            .writeText(url)
            .then(() =>
              toast.success("Link de visualização do cliente copiado!"),
            )
            .catch(() => toast.info(url));
        },
        onError: () => toast.error("Falha ao gerar link do cliente"),
      },
    );
  }

  function commit() {
    const trimmed = draft.trim();
    // String vazia → reseta override (volta a auto-derivar). String com
    // conteúdo → vira manual e prevalece sobre auto.
    onSaveLabel(trimmed.length === 0 ? "" : trimmed);
    setEditing(false);
  }

  function cancel() {
    setDraft(response.label ?? "");
    setEditing(false);
  }

  return (
    <Card className="hover:bg-foreground/5 transition-colors">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 flex-wrap text-base">
          <span className="font-medium">{formName}</span>
          {!editing ? (
            <>
              {response.label ? (
                <span className="text-muted-foreground font-normal">
                  · {response.label}
                </span>
              ) : (
                <span className="text-muted-foreground/60 font-normal italic">
                  · sem título
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  setDraft(response.label ?? "");
                  setEditing(true);
                }}
                className="text-muted-foreground hover:text-foreground"
                title="Editar título"
              >
                <Pencil className="size-3.5" />
              </button>
            </>
          ) : (
            <span className="inline-flex items-center gap-1">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commit();
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    cancel();
                  }
                }}
                placeholder="ex: #00123 ou Revisão semestral"
                className="h-7 text-xs w-56"
                autoFocus
                disabled={isUpdatingLabel}
              />
              <Button
                size="icon-sm"
                variant="outline"
                onClick={commit}
                disabled={isUpdatingLabel}
                title="Salvar (Enter)"
              >
                <Check className="size-3.5" />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={cancel}
                disabled={isUpdatingLabel}
                title="Cancelar (Esc)"
              >
                <X className="size-3.5" />
              </Button>
            </span>
          )}

          <span
            className="ml-auto inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-medium"
            style={{
              borderColor: stateColor,
              color: stateColor === "#ffffff" ? "#475569" : stateColor,
              background:
                stateColor === "#ffffff" ? "#f1f5f9" : `${stateColor}15`,
            }}
            title={stateLabel}
          >
            <span
              className="inline-block size-1.5 rounded-full"
              style={{ background: stateColor }}
            />
            {stateLabel}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between pt-0">
        <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
          <span>{format(created, "dd/MM/yyyy HH:mm")}</span>
          <span>·</span>
          <span>
            {formatDistanceToNowStrict(created, {
              addSuffix: true,
              locale: ptBR,
            })}
          </span>
          {response.labelManuallyEdited && (
            <>
              <span>·</span>
              <span
                className="text-[10px] uppercase tracking-wider"
                title="O título foi editado manualmente — saves seguintes não sobrescrevem automaticamente. Limpe o título pra voltar ao automático."
              >
                título manual
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={copyClientFormLink}
            disabled={generateLink.isPending}
            title="Copiar link de visualização do cliente"
          >
            <Link2 className="size-3.5" />
            Link cliente
          </Button>
          <Button size="sm" onClick={onOpen} title="Abrir resposta">
            <Eye className="size-3.5" />
            Abrir
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
