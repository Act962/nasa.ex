"use client";

import { useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { useMutation } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  useQueryFormById,
  useMutationCreateResponseForLead,
  useMutationUpdateResponse,
} from "@/features/form/hooks/use-form";
import { useQueryLead } from "@/features/leads/hooks/use-lead";
import { FormSubmitComponent } from "@/features/form/components/public/form-submit-component";
import { FormLeadProvider } from "@/features/form/context/form-lead-context";
import { NotAvaliable } from "@/features/form/components/public/not-avaliable";
import type { FormBlockInstance } from "@/features/form/types";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { buildResponseSlug } from "@/features/form/lib/response-slug";
import { orpc } from "@/lib/orpc";

const FormPrintButton = dynamic(
  () =>
    import("@/features/form/components/pdf/form-print-button").then(
      (module_) => ({ default: module_.FormPrintButton }),
    ),
  { ssr: false },
);

/**
 * Página interna pra um consultor (ex: a Jessica) preencher um formulário em
 * nome de um lead que ainda não respondeu àquele form. Visualmente é igual
 * ao `/formulario/[slug]/[responseId]` (modo edição), mas:
 *  - Não há `responseId` ainda — é uma resposta NOVA.
 *  - O submit cria via `form.createResponseForLead` (em vez de update).
 *  - Após criar, redireciona pra URL canônica de edição daquela resposta
 *    (`/formulario/<slug>/<novoResponseId>`) pra que o consultor consiga
 *    voltar e continuar editando.
 */
