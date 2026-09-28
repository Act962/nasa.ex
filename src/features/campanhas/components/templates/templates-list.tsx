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
import { PageHeader } from "../page-header";
import { TemplateStatusBadge } from "./template-status-badge";

export function TemplatesList({ initialTrackingId }: { initialTrackingId?: string }) {
  const { data: numbers, isLoading: loadingNumbers } = useSendingNumbers();
  const [selected, setSelected] = useState<string | undefined>(initialTrackingId);

  const trackingId = selected ?? numbers?.[0]?.trackingId;
  const { data, isLoading, error } = useTemplates(trackingId);

  const hasNumbers = !!numbers && numbers.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={LayoutTemplate}
        title="Modelos"
        description="Templates de marketing e utilidade aprovados pela Meta."
        action={
          trackingId ? (
            <Button asChild>
              <Link href={`/campanhas/templates/new?trackingId=${trackingId}`}>
                <Plus className="size-4" /> Novo modelo
              </Link>
            </Button>
          ) : undefined
        }
      />

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
              Crie seu primeiro modelo de marketing ou utilidade para disparar
              campanhas.
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
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{template.name}</p>
                    <CategoryBadge category={template.category} />
                  </div>
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

function CategoryBadge({ category }: { category: string }) {
  const label =
    category === "MARKETING"
      ? "Marketing"
      : category === "UTILITY"
        ? "Utilidade"
        : category === "AUTHENTICATION"
          ? "Autenticação"
          : category;
  const className =
    category === "UTILITY"
      ? "border-0 bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
      : "border-0 bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300";
  return (
    <Badge className={`shrink-0 text-[10px] ${className}`}>{label}</Badge>
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
