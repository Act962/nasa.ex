"use client";

import { useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  useQueryFormResponseById,
  useMutationUpdateResponse,
} from "@/features/form/hooks/use-form";
import { FormSubmitComponent } from "@/features/form/components/public/form-submit-component";
import { FormLeadProvider } from "@/features/form/context/form-lead-context";
import type { FieldValue, FormBlockInstance } from "@/features/form/types";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { orpc } from "@/lib/orpc";

/**
 * Página de "continuar preenchimento" de uma resposta de formulário, acessada
 * pelo botão "Ver todas as respostas" da aba `Formulário` no detalhe do lead.
 *
 * Fluxo:
 *  - Usuário logado abre `/formulario/<slug>/<responseId>` (slug é cosmético).
 *  - A procedure `form.getResponseById` valida que a resposta pertence à
 *    organização ativa.
 *  - O `FormSubmitComponent` é renderizado em modo edição: pula a coleta de
 *    dados pessoais, pré-preenche os campos e usa `form.updateResponse` no
 *    submit final.
 *  - Cabeçalho fixo mostra o status atual do lead (com cor) e o responsável
 *    pela etapa, pra dar contexto pra quem vai continuar o preenchimento.
 */
export default function Page() {
  const params = useParams<{ slug: string; responseId: string }>();
  const responseId = params.responseId;
  const router = useRouter();

  const { response, isLoading, isError, error } = useQueryFormResponseById(responseId);
  const updateMutation = useMutationUpdateResponse();

  // Valores iniciais convertidos pra `FieldValue` (a estrutura interna que o
  // FormSubmitComponent usa em `formVals`). jsonResponse pode vir como string
  // (do JSON salvo) ou já desserializado.
  const initialResponseValues = useMemo<
    Record<string, FieldValue> | undefined
  >(() => {
    if (!response?.jsonResponse) return undefined;
    let parsed: Record<string, unknown> = {};
    try {
      parsed =
        typeof response.jsonResponse === "string"
          ? JSON.parse(response.jsonResponse)
          : (response.jsonResponse as Record<string, unknown>);
    } catch {
      return undefined;
    }
    const out: Record<string, FieldValue> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (v == null) continue;
      if (typeof v === "string") {
        out[k] = { value: v };
      } else if (typeof v === "object") {
        const o = v as { value?: unknown; meta?: Record<string, unknown> };
        if (typeof o.value === "string") {
          out[k] = { value: o.value, meta: o.meta };
        }
      }
    }
    return out;
  }, [response?.jsonResponse]);

  const blocks = useMemo<FormBlockInstance[]>(() => {
    if (!response?.form?.jsonBlock) return [];
    try {
      return JSON.parse(response.form.jsonBlock) as FormBlockInstance[];
    } catch {
      return [];
    }
  }, [response?.form?.jsonBlock]);

  const responsibleImg = useConstructUrl(
    response?.lead?.responsible?.image || "",
  );

  // Mutation pra gerar (ou reusar) o token público do lead. O cliente abre
  // `/lead/<token>` pra acompanhar o status em tempo real (cor da etapa,
  // responsável, timeline, SLA).
  const generateLink = useMutation(
    orpc.leads.generatePublicLink.mutationOptions({}),
  );

  function copyClientLink() {
    const lid = response?.lead?.id;
    if (!lid) return;
    generateLink.mutate(
      { leadId: lid, rotate: false },
      {
        onSuccess: (res) => {
          const r = res as { url?: string; token?: string };
          // Fallback: se a env NEXT_PUBLIC_APP_URL não estiver setada, a
          // procedure devolve URL relativa — concatenamos com origin do
          // navegador pra que o link colado seja absoluto.
          let url = r.url || "";
          if (url && !/^https?:\/\//.test(url)) {
            url = `${window.location.origin}${url.startsWith("/") ? "" : "/"}${url}`;
          }
          if (!url && r.token) {
            url = `${window.location.origin}/lead/${r.token}`;
          }
          if (!url) {
            toast.error("Não foi possível gerar o link");
            return;
          }
          navigator.clipboard
            .writeText(url)
            .then(() => toast.success("Link do cliente copiado!"))
            .catch(() => toast.info(url));
        },
        onError: () => toast.error("Falha ao gerar link do cliente"),
      },
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner />
      </div>
    );
  }

  if (!response || !response.form) {
    // Em vez do `NotAvaliable` genérico, mostramos a mensagem real (ex.:
    // "Você não tem acesso a esta resposta") pra evitar diagnóstico cego
    // quando o problema é de permissão ou ID inválido.
    const msg =
      (error as { message?: string } | null | undefined)?.message ??
      "Resposta não encontrada";
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-3 p-6 text-center">
        <h2 className="text-lg font-semibold">{msg}</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          {isError
            ? "Verifique se o link está correto ou se você tem acesso a esta organização."
            : "Pode ser que a resposta tenha sido apagada."}
        </p>
        <Button variant="outline" onClick={() => router.back()}>
          Voltar
        </Button>
      </div>
    );
  }

  const status = response.lead?.status;
  const responsible = response.lead?.responsible;
  const tracking = response.lead?.tracking;
  const leadId = response.lead?.id;

  return (
    <div className="w-full h-screen flex flex-col bg-background">
      {/* ── Cabeçalho com contexto do lead ─────────────────────────── */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-[920px] mx-auto px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="shrink-0"
          >
            <ArrowLeft className="size-4" />
          </Button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm font-semibold truncate">
                {response.form.name}
              </h1>
              {tracking?.name && (
                <span className="text-[11px] text-muted-foreground">
                  • {tracking.name}
                </span>
              )}
            </div>
            <div className="text-[11px] text-muted-foreground truncate">
              Lead: {response.lead?.name ?? "—"}
            </div>
          </div>

          {/* Compartilhar com cliente — gera (ou reusa) `publicToken` e
              copia a URL do `/lead/<token>` pra área de transferência. */}
          {leadId && (
            <Button
              variant="outline"
              size="sm"
              onClick={copyClientLink}
              disabled={generateLink.isPending}
              className="shrink-0"
              title="Copiar link de acompanhamento pra enviar ao cliente"
            >
              <Link2 className="size-4" />
              <span className="hidden sm:inline">Link do cliente</span>
            </Button>
          )}

          {/* Status atual do lead com cor */}
          {status && (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium shrink-0"
              style={{
                borderColor: status.color || undefined,
                color: status.color || undefined,
                background: status.color
                  ? `${status.color}15`
                  : undefined,
              }}
              title="Status atual do lead"
            >
              <span
                className="inline-block size-2 rounded-full"
                style={{ background: status.color || "#888" }}
              />
              {status.name}
            </div>
          )}

          {/* Responsável pela etapa atual */}
          {responsible && (
            <div
              className="flex items-center gap-2 shrink-0"
              title={`Responsável: ${responsible.name}`}
            >
              {responsible.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={responsibleImg}
                  alt={responsible.name}
                  className="size-7 rounded-full object-cover border"
                />
              ) : (
                <span className="size-7 rounded-full bg-foreground/10 flex items-center justify-center text-[10px] font-semibold">
                  {(responsible.name ?? "?").slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="text-xs hidden sm:inline">
                {responsible.name}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* ── Form em modo edit ──────────────────────────────────────── */}
      <main className="flex-1 min-h-0">
        <FormLeadProvider
          value={{
            leadId: response.lead?.id ?? null,
            leadPublicToken: response.lead?.publicToken ?? null,
            formId: response.form.id,
          }}
        >
          <FormSubmitComponent
            id={response.form.id}
            blocks={blocks}
            settings={response.form.settings}
            initialResponseValues={initialResponseValues}
            submitLabel="Salvar"
            onSubmitOverride={async (responseJson) => {
              try {
                // `isFinal: true` aciona o "Direcionamento" do form —
                // move o lead pro tracking/status configurado quando
                // o consultor finaliza/salva a resposta nessa página.
                await updateMutation.mutateAsync({
                  id: response.id,
                  response: responseJson,
                  isFinal: true,
                });
                toast.success("Resposta atualizada");
              } catch (err) {
                toast.error("Falha ao atualizar a resposta");
                throw err;
              }
            }}
          />
        </FormLeadProvider>
      </main>
    </div>
  );
}
