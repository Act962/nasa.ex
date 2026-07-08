"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useSendingNumbers } from "../../hooks/use-sending-numbers";
import { TemplateBuilder } from "./template-builder";

/**
 * Resolve o número de origem (nome) a partir do `trackingId` da URL e monta o
 * builder. Guarda contra `trackingId` inválido/ausente.
 */
export function NewTemplateView({ trackingId }: { trackingId?: string }) {
  const { data: numbers, isLoading } = useSendingNumbers();

  if (isLoading) {
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

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
          <Link href={`/campanhas/templates?trackingId=${trackingId}`}>
            <ArrowLeft className="size-4" /> Modelos
          </Link>
        </Button>
        <h1 className="mt-1 text-2xl font-semibold">Novo modelo de marketing</h1>
      </div>
      <TemplateBuilder trackingId={trackingId} trackingName={number.trackingName} />
    </div>
  );
}
