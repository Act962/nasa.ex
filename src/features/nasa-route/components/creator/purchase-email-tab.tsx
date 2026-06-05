"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { toast } from "sonner";
import { Loader2, Mail, Save, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RichtTextEditor } from "@/components/rich-text-editor/editor-lazy";
import { PURCHASE_EMAIL_VARIABLES } from "@/features/nasa-route/lib/purchase-email";

interface PurchaseEmailTabProps {
  courseId: string;
  /** Dados atuais do curso — necessários pra preservar campos não-tocados
   *  aqui no `creatorUpsertCourse` (upsert puro, sem patch parcial). */
  initial: {
    slug: string;
    title: string;
    subtitle: string | null;
    description: string | null;
    coverUrl: string | null;
    trailerUrl: string | null;
    level: string;
    format: string;
    durationMin: number | null;
    priceStars: number;
    categoryId: string | null;
    rewardSpOnComplete: number;
    redirectUrl: string | null;
    pixelId: string | null;
    gtmId: string | null;
    purchaseEmailEnabled: boolean;
    purchaseEmailSubject: string | null;
    purchaseEmailBodyJson: unknown | null;
  };
}

/**
 * Aba "Email pós-compra" do editor de curso.
 *
 * Permite o criador customizar o e-mail enviado ao aluno após a matrícula
 * (compra paga, resgate público pós-signup ou matrícula gratuita). Quando
 * desativado, a plataforma envia um template default dinâmico assinado
 * pela própria org.
 *
 * Variáveis suportadas no assunto e no corpo (placeholders `{{...}}`):
 * studentName, courseTitle, creatorName, orgName, planName, amountBrl,
 * accessUrl, certificateUrl.
 */
