"use client";

import { useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { format, formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import {
  EyeIcon,
  Link2,
  Loader,
  PencilLine,
  SquarePenIcon,
} from "lucide-react";
import { orpc } from "@/lib/orpc";
import { CreateForm } from "@/features/form/components/create-form";
import { buildResponseSlug } from "@/features/form/lib/response-slug";
import { useQueryLead } from "@/features/leads/hooks/use-lead";
import { useConstructUrl } from "@/hooks/use-construct-url";
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

  // Status atual + responsável do lead — exibidos como contexto em cada item
  // de form preenchido na seção "Todos os forms".
  const { data: leadData } = useQueryLead(leadId);
  const leadStatus = (leadData as { lead?: { status?: { name?: string; color?: string } } } | undefined)
    ?.lead?.status;
  const leadResponsible = (leadData as {
    lead?: { responsible?: { id?: string; name?: string; image?: string | null } };
  } | undefined)?.lead?.responsible;

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
                  leadId={leadId}
                  leadStatus={leadStatus}
                  leadResponsible={leadResponsible}
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
  leadId,
  leadStatus,
  leadResponsible,
}: {
  group: FormGroup;
  leadId: string;
  leadStatus?: { name?: string; color?: string };
  leadResponsible?: { id?: string; name?: string; image?: string | null };
}) {
  const router = useRouter();
  const hasResponses = group.responses.length > 0;
  const responsibleAvatar = useConstructUrl(leadResponsible?.image || "");

  // "Ver/continuar preenchimento" abre a resposta MAIS RECENTE em modo edit.
  const latestResponse = group.responses[0];
  function openLatestResponse() {
    if (!latestResponse) return;
    const slug = buildResponseSlug(group.formName, latestResponse.createdAt);
    router.push(`/formulario/${slug}/${latestResponse.id}`);
  }

  // "Preencher" — pra forms que o lead ainda NÃO respondeu. Abre o consultor
  // num form novo já amarrado ao lead.
  function startNewResponse() {
    router.push(`/formulario/novo/${group.formId}/${leadId}`);
  }

  // "Link visualização cliente" — gera (ou reusa) o publicToken do lead e
  // copia a URL `/lead/<token>/formulario/<responseId>` pro clipboard.
  // Cliente vê o form em modo read-only e só pode assinar a SignatureClient.
  const generateLink = useMutation(
    orpc.leads.generatePublicLink.mutationOptions({}),
  );
  function copyClientFormLink() {
    if (!latestResponse) return;
    generateLink.mutate(
      { leadId, rotate: false },
      {
        onSuccess: (res) => {
          const r = res as { token?: string };
          if (!r.token) {
            toast.error("Não foi possível gerar o link");
            return;
          }
          const url = `${window.location.origin}/lead/${r.token}/formulario/${latestResponse.id}`;
          navigator.clipboard
            .writeText(url)
            .then(() =>
              toast.success("Link de visualização do cliente copiado!"),
            )
            .catch(() => toast.info(url));
        },
        onError: () => toast.error("Falha ao gerar link do cliente"),
      },
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Item
        className="w-full hover:bg-foreground/10 transition-colors cursor-default"
        variant="outline"
      >
        <ItemContent className="flex-row">
          <ItemHeader className="flex flex-col items-start gap-2">
            <ItemTitle className="flex items-center gap-2 flex-wrap">
              {!hasResponses && (
                <SquarePenIcon className="size-4 shrink-0 text-muted-foreground/60" />
              )}
              <span>{group.formName}</span>

              {/* Badge do status atual do lead — só pra forms já preenchidos. */}
              {hasResponses && leadStatus?.name && (
                <span
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-medium"
                  style={{
                    borderColor: leadStatus.color || undefined,
                    color: leadStatus.color || undefined,
                    background: leadStatus.color
                      ? `${leadStatus.color}15`
                      : undefined,
                  }}
                  title="Status atual do lead"
                >
                  <span
                    className="inline-block size-1.5 rounded-full"
                    style={{ background: leadStatus.color || "#888" }}
                  />
                  {leadStatus.name}
                </span>
              )}

              {/* Responsável pela etapa atual — só pra forms preenchidos. */}
              {hasResponses && leadResponsible?.name && (
                <span
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-foreground/10 bg-foreground/5 text-[10px] text-muted-foreground"
                  title={`Responsável: ${leadResponsible.name}`}
                >
                  {leadResponsible.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={responsibleAvatar}
                      alt={leadResponsible.name}
                      className="size-3.5 rounded-full object-cover"
                    />
                  ) : (
                    <span className="size-3.5 rounded-full bg-foreground/15 flex items-center justify-center text-[8px] font-semibold">
                      {leadResponsible.name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  {leadResponsible.name}
                </span>
              )}
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
          {/* Form ainda não preenchido por este lead → consultor inicia
              um preenchimento em nome do lead (`/formulario/novo/...`). */}
          {!hasResponses && (
            <Button
              size="sm"
              variant="default"
              onClick={startNewResponse}
              title="Preencher formulário em nome do lead"
            >
              <PencilLine className="size-4" />
              Preencher
            </Button>
          )}

          {/* Form com respostas → abre a mais recente em modo edit pra
              continuar/conferir o preenchimento. */}
          {hasResponses && (
            <>
              <Button
                size="icon-sm"
                variant="outline"
                onClick={openLatestResponse}
                title="Ver/continuar preenchimento"
              >
                <EyeIcon />
              </Button>
              <Button
                size="icon-sm"
                variant="outline"
                onClick={copyClientFormLink}
                disabled={generateLink.isPending}
                title="Link de visualização do cliente (read-only, com assinatura)"
              >
                <Link2 />
              </Button>
            </>
          )}
        </ItemActions>
      </Item>
    </div>
  );
}

