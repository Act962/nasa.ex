"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { toast } from "sonner";
import {
  ExternalLink,
  Facebook,
  Loader2,
  Save,
  Tag,
  Link as LinkIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CopyLinkWithUtm } from "@/components/ui/copy-link-with-utm";

interface IntegrationsTabProps {
  courseId: string;
  /** Dados atuais do curso vindos do `creatorGetCourse` (necessários
   *  pra preservar campos não-tocados aqui no `creatorUpsertCourse`,
   *  já que o upsert exige todos os fields obrigatórios). */
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
  };
  /** Slug da org criadora (pra montar `baseUrl` do link UTM público). */
  companySlug: string;
  /** Slug do curso (pra montar `baseUrl`). */
  courseSlug: string;
}

/**
 * Aba "Integrações" do editor de curso — espelho da feature equivalente
 * no editor de Forms.
 *
 * Campos:
 *  - URL de redirecionamento (pós-checkout)
 *  - ID do Facebook Pixel
 *  - ID do Google Tag Manager
 *  - Botão "Link com UTM" pra gerar URL de divulgação com `utm_source`,
 *    `utm_medium`, `utm_campaign`, `utm_content` (componente reusado
 *    de `@/components/ui/copy-link-with-utm`).
 *
 * Os IDs de tracking são injetados na página pública `/c/<slug>` via
 * `<Script>` do Next.js — disparam PageView automático + eventos de
 * compra. Compras também são logadas no Insights (NASA Route) via
 * `logActivity({ appSlug: "nasa-route" })`.
 */
export function IntegrationsTab({
  courseId,
  initial,
  companySlug,
  courseSlug,
}: IntegrationsTabProps) {
  const qc = useQueryClient();
  const [redirectUrl, setRedirectUrl] = useState(initial.redirectUrl ?? "");
  const [pixelId, setPixelId] = useState(initial.pixelId ?? "");
  const [gtmId, setGtmId] = useState(initial.gtmId ?? "");

  const upsert = useMutation({
    ...orpc.nasaRoute.creatorUpsertCourse.mutationOptions(),
    onSuccess: () => {
      toast.success("Integrações salvas!");
      qc.invalidateQueries({
        queryKey: orpc.nasaRoute.creatorGetCourse.queryKey({
          input: { courseId },
        }),
      });
    },
    onError: (err: any) =>
      toast.error(err?.message ?? "Falha ao salvar integrações."),
  });

  function handleSave() {
    // Replica TODOS os campos obrigatórios do curso pra não zerar nada
    // (o procedure usa upsert puro, sem patch parcial).
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
      // Campos novos desta aba
      redirectUrl: redirectUrl.trim() || null,
      pixelId: pixelId.trim() || null,
      gtmId: gtmId.trim() || null,
    });
  }

  const publicUrl = `/c/${companySlug}/${courseSlug}`;

  return (
    <div className="space-y-6">
      {/* ── URL de redirecionamento ─────────────────────────── */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <ExternalLink className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">URL de redirecionamento</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Para onde o aluno é redirecionado depois de comprar o curso. Use
          uma página de obrigado/agradecimento ou checkout próprio.
        </p>
        <Input
          type="url"
          placeholder="https://seusite.com/obrigado"
          value={redirectUrl}
          onChange={(e) => setRedirectUrl(e.target.value)}
        />
        <p className="text-[11px] text-muted-foreground">
          Vazio = o aluno fica na página do curso após comprar.
        </p>
      </div>

      {/* ── Facebook Pixel ─────────────────────────────────── */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Facebook className="size-4 text-blue-600" />
          <h3 className="text-sm font-semibold">Facebook Pixel</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          ID do Pixel da Meta — rastreia visualizações de página, leads e
          compras automaticamente. Encontre em{" "}
          <a
            href="https://business.facebook.com/events_manager"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline"
          >
            Events Manager
          </a>
          .
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="pixel-id" className="text-xs">
            ID do Pixel
          </Label>
          <Input
            id="pixel-id"
            placeholder="123456789012345"
            value={pixelId}
            onChange={(e) => setPixelId(e.target.value)}
          />
        </div>
      </div>

      {/* ── Google Tag Manager ─────────────────────────────── */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Tag className="size-4 text-emerald-600" />
          <h3 className="text-sm font-semibold">Google Tag Manager</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          ID do container GTM — permite gerenciar tags de Google Ads,
          Analytics e outras integrações sem mexer no código.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="gtm-id" className="text-xs">
            ID do Container
          </Label>
          <Input
            id="gtm-id"
            placeholder="GTM-XXXXXXX"
            value={gtmId}
            onChange={(e) => setGtmId(e.target.value)}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={upsert.isPending} className="gap-1.5">
          {upsert.isPending && <Loader2 className="size-4 animate-spin" />}
          <Save className="size-4" />
          Salvar integrações
        </Button>
      </div>

      {/* ── Link com UTM ───────────────────────────────────── */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <LinkIcon className="size-4 text-violet-600" />
          <h3 className="text-sm font-semibold">Link com UTM</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Gere variantes do link público do curso com parâmetros UTM —
          rastreáveis no Insights da NASA Route, Google Analytics e Meta
          Pixel. Útil pra mensurar campanhas de cada canal (Instagram,
          E-mail, WhatsApp, etc).
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Input value={publicUrl} readOnly className="flex-1 text-xs" />
          <CopyLinkWithUtm baseUrl={publicUrl} size="sm" />
        </div>
      </div>
    </div>
  );
}
