"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Archive, Mail, Plus, Save, Send } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichtTextEditor } from "@/components/rich-text-editor/editor-lazy";
import { cn } from "@/lib/utils";
import { EMAIL_TEMPLATE_VARIABLES } from "../../email/variables";
import {
  useArchiveEmailTemplate,
  useEmailCampaigns,
  useEmailTemplates,
  useSaveEmailTemplate,
  useSendTestEmail,
} from "../../hooks/use-email-campaigns";

// Spec 0107 (RF-1/RF-6): montar os modelos de email e ver os últimos envios.

type TemplateDraft = {
  id?: string;
  name: string;
  subject: string;
  previewText: string;
  bodyField: string;
};

const EMPTY_DRAFT: TemplateDraft = { name: "", subject: "", previewText: "", bodyField: "" };

const CAMPAIGN_STATUS_LABEL: Record<string, string> = {
  queued: "Na fila",
  sending: "Enviando",
  sent: "Enviada",
  failed: "Falhou",
};

function parseBody(bodyField: string): Record<string, unknown> | null {
  if (!bodyField.trim()) return null;
  try {
    const parsed: unknown = JSON.parse(bodyField);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** O editor não é controlado depois de montado: a variável entra como parágrafo novo e o editor remonta. */
function appendParagraph(bodyField: string, text: string): string {
  const doc = parseBody(bodyField) ?? { type: "doc", content: [] };
  const content = Array.isArray(doc.content) ? doc.content : [];
  return JSON.stringify({
    ...doc,
    content: [...content, { type: "paragraph", content: [{ type: "text", text }] }],
  });
}

export function EmailTemplatesView() {
  const templatesQuery = useEmailTemplates();
  const campaignsQuery = useEmailCampaigns();
  const saveTemplate = useSaveEmailTemplate();
  const archiveTemplate = useArchiveEmailTemplate();
  const sendTest = useSendTestEmail();
  const [draft, setDraft] = useState<TemplateDraft>(EMPTY_DRAFT);
  const [editorKey, setEditorKey] = useState(0);

  const templates = templatesQuery.data?.templates ?? [];
  const bodyJson = parseBody(draft.bodyField);
  const canSubmit = !!draft.name.trim() && !!draft.subject.trim() && !!bodyJson;

  const openDraft = (next: TemplateDraft) => {
    setDraft(next);
    setEditorKey((key) => key + 1);
  };

  const handleSave = () => {
    if (!bodyJson) return;
    saveTemplate.mutate(
      {
        id: draft.id,
        name: draft.name,
        subject: draft.subject,
        previewText: draft.previewText || null,
        bodyJson,
      },
      {
        onSuccess: ({ id }) => {
          setDraft((current) => ({ ...current, id }));
          toast.success("Modelo salvo");
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  const handleSendTest = () => {
    if (!bodyJson) return;
    sendTest.mutate(
      { subject: draft.subject, previewText: draft.previewText || null, bodyJson },
      {
        onSuccess: ({ to }) => toast.success(`Teste enviado para ${to}`),
        onError: (error) => toast.error(error.message),
      },
    );
  };

  const handleArchive = () => {
    if (!draft.id) return;
    archiveTemplate.mutate(
      { id: draft.id },
      {
        onSuccess: () => {
          openDraft(EMPTY_DRAFT);
          toast.success("Modelo arquivado");
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <aside className="flex flex-col gap-2">
          <Button variant="outline" className="justify-start gap-2" onClick={() => openDraft(EMPTY_DRAFT)}>
            <Plus className="size-4" />
            Novo modelo
          </Button>
          {templatesQuery.isLoading && <OrbitaSpinner className="size-5" />}
          {templates.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() =>
                openDraft({
                  id: template.id,
                  name: template.name,
                  subject: template.subject,
                  previewText: template.previewText ?? "",
                  bodyField: JSON.stringify(template.bodyJson),
                })
              }
              className={cn(
                "rounded-xl border bg-card px-3 py-2 text-left transition-colors hover:border-primary/40",
                draft.id === template.id && "border-primary",
              )}
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                <Mail className="size-4 shrink-0 text-primary" />
                <span className="truncate">{template.name}</span>
              </div>
              <div className="mt-0.5 truncate text-xs text-muted-foreground">{template.subject}</div>
            </button>
          ))}
          {!templatesQuery.isLoading && templates.length === 0 && (
            <p className="px-1 text-xs text-muted-foreground">Nenhum modelo ainda. Crie o primeiro ao lado.</p>
          )}
        </aside>

        <section className="flex flex-col gap-4 rounded-2xl border bg-card p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome do modelo (só a equipe vê)</Label>
              <Input
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                placeholder="Resgate de clientes inativos"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Assunto</Label>
              <Input
                value={draft.subject}
                onChange={(event) => setDraft({ ...draft, subject: event.target.value })}
                placeholder="{{primeiro_nome}}, separamos uma condição pra você"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Texto de prévia (aparece ao lado do assunto na caixa de entrada)</Label>
            <Input
              value={draft.previewText}
              onChange={(event) => setDraft({ ...draft, previewText: event.target.value })}
              placeholder="Faz tempo que você não passa por aqui"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Corpo do email</Label>
            <RichtTextEditor
              key={editorKey}
              field={draft.bodyField}
              onChange={(value: string) => setDraft((current) => ({ ...current, bodyField: value }))}
              placeholder="Oi {{primeiro_nome}}, tudo bem?"
            />
          </div>
          <div className="space-y-2 rounded-xl bg-muted/40 p-3">
            <p className="text-xs font-medium text-muted-foreground">
              Variáveis (clique para inserir no corpo; no assunto, digite igual):
            </p>
            <div className="flex flex-wrap gap-1.5">
              {EMAIL_TEMPLATE_VARIABLES.map((variable) => (
                <button
                  key={variable.key}
                  type="button"
                  title={variable.label}
                  onClick={() => {
                    setDraft((current) => ({
                      ...current,
                      bodyField: appendParagraph(current.bodyField, `{{${variable.key}}}`),
                    }));
                    setEditorKey((key) => key + 1);
                  }}
                  className="inline-flex items-center rounded-md border bg-background px-2 py-1 font-mono text-[11px] hover:border-primary hover:text-primary"
                >
                  {`{{${variable.key}}}`}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Todo email sai com o rodapé &quot;Não quero mais receber&quot;. Ele é obrigatório e não pode ser
              removido.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {draft.id && (
              <Button variant="ghost" onClick={handleArchive} disabled={archiveTemplate.isPending} className="gap-1.5">
                <Archive className="size-4" />
                Arquivar
              </Button>
            )}
            <Button
              variant="outline"
              onClick={handleSendTest}
              disabled={!canSubmit || sendTest.isPending}
              className="gap-1.5"
            >
              {sendTest.isPending ? <OrbitaSpinner className="size-4" /> : <Send className="size-4" />}
              Enviar teste para mim
            </Button>
            <Button onClick={handleSave} disabled={!canSubmit || saveTemplate.isPending} className="gap-1.5">
              {saveTemplate.isPending ? <OrbitaSpinner className="size-4" /> : <Save className="size-4" />}
              Salvar modelo
            </Button>
          </div>
        </section>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Últimos envios de email</h2>
        {(campaignsQuery.data?.campaigns ?? []).length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nenhum envio ainda. Em Contatos, selecione os clientes e use &quot;Disparar email&quot;.
          </p>
        ) : (
          <div className="flex flex-col divide-y rounded-xl border bg-card">
            {campaignsQuery.data?.campaigns.map((campaign) => (
              <div key={campaign.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-medium">{campaign.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {new Date(campaign.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                    {" · "}
                    {campaign.subject}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{campaign.sentCount}/{campaign.totalRecipients} enviados</span>
                  {campaign.skippedCount > 0 && <span>{campaign.skippedCount} ignorados</span>}
                  {campaign.failedCount > 0 && <span className="text-destructive">{campaign.failedCount} falhas</span>}
                  <Badge variant={campaign.status === "failed" ? "destructive" : "secondary"}>
                    {CAMPAIGN_STATUS_LABEL[campaign.status] ?? campaign.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