export function PurchaseEmailTab({ courseId, initial }: PurchaseEmailTabProps) {
  const qc = useQueryClient();

  const [enabled, setEnabled] = useState(initial.purchaseEmailEnabled);
  const [subject, setSubject] = useState(initial.purchaseEmailSubject ?? "");
  const [bodyField, setBodyField] = useState<string>(
    initial.purchaseEmailBodyJson
      ? typeof initial.purchaseEmailBodyJson === "string"
        ? (initial.purchaseEmailBodyJson as string)
        : JSON.stringify(initial.purchaseEmailBodyJson)
      : "",
  );
  // Forçar remount do RichtTextEditor quando o usuário inserir uma variável
  // via chip (o editor é uncontrolled depois de montado).
  const [editorKey, setEditorKey] = useState(0);

  const upsert = useMutation({
    ...orpc.nasaRoute.creatorUpsertCourse.mutationOptions(),
    onSuccess: () => {
      toast.success("E-mail de pós-compra salvo!");
      qc.invalidateQueries({
        queryKey: orpc.nasaRoute.creatorGetCourse.queryKey({
          input: { courseId },
        }),
      });
    },
    onError: (err: any) =>
      toast.error(err?.message ?? "Falha ao salvar o e-mail."),
  });

  const sendTest = useMutation({
    ...orpc.nasaRoute.creatorSendTestPurchaseEmail.mutationOptions(),
    onSuccess: (res) => {
      toast.success(`E-mail de teste enviado para ${res.to}`);
    },
    onError: (err: any) =>
      toast.error(err?.message ?? "Falha ao enviar e-mail de teste."),
  });

  function parsedBodyJson(): unknown | null {
    if (!bodyField.trim()) return null;
    try {
      return JSON.parse(bodyField);
    } catch {
      return null;
    }
  }

  function insertVariable(key: string) {
    const placeholder = `{{${key}}}`;

    // Inserir no body: como o RichtTextEditor é uncontrolled após o mount,
    // a abordagem mais simples sem refs externos é anexar como um novo
    // parágrafo ao JSON e remontar o editor com a nova `field`.
    let json: any;
    try {
      json = bodyField ? JSON.parse(bodyField) : null;
    } catch {
      json = null;
    }
    if (!json || typeof json !== "object") {
      json = { type: "doc", content: [] };
    }
    if (!Array.isArray(json.content)) {
      json.content = [];
    }
    json.content.push({
      type: "paragraph",
      content: [{ type: "text", text: placeholder }],
    });
    setBodyField(JSON.stringify(json));
    setEditorKey((k) => k + 1);
  }

  function handleSave() {
    upsert.mutate({
      id: courseId,
      slug: initial.slug,
      title: initial.title,
      subtitle: initial.subtitle,
      description: initial.description,
      coverUrl: initial.coverUrl,
      trailerUrl: initial.trailerUrl,
      level: initial.level as "beginner" | "intermediate" | "advanced",
      format: initial.format as any,
      durationMin: initial.durationMin,
      priceStars: initial.priceStars,
      categoryId: initial.categoryId,
      rewardSpOnComplete: initial.rewardSpOnComplete,
      redirectUrl: initial.redirectUrl,
      pixelId: initial.pixelId,
      gtmId: initial.gtmId,
      purchaseEmailEnabled: enabled,
      purchaseEmailSubject: subject.trim() || null,
      purchaseEmailBodyJson: parsedBodyJson(),
    });
  }

  function handleSendTest() {
    sendTest.mutate({
      courseId,
      purchaseEmailEnabled: enabled,
      purchaseEmailSubject: subject.trim() || null,
      purchaseEmailBodyJson: parsedBodyJson(),
    });
  }

  return (
    <div className="space-y-6">
      {/* ── Toggle ──────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Mail className="size-4 text-violet-600" />
              <h3 className="text-sm font-semibold">
                Personalizar e-mail de boas-vindas
              </h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Quando ativado, o aluno recebe o e-mail customizado abaixo logo
              após a matrícula. Quando desativado, enviamos um template
              padrão dinâmico assinado pela sua empresa.
            </p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>
      </div>

      {/* ── Editor ──────────────────────────────────────────── */}
      <div
        className={`rounded-2xl border border-border bg-card p-5 space-y-4 ${enabled ? "" : "opacity-60 pointer-events-none"}`}
      >
        <div className="space-y-1.5">
          <Label htmlFor="purchase-email-subject" className="text-xs">
            Assunto do e-mail
          </Label>
          <Input
            id="purchase-email-subject"
            placeholder="Bem-vindo(a) ao curso {{courseTitle}}!"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={!enabled}
          />
          <p className="text-[11px] text-muted-foreground">
            Vazio = usa o assunto padrão "Bem-vindo(a) ao curso &lt;nome&gt;".
          </p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Corpo do e-mail</Label>
          <RichtTextEditor
            key={editorKey}
            field={bodyField}
            onChange={setBodyField}
            disabled={!enabled}
            placeholder="Olá {{studentName}}, sua matrícula em {{courseTitle}} foi confirmada..."
          />
        </div>

        <div className="space-y-2 rounded-xl bg-muted/40 p-3">
          <p className="text-xs font-medium text-muted-foreground">
            Variáveis disponíveis — clique para inserir no corpo:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {PURCHASE_EMAIL_VARIABLES.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => insertVariable(v.key)}
                disabled={!enabled}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] font-mono hover:border-violet-500 hover:text-violet-600 disabled:opacity-50"
                title={v.label}
              >
                {`{{${v.key}}}`}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          variant="outline"
          onClick={handleSendTest}
          disabled={sendTest.isPending}
          className="gap-1.5"
        >
          {sendTest.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          Enviar teste para mim
        </Button>
        <Button
          onClick={handleSave}
          disabled={upsert.isPending}
          className="gap-1.5"
        >
          {upsert.isPending && <Loader2 className="size-4 animate-spin" />}
          <Save className="size-4" />
          Salvar
        </Button>
      </div>
    </div>
  );
}
