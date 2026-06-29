"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { orpc } from "@/lib/orpc";
import { FormSubmitComponent } from "@/features/form/components/public/form-submit/form-submit-component";
import { FormTrackingScripts } from "@/features/form/components/public/form-tracking-scripts";
import { FormLeadProvider } from "@/features/form/context/form-lead-context";
import type { FieldValue, FormBlockInstance } from "@/features/form/types";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { Lock } from "lucide-react";

const FormPrintButton = dynamic(
  () =>
    import("@/features/form/components/pdf/form-print-button").then(
      (module_) => ({ default: module_.FormPrintButton }),
    ),
  { ssr: false },
);

/**
 * Página PÚBLICA para o cliente final visualizar uma resposta de form
 * (read-only) e assinar SignatureClient. Auth via `publicToken` do lead na
 * URL — sem login obrigatório.
 *
 * Fluxo:
 *  - Carrega `form.getResponseByToken({token, responseId})`.
 *  - Renderiza `FormSubmitComponent` com `readOnly` ligado.
 *  - O CSS do componente bloqueia interação em todos os inputs, exceto
 *    blocos com `data-allow-interaction` (SignatureClient hoje).
 *  - Quando o cliente clica em "Enviar assinatura", o submit pega só os
 *    campos com `value` que pertencem a `SignatureClient` e chama
 *    `form.updateClientSignatures` (procedure que já valida server-side
 *    quais blocos podem ser alterados).
 */
export default function Page() {
  const params = useParams<{ token: string; responseId: string }>();
  const token = params.token;
  const responseId = params.responseId;

  const { data, isLoading, isError } = useQuery({
    ...orpc.form.getResponseByToken.queryOptions({
      input: { token, responseId },
    }),
    retry: false,
  });

  const updateMutation = useMutation(
    orpc.form.updateClientSignatures.mutationOptions({}),
  );

  const response = data?.response;

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

  // Coleta IDs dos SignatureClient pra filtrar o payload no submit.
  const signatureClientIds = useMemo<Set<string>>(() => {
    const ids = new Set<string>();
    function visit(b: FormBlockInstance) {
      if (b.blockType === "SignatureClient") ids.add(b.id);
      if (Array.isArray(b.childblocks)) {
        for (const c of b.childblocks) visit(c);
      }
    }
    for (const b of blocks) visit(b);
    return ids;
  }, [blocks]);

  const responsibleImg = useConstructUrl(
    response?.lead?.responsible?.image || "",
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner />
      </div>
    );
  }

  if (isError || !response || !response.form) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-3 p-6 text-center">
        <Lock className="size-12 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Link inválido ou expirado</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          Confirme com o estabelecimento se o link está correto.
        </p>
      </div>
    );
  }

  const status = response.lead?.status;
  const responsible = response.lead?.responsible;
  const tracking = response.lead?.tracking;

  return (
    <div className="w-full min-h-screen flex flex-col bg-background">
      <FormTrackingScripts settings={response.form.settings} />
      {/* Cabeçalho — contexto do atendimento */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-[920px] mx-auto px-4 py-3 flex items-center gap-3">
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
              <span className="text-[10px] uppercase font-semibold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded inline-flex items-center gap-1">
                <Lock className="size-2.5" />
                Visualização do cliente
              </span>
            </div>
            <div className="text-[11px] text-muted-foreground truncate">
              Olá, {response.lead?.name ?? "—"}
            </div>
          </div>
          <FormPrintButton
            blocks={blocks}
            formName={response.form.name}
            leadName={response.lead?.name ?? undefined}
            responseValues={initialResponseValues}
          />

          {status && (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium shrink-0"
              style={{
                borderColor: status.color || undefined,
                color: status.color || undefined,
                background: status.color ? `${status.color}15` : undefined,
              }}
              title="Etapa atual"
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
        <div className="max-w-[920px] mx-auto px-4 pb-2 text-[11px] text-muted-foreground">
          Você pode revisar todas as informações deste formulário e assinar nos
          campos disponíveis. Os demais campos não podem ser alterados.
        </div>
      </header>

      {/* Form em modo read-only com SignatureClient interativo */}
      <main className="flex-1 min-h-0">
        <FormLeadProvider
          value={{
            // O cliente final acessa via token; já temos lead.id mas
            // expomos o token como `leadPublicToken` pra QRs de
            // acompanhamento gerarem o mesmo link compartilhado.
            leadId: response.lead?.id ?? null,
            leadPublicToken: token,
            formId: response.form.id,
          }}
        >
          <FormSubmitComponent
            id={response.form.id}
            blocks={blocks}
            settings={response.form.settings}
            initialResponseValues={initialResponseValues}
            readOnly
            submitLabel="Enviar assinatura"
            onSubmitOverride={async (responseJson) => {
              try {
                const parsed = JSON.parse(responseJson) as Record<
                  string,
                  FieldValue
                >;
                // Filtra só o que é SignatureClient (o que o cliente pode
                // alterar). A procedure server-side faz a mesma checagem
                // como defesa em profundidade.
                const signatures: Record<
                  string,
                  { value: string; meta?: Record<string, unknown> }
                > = {};
                for (const [k, v] of Object.entries(parsed)) {
                  if (!signatureClientIds.has(k)) continue;
                  if (!v || typeof v.value !== "string") continue;
                  if (!v.value) continue;
                  signatures[k] = {
                    value: v.value,
                    meta: v.meta as Record<string, unknown> | undefined,
                  };
                }
                if (Object.keys(signatures).length === 0) {
                  toast.info("Assine ao menos um campo antes de enviar.");
                  return;
                }
                await updateMutation.mutateAsync({
                  token,
                  responseId,
                  signatures,
                });
                toast.success("Assinatura registrada. Obrigado!");
              } catch (err) {
                toast.error("Falha ao enviar a assinatura");
                throw err;
              }
            }}
          />
        </FormLeadProvider>
      </main>
    </div>
  );
}
