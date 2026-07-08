"use client";

import { useState } from "react";
import Link from "next/link";
import { LayoutTemplate, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSendingNumbers } from "../../hooks/use-sending-numbers";
import { useTemplates } from "../../hooks/use-templates";
import { languageLabel } from "../../lib/template-constants";
import { TemplateStatusBadge } from "./template-status-badge";

export function TemplatesList({ initialTrackingId }: { initialTrackingId?: string }) {
  const { data: numbers, isLoading: loadingNumbers } = useSendingNumbers();
  const [selected, setSelected] = useState<string | undefined>(initialTrackingId);

  const trackingId = selected ?? numbers?.[0]?.trackingId;
  const { data, isLoading, error } = useTemplates(trackingId);

  const hasNumbers = !!numbers && numbers.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <LayoutTemplate className="size-5" /> Modelos
          </h1>
          <p className="text-sm text-muted-foreground">
            Modelos de marketing aprovados pela Meta para usar nos disparos.
          </p>
        </div>
        {trackingId && (
          <Button asChild>
            <Link href={`/campanhas/templates/new?trackingId=${trackingId}`}>
              <Plus className="size-4" /> Novo modelo
            </Link>
          </Button>
        )}
      </div>

      {hasNumbers && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Número:</span>
          <Select value={trackingId} onValueChange={setSelected}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Selecione um número" />
            </SelectTrigger>
            <SelectContent>
              {numbers?.map((number) => (
                <SelectItem key={number.trackingId} value={number.trackingId}>
                  {number.trackingName}
                  {number.phoneNumber ? ` · ${number.phoneNumber}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {loadingNumbers || (trackingId && isLoading) ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : !hasNumbers ? (
        <EmptyNumbers />
      ) : error ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Não foi possível carregar os modelos deste número.
          <br />
          {error.message}
        </div>
      ) : !data || data.templates.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <LayoutTemplate className="size-8 text-muted-foreground" />
          <div>
            <p className="font-medium">Nenhum modelo ainda</p>
            <p className="text-sm text-muted-foreground">
              Crie seu primeiro modelo de marketing para disparar campanhas.
            </p>
          </div>
          <Button asChild>
            <Link href={`/campanhas/templates/new?trackingId=${trackingId}`}>
              <Plus className="size-4" /> Novo modelo
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.templates.map((template) => (
            <div
              key={template.id}
              className="flex flex-col gap-2 rounded-lg border p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{template.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {languageLabel(template.language)}
                  </p>
                </div>
                <TemplateStatusBadge status={template.status} />
              </div>
              <p className="line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">
                {template.bodyText || "—"}
              </p>
              {template.buttonLabels.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {template.buttonLabels.map((label, index) => (
                    <Badge key={index} variant="outline" className="font-normal">
                      {label}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyNumbers() {
  return (
    <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
      Nenhum número WhatsApp Oficial (Meta) configurado nesta organização. O
      número da API Oficial fica dentro de um{" "}
      <Link href="/tracking" className="font-medium text-foreground underline">
        tracking
      </Link>
      : abra as configurações do tracking → aba{" "}
      <span className="font-medium text-foreground">Integrações</span>, crie uma
      instância escolhendo{" "}
      <span className="font-medium text-foreground">API Oficial</span> e conclua
      com <span className="font-medium text-foreground">Conectar via Meta</span>.
    </div>
  );
}