export default function Page() {
  const params = useParams<{ formId: string; leadId: string }>();
  const formId = params.formId;
  const leadId = params.leadId;
  const router = useRouter();

  const { form, isLoading: formLoading } = useQueryFormById({ formId });
  const { data: leadData, isLoading: leadLoading } = useQueryLead(leadId);
  const createMutation = useMutationCreateResponseForLead();
  const updateMutation = useMutationUpdateResponse();

  // Rastreia o id da FormResponses criada pelo auto-save (1º Próximo).
  // Reusado no onSubmitOverride pra que o submit final ATUALIZE em vez
  // de criar uma 2ª resposta. Sem isso, cada submit criaria duplicata
  // (draft do auto-save + final do submit).
  const autoSavedResponseIdRef = useRef<string | null>(null);

  // Notifica a timeline (interna + pública via Pusher) que o consultor abriu
  // o formulário. A procedure é idempotente (10min de janela) — refresh ou
  // entrar/sair várias vezes não duplica eventos. Roda 1x por mount;
  // o ref evita disparo duplo do StrictMode em dev.
  const recordOpening = useMutation(
    orpc.form.recordFormOpening.mutationOptions({}),
  );
  const openingRecordedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!formId || !leadId) return;
    const key = `${formId}:${leadId}`;
    if (openingRecordedRef.current === key) return;
    openingRecordedRef.current = key;
    recordOpening.mutate({ formId, leadId });
    // recordOpening é estável dentro do componente; não precisa entrar nas deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formId, leadId]);

  const lead = (leadData as { lead?: any } | undefined)?.lead;
  const status = lead?.status as
    | { id?: string; name?: string; color?: string }
    | undefined;
  const responsible = lead?.responsible as
    | { id?: string; name?: string; image?: string | null }
    | undefined;
  const tracking = lead?.tracking as
    | { id?: string; name?: string }
    | undefined;

  const blocks = useMemo<FormBlockInstance[]>(() => {
    if (!form?.jsonBlock) return [];
    try {
      return JSON.parse(form.jsonBlock as unknown as string) as FormBlockInstance[];
    } catch {
      return [];
    }
  }, [form?.jsonBlock]);

  const responsibleImg = useConstructUrl(responsible?.image || "");

  // Compartilhar link do cliente (mesma feature da página de edição).
  const generateLink = useMutation(
    orpc.leads.generatePublicLink.mutationOptions({}),
  );
  function copyClientLink() {
    generateLink.mutate(
      { leadId, rotate: false },
      {
        onSuccess: (res) => {
          const r = res as { url?: string; token?: string };
          let url = r.url || "";
          if (url && !/^https?:\/\//.test(url)) {
            url = `${window.location.origin}${url.startsWith("/") ? "" : "/"}${url}`;
          }
          if (!url && r.token) {
            url = `${window.location.origin}/lead/${r.token}`;
          }
          if (!url) return toast.error("Não foi possível gerar o link");
          navigator.clipboard
            .writeText(url)
            .then(() => toast.success("Link do cliente copiado!"))
            .catch(() => toast.info(url));
        },
        onError: () => toast.error("Falha ao gerar link do cliente"),
      },
    );
  }

  const isLoading = formLoading || leadLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner />
      </div>
    );
  }

  if (!form || !lead) {
    return <NotAvaliable />;
  }

  return (
    <div className="w-full h-screen flex flex-col bg-background">
      {/* Cabeçalho com contexto do lead */}
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
              <h1 className="text-sm font-semibold truncate">{form.name}</h1>
              {tracking?.name && (
                <span className="text-[11px] text-muted-foreground">
                  • {tracking.name}
                </span>
              )}
              <span className="text-[10px] uppercase font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                Novo preenchimento
              </span>
            </div>
            <div className="text-[11px] text-muted-foreground truncate">
              Lead: {lead.name ?? "—"}
            </div>
          </div>

          {/* Compartilhar link do cliente */}
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

          <FormPrintButton
            blocks={blocks}
            formName={form.name}
            leadName={lead.name ?? undefined}
          />

          {status && (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium shrink-0"
              style={{
                borderColor: status.color || undefined,
                color: status.color || undefined,
                background: status.color ? `${status.color}15` : undefined,
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

      {/* Form em modo "novo preenchimento interno" */}
      <main className="flex-1 min-h-0">
        <FormLeadProvider
          value={{
            leadId,
            leadPublicToken:
              (lead as { publicToken?: string | null } | null)?.publicToken ??
              null,
            formId,
          }}
        >
        <FormSubmitComponent
          id={form.id}
          blocks={blocks}
          settings={form.settings}
          // Pré-preenche o "user_*" caso o form tenha needLogin: como já
          // estamos em modo edit (override presente), os campos pessoais do
          // form serão pulados de qualquer forma — esses dados ficam só pra
          // referência futura caso a estrutura mude.
          initialLead={{
            name: lead.name ?? "",
            email: lead.email ?? "",
            phone: lead.phone ?? "",
          }}
          submitLabel="Enviar"
          // Auto-save no fluxo interno: a cada Próximo, cria (1ª) ou
          // atualiza (próximas) a FormResponses. Resultado: assim que o
          // consultor clica o primeiro Próximo, o lead já aparece em
          // "Detalhes do lead > Formulários" com o botão "Abrir" liberado,
          // permitindo acompanhamento em tempo real (Pusher).
          onPartialSave={async (responseJson, currentResponseId) => {
            try {
              const existingId = currentResponseId ?? autoSavedResponseIdRef.current;
              if (existingId) {
                await updateMutation.mutateAsync({
                  id: existingId,
                  response: responseJson,
                });
                return { responseId: existingId };
              }
              const res = await createMutation.mutateAsync({
                formId,
                leadId,
                response: responseJson,
              });
              const newId = (
                res as { response?: { id?: string } } | null | undefined
              )?.response?.id;
              if (newId) autoSavedResponseIdRef.current = newId;
              return newId ? { responseId: newId } : null;
            } catch (err) {
              // Falha silenciosa: usuário continua preenchendo. O submit
              // final ainda funciona porque persistPartial ignora erros.
              console.warn("[formulario/novo] auto-save falhou", err);
              return null;
            }
          }}
          onSubmitOverride={async (responseJson) => {
            try {
              // Se já existe draft criado pelo auto-save, ATUALIZA em vez de
              // criar duplicata. Sem isso o submit final criaria uma 2ª
              // FormResponses (incrementando contador errado, gerando 2
              // entradas na timeline, etc.). `isFinal: true` aciona o
              // "Direcionamento" (move o lead pro tracking/status do form).
              const draftId = autoSavedResponseIdRef.current;
              if (draftId) {
                await updateMutation.mutateAsync({
                  id: draftId,
                  response: responseJson,
                  isFinal: true,
                });
                toast.success("Resposta enviada");
                const slug = buildResponseSlug(form.name, new Date());
                router.replace(`/formulario/${slug}/${draftId}`);
                return;
              }
              // Caminho original (consultor clicou direto em Enviar sem
              // passar por nenhum Próximo): cria a resposta normalmente.
              // `isFinal: true` aciona o "Direcionamento" do form.
              const res = await createMutation.mutateAsync({
                formId,
                leadId,
                response: responseJson,
                isFinal: true,
              });
              toast.success("Resposta enviada");
              const newResponseId = (
                res as {
                  response?: { id?: string; createdAt?: string | Date };
                }
              )?.response?.id;
              const createdAt = (
                res as { response?: { createdAt?: string | Date } }
              )?.response?.createdAt;
              if (newResponseId) {
                const slug = buildResponseSlug(
                  form.name,
                  createdAt ? new Date(createdAt) : new Date(),
                );
                // Redireciona pra URL canônica de edição (replace pra não
                // empilhar a URL "novo" no histórico do navegador).
                router.replace(`/formulario/${slug}/${newResponseId}`);
              }
            } catch (err) {
              // Quando o erro é FORBIDDEN (user não é participante do
              // tracking atual do lead), mostra a mensagem específica
              // — útil pra o consultor entender o motivo do bloqueio.
              const msg =
                (err as { message?: string } | null | undefined)?.message ??
                "Falha ao enviar a resposta";
              toast.error(msg);
              throw err;
            }
          }}
        />
        </FormLeadProvider>
      </main>
    </div>
  );
}
