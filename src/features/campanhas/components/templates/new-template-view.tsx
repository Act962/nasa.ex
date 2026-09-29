"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Sparkles } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useSendingNumbers } from "../../hooks/use-sending-numbers";
import { buildInChatUrl, resolveTemplatePreset } from "../../lib/template-presets";
import { TemplateBuilder } from "./template-builder";

/**
 * Resolve o número de origem (nome) a partir do `trackingId` da URL e monta o
 * builder. Guarda contra `trackingId` inválido/ausente.
 */
export function NewTemplateView({ trackingId, presetId }: { trackingId?: string; presetId?: string }) {
  const { data: numbers, isLoading } = useSendingNumbers();
  const { data: organization, isPending: isOrganizationPending } = authClient.useActiveOrganization();

  if (isLoading || (presetId && isOrganizationPending)) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  const number = numbers?.find((item) => item.trackingId === trackingId);

  if (!trackingId || !number) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
        <p className="font-medium">Selecione um número primeiro</p>
        <p className="max-w-md text-sm text-muted-foreground">
          Escolha o número WhatsApp Oficial (Meta) na tela de Modelos para criar
          um modelo vinculado à conta certa.
        </p>
        <Button asChild variant="outline">
          <Link href="/campanhas/templates">
            <ArrowLeft className="size-4" /> Voltar para Modelos
          </Link>
        </Button>
      </div>
    );
  }

  const inChatUrl =
    organization?.slug && typeof window !== "undefined"
      ? buildInChatUrl(window.location.origin, organization.slug)
      : null;
  const preset = resolveTemplatePreset(presetId, inChatUrl);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
          <Link href={`/campanhas/templates?trackingId=${trackingId}`}>
            <ArrowLeft className="size-4" /> Modelos
          </Link>
        </Button>
        <h1 className="mt-1 text-2xl font-semibold">Novo modelo</h1>
      </div>
      {preset && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-emerald-600" />
          <p>
            Modelo <strong>{preset.label}</strong> já preenchido. Mantenha o texto informativo: oferta, cupom ou
            &quot;renove&quot; fazem a Meta reclassificar como Marketing, que custa bem mais.
          </p>
        </div>
      )}
      <TemplateBuilder trackingId={trackingId} trackingName={number.trackingName} preset={preset} />
    </div>
  );
}
