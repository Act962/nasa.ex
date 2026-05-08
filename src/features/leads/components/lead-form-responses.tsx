"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format, formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ChevronDown,
  ChevronRight,
  ClipboardList,
  ExternalLink,
  EyeIcon,
  Loader,
  SquarePenIcon,
} from "lucide-react";
import { orpc } from "@/lib/orpc";
import { CreateForm } from "@/features/form/components/create-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemHeader,
  ItemTitle,
} from "@/components/ui/item";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";

type ResponseEntry = {
  id: string;
  createdAt: Date | string;
  jsonResponse: unknown;
  form: { id: string; name: string };
};

const SYSTEM_KEYS = new Set(["user_name", "user_email", "user_phone"]);

function parseResponse(json: unknown): Record<string, unknown> {
  if (!json) return {};
  if (typeof json === "string") {
    try {
      return JSON.parse(json) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (typeof json === "object") return json as Record<string, unknown>;
  return {};
}

function renderValue(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string") return value || "-";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object") {
    const v = value as { value?: unknown; responseValue?: unknown };
    if (v.value !== undefined) return renderValue(v.value);
    if (v.responseValue !== undefined) return renderValue(v.responseValue);
    try {
      return JSON.stringify(value);
    } catch {
      return "—";
    }
  }
  return String(value);
}

type FormGroup = {
  formId: string;
  formName: string;
  createdAt: Date;
  published?: boolean;
  responses: ResponseEntry[];
  lastAt: Date | null;
  firstAt: Date | null;
};

function indexByForm(
  responses: ResponseEntry[],
): Map<string, ResponseEntry[]> {
  const map = new Map<string, ResponseEntry[]>();
  for (const r of responses) {
    const list = map.get(r.form.id);
    if (list) list.push(r);
    else map.set(r.form.id, [r]);
  }
  return map;
}

type OrgForm = {
  id: string;
  name: string;
  createdAt: Date | string;
  published?: boolean;
};

function buildGroups(
  forms: OrgForm[],
  responsesByForm: Map<string, ResponseEntry[]>,
): FormGroup[] {
  const groups: FormGroup[] = forms.map((f) => {
    const respList = responsesByForm.get(f.id) ?? [];
    let lastAt: Date | null = null;
    let firstAt: Date | null = null;
    for (const r of respList) {
      const t = new Date(r.createdAt);
      if (!lastAt || t > lastAt) lastAt = t;
      if (!firstAt || t < firstAt) firstAt = t;
    }
    return {
      formId: f.id,
      formName: f.name,
      createdAt: new Date(f.createdAt),
      published: f.published,
      responses: respList,
      lastAt,
      firstAt,
    };
  });
  // Ordena: forms com respostas (mais recentes primeiro), depois forms sem
  // respostas (mais novos primeiro).
  groups.sort((a, b) => {
    if (a.responses.length && b.responses.length) {
      return (b.lastAt!.getTime()) - (a.lastAt!.getTime());
    }
    if (a.responses.length) return -1;
    if (b.responses.length) return 1;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
  return groups;
}

export function LeadFormResponses({
  leadId,
  trackingId,
  statusId,
}: {
  leadId: string;
  trackingId?: string;
  statusId?: string;
}) {
  const { data: respData, isLoading: respLoading } = useQuery(
    orpc.leads.listFormResponses.queryOptions({ input: { leadId } }),
  );

  const { data: formsData, isLoading: formsLoading } = useQuery(
    orpc.form.list.queryOptions({ input: {} }),
  );

  const isLoading = respLoading || formsLoading;

  const generateLink = useMutation(
    orpc.leads.generatePublicLink.mutationOptions({}),
  );

  function openWithPrefill(formId: string) {
    generateLink.mutate(
      { leadId, rotate: false },
      {
        onSuccess: (res) => {
          const token = (res as { token: string }).token;
          window.open(
            `${window.location.origin}/submit-form/${formId}?leadToken=${encodeURIComponent(token)}`,
            "_blank",
            "noopener,noreferrer",
          );
        },
        onError: () => toast.error("Falha ao gerar link com dados do lead"),
      },
    );
  }

  const responses = useMemo(
    () => (respData?.responses as ResponseEntry[]) ?? [],
    [respData?.responses],
  );

  const orgForms = useMemo(
    () => (formsData?.forms as OrgForm[]) ?? [],
    [formsData?.forms],
  );

  const responsesByForm = useMemo(
    () => indexByForm(responses),
    [responses],
  );

  const groups = useMemo(
    () => buildGroups(orgForms, responsesByForm),
    [orgForms, responsesByForm],
  );

  // Stats só consideram forms que o lead respondeu (Total Forms = únicos).
  const totalForms = useMemo(
    () => groups.filter((g) => g.responses.length > 0).length,
    [groups],
  );
  const totalResponses = responses.length;

  const lastAt = useMemo(() => {
    if (!responses.length) return null;
    let max = 0;
    for (const r of responses) {
      const t = new Date(r.createdAt).getTime();
      if (t > max) max = t;
    }
    return max ? new Date(max) : null;
  }, [responses]);

  const firstAt = useMemo(() => {
    if (!responses.length) return null;
    let min = Infinity;
    for (const r of responses) {
      const t = new Date(r.createdAt).getTime();
      if (t < min) min = t;
    }
    return Number.isFinite(min) ? new Date(min) : null;
  }, [responses]);

  return (
    <div className="w-full h-full flex flex-col min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        <section className="w-full">
          <div className="w-full flex items-center justify-between py-2">
            <h2 className="text-2xl font-semibold tracking-tight">
              Formulários do lead
            </h2>
            <CreateForm
              trackingId={trackingId}
              statusId={statusId}
              defaultName={`Formulário do lead`}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
            <StatsCard
              title="Total Forms"
              value={totalForms}
              description="Formulários respondidos por este lead"
              isLoading={isLoading}
            />
            <StatsCard
              title="Total de respostas"
              value={totalResponses}
              description="Respostas enviadas por este lead"
              isLoading={isLoading}
            />
            <StatsCard
              title="Primeira resposta"
              value={firstAt ? format(firstAt, "dd/MM/yyyy") : "—"}
              description={
                firstAt
                  ? formatDistanceToNowStrict(firstAt, {
                      addSuffix: true,
                      locale: ptBR,
                    })
                  : "Sem respostas ainda"
              }
              isLoading={isLoading}
              compact
            />
            <StatsCard
              title="Última resposta"
              value={lastAt ? format(lastAt, "dd/MM/yyyy") : "—"}
              description={
                lastAt
                  ? formatDistanceToNowStrict(lastAt, {
                      addSuffix: true,
                      locale: ptBR,
                    })
                  : "Sem respostas ainda"
              }
              isLoading={isLoading}
              compact
            />
          </div>
        </section>

        <div className="mt-8">
          <Separator />
        </div>

        <section className="w-full pt-6 pb-8">
          <div className="w-full flex items-center mb-4">
            <h5 className="text-xl font-semibold tracking-tight">
              Todos os forms
            </h5>
          </div>

          {isLoading && (
            <div className="flex flex-col gap-2">
              <Skeleton className="w-full h-16" />
              <Skeleton className="w-full h-16" />
            </div>
          )}

          {!isLoading && groups.length > 0 && (
            <div className="flex flex-col gap-2">
              {groups.map((g) => (
                <FormGroupItem
                  key={g.formId}
                  group={g}
                  onOpenWithPrefill={() => openWithPrefill(g.formId)}
                  prefillLoading={generateLink.isPending}
                />
              ))}
            </div>
          )}

          {!isLoading && groups.length === 0 && (
            <Empty className="w-full">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <SquarePenIcon />
                </EmptyMedia>
                <EmptyTitle>Nenhum formulário criado</EmptyTitle>
                <EmptyDescription>
                  Crie um formulário pra começar a coletar respostas vinculadas
                  a este lead.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </section>
      </div>
    </div>
  );
}

function StatsCard({
  title,
  value,
  description,
  isLoading,
  compact = false,
}: {
  title: string;
  value: number | string;
  description: string;
  isLoading?: boolean;
  compact?: boolean;
}) {
  return (
    <Card className="bg-accent/10">
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className={compact ? "text-2xl" : "text-4xl"}>
          {isLoading ? <Loader className="h-[36px] animate-spin" /> : value}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-xs text-muted-foreground">{description}</div>
      </CardContent>
    </Card>
  );
}

function FormGroupItem({
  group,
  onOpenWithPrefill,
  prefillLoading,
}: {
  group: FormGroup;
  onOpenWithPrefill: () => void;
  prefillLoading?: boolean;
}) {
  const router = useRouter();
  const hasResponses = group.responses.length > 0;
  const [expanded, setExpanded] = useState(false);

  function toggle() {
    if (hasResponses) setExpanded((v) => !v);
  }

  return (
    <div className="flex flex-col gap-2">
      <Item
        role="button"
        className={`w-full hover:bg-foreground/10 transition-colors ${
          hasResponses ? "cursor-pointer" : "cursor-default"
        }`}
        variant="outline"
        onClick={toggle}
      >
        <ItemContent className="flex-row">
          <ItemHeader className="flex flex-col items-start gap-2">
            <ItemTitle className="flex items-center gap-2">
              {hasResponses ? (
                expanded ? (
                  <ChevronDown className="size-4 shrink-0" />
                ) : (
                  <ChevronRight className="size-4 shrink-0" />
                )
              ) : (
                <SquarePenIcon className="size-4 shrink-0 text-muted-foreground/60" />
              )}
              {group.formName}
            </ItemTitle>
            <ItemDescription className="text-muted-foreground">
              <span>
                {hasResponses && group.lastAt
                  ? `${formatDistanceToNowStrict(group.lastAt, {
                      addSuffix: true,
                      locale: ptBR,
                    })} • ${group.responses.length} ${
                      group.responses.length === 1 ? "resposta" : "respostas"
                    }`
                  : `criado ${formatDistanceToNowStrict(group.createdAt, {
                      addSuffix: true,
                      locale: ptBR,
                    })} • sem respostas deste lead`}
              </span>
            </ItemDescription>
          </ItemHeader>
        </ItemContent>

        <ItemActions onClick={(e) => e.stopPropagation()}>
          <Button
            size="icon-sm"
            variant="outline"
            onClick={onOpenWithPrefill}
            disabled={prefillLoading}
            title="Abrir formulário com dados do lead pré-preenchidos"
          >
            <ExternalLink />
          </Button>
          <Button
            size="icon-sm"
            variant="outline"
            onClick={() => router.push(`/form/responses/${group.formId}`)}
            title="Ver todas as respostas"
          >
            <EyeIcon />
          </Button>
          <Button
            size="icon-sm"
            variant="outline"
            onClick={() => router.push(`/form/builder/${group.formId}`)}
            title="Editar formulário"
          >
            <SquarePenIcon />
          </Button>
        </ItemActions>
      </Item>

      {expanded && (
        <div className="pl-6 flex flex-col gap-3">
          {group.responses
            .slice()
            .sort(
              (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime(),
            )
            .map((resp) => (
              <ResponseCard key={resp.id} response={resp} />
            ))}
        </div>
      )}
    </div>
  );
}

function ResponseCard({ response }: { response: ResponseEntry }) {
  const parsed = parseResponse(response.jsonResponse);
  const entries = Object.entries(parsed).filter(
    ([key]) => !SYSTEM_KEYS.has(key),
  );
  return (
    <Card className="bg-foreground/5 border-foreground/10">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-foreground/10">
          <span className="text-xs font-medium flex items-center gap-2">
            <ClipboardList className="w-3.5 h-3.5" />
            Resposta
          </span>
          <span className="text-xs text-muted-foreground">
            {format(new Date(response.createdAt), "dd/MM/yyyy HH:mm", {
              locale: ptBR,
            })}
          </span>
        </div>
        <div className="space-y-3">
          {entries.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Resposta sem campos preenchidos.
            </p>
          ) : (
            entries.map(([key, value]) => (
              <div key={key} className="flex flex-col">
                <span className="text-[10px] font-semibold text-foreground/70 uppercase tracking-wider">
                  {key}
                </span>
                <span className="text-sm text-foreground break-words whitespace-pre-line">
                  {renderValue(value)}
                </span>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
