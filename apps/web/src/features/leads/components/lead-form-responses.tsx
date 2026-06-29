"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { format, formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowRight,
  Loader,
  MoreVertical,
  PencilLine,
  RotateCcw,
  SquarePenIcon,
  Timer,
} from "lucide-react";
import { toast } from "sonner";
import { orpc } from "@/lib/orpc";
import { useOrgRole } from "@/hooks/use-org-role";
import { authClient } from "@/lib/auth-client";
import { useQueryParticipants } from "@/features/trackings/hooks/use-trackings";
import { useMutationCancelFormResponse } from "@/features/form/hooks/use-cancel-response";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatTimeUntil } from "@/features/form/lib/extract-deadline";
import {
  STATE_COLOR,
  STATE_LABEL,
  type FormResponseState,
} from "@/features/form/lib/form-response-state";
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
  label: string | null;
  state: FormResponseState;
  /**
   * Prazo do form quando algum DatePicker do form é marcado com
   * `useAsDeadline=true` e foi preenchido. ISO string ou null.
   */
  deadline?: string | null;
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
  lastLabel: string | null;
  lastState: FormResponseState | null;
  /** Prazo da última resposta (se houver). Usado no countdown. */
  lastDeadline: Date | null;
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
    let lastResponse: ResponseEntry | null = null;
    for (const r of respList) {
      const t = new Date(r.createdAt);
      if (!lastAt || t > lastAt) {
        lastAt = t;
        lastResponse = r;
      }
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
      lastLabel: lastResponse?.label ?? null,
      lastState: lastResponse?.state ?? null,
      lastDeadline: lastResponse?.deadline
        ? new Date(lastResponse.deadline)
        : null,
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
}: {
  leadId: string;
  trackingId: string;
}) {
  // Permissão pra "Cancelar formulário": Master (org owner) OU Tracking
  // Owner do tracking atual do lead. Backend revalida — UI só esconde o
  // item de menu pra quem não tem permissão.
  const { isMaster } = useOrgRole();
  const { data: session } = authClient.useSession();
  const { participants } = useQueryParticipants({ trackingId });
  const isTrackingOwner =
    participants.find((p: any) => p.userId === session?.user?.id)?.role ===
    "OWNER";
  const canCancel = isMaster || isTrackingOwner;
  const { data: respData, isLoading: respLoading } = useQuery(
    orpc.leads.listFormResponses.queryOptions({ input: { leadId } }),
  );

  const { data: formsData, isLoading: formsLoading } = useQuery(
    orpc.form.list.queryOptions({ input: {} }),
  );

  const isLoading = respLoading || formsLoading;

  // O contexto do lead (status/responsável) deixou de aparecer aqui — agora
  // o card é puramente de listagem de forms; quem mostra esse contexto é a
  // página dedicada `/contatos/<leadId>/formularios/<formId>`.

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
            {/* Botão "Criar formulário" removido daqui — criação de form é
                fluxo global, não pertence ao detalhe do lead. Lead continua
                preenchendo forms via "Preencher" na listagem abaixo. */}
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
                  canCancel={canCancel}
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
  canCancel,
}: {
  group: FormGroup;
  leadId: string;
  /**
   * Se o usuário pode cancelar a resposta deste form (Master da org ou
   * Owner do tracking atual do lead). Backend revalida.
   */
  canCancel: boolean;
}) {
  const router = useRouter();
  const hasResponses = group.responses.length > 0;
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const cancelMutation = useMutationCancelFormResponse(leadId);

  // Última resposta = alvo do reset. `responses` vem ordenada por
  // createdAt desc do server, mas pegamos via `lastResponseId` computado
  // a partir do `lastAt` pra ser explícito.
  const lastResponseId = useMemo(() => {
    if (!group.responses.length) return null;
    let lastId: string | null = null;
    let lastTime = 0;
    for (const r of group.responses) {
      const t = new Date(r.createdAt).getTime();
      if (t > lastTime) {
        lastTime = t;
        lastId = r.id;
      }
    }
    return lastId;
  }, [group.responses]);

  function handleConfirmCancel() {
    if (!lastResponseId) return;
    cancelMutation.mutate(
      { id: lastResponseId },
      {
        onSuccess: () => {
          toast.success("Formulário cancelado e removido do card do lead.");
          setCancelDialogOpen(false);
        },
        onError: (err: any) => {
          toast.error(
            err?.message ?? "Erro ao cancelar formulário. Tente novamente.",
          );
        },
      },
    );
  }

  // Countdown ao vivo do prazo (se houver). Atualiza a cada 1s pra mostrar
  // segundos rolando quando faltam menos de 24h. Acima de 24h o componente
  // formata como "Xd Yh Zm" (sem segundos), então 1s/tick é overkill — mas
  // o custo é desprezível e mantém o código simples.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!group.lastDeadline) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [group.lastDeadline]);
  // `now` é referenciada implicitamente via Date.now() em formatTimeUntil,
  // mas a função usa Date.now() interno. Garantimos o re-render via tick.
  void now;
  const deadlineInfo = formatTimeUntil(group.lastDeadline);

  // "Abrir" → página dedicada que lista todas as respostas deste form pra
  // este lead, com botão "Preencher novo" e edição inline do título.
  function openFormPage() {
    router.push(`/contatos/${leadId}/formularios/${group.formId}`);
  }

  // "Preencher" — atalho pra forms ainda sem nenhuma resposta. Vai direto
  // pro editor; a row de FormResponses só nasce no submit.
  function startNewResponse() {
    router.push(`/formulario/novo/${group.formId}/${leadId}`);
  }

  // Cor + label do estado da última resposta (5 estados: empty/in_progress/
  // waiting_client_signature/stale/complete). Vira badge ao lado do nome.
  const stateColor = group.lastState ? STATE_COLOR[group.lastState] : null;
  const stateLabel = group.lastState ? STATE_LABEL[group.lastState] : null;

  return (
    <div className="flex flex-col gap-2">
      <Item
        className="w-full hover:bg-foreground/10 transition-colors cursor-pointer"
        variant="outline"
        onClick={hasResponses ? openFormPage : undefined}
      >
        <ItemContent className="flex-row">
          <ItemHeader className="flex flex-col items-start gap-2">
            <ItemTitle className="flex items-center gap-2 flex-wrap">
              {!hasResponses && (
                <SquarePenIcon className="size-4 shrink-0 text-muted-foreground/60" />
              )}
              <span>
                {group.formName}
                {group.lastLabel && (
                  <span className="text-muted-foreground font-normal">
                    {" · "}
                    {group.lastLabel}
                  </span>
                )}
              </span>

              {/* Badge de estado da última resposta */}
              {hasResponses && stateColor && stateLabel && (
                <span
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-medium"
                  style={{
                    borderColor: stateColor,
                    color: stateColor === "#ffffff" ? "#475569" : stateColor,
                    background:
                      stateColor === "#ffffff"
                        ? "#f1f5f9"
                        : `${stateColor}15`,
                  }}
                  title={stateLabel}
                >
                  <span
                    className="inline-block size-1.5 rounded-full"
                    style={{ background: stateColor }}
                  />
                  {stateLabel}
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
          {/* Countdown do prazo — só aparece quando algum DatePicker do
              form foi marcado com `useAsDeadline=true` E o campo foi
              preenchido. 4 tiers de cor:
                verde   ≥3 dias
                amarelo entre 24h e 3 dias
                laranja ≤24h
                vermelho atrasado */}
          {deadlineInfo && (
            <span
              className={
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium tabular-nums whitespace-nowrap " +
                {
                  safe: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
                  warning:
                    "border-yellow-300 bg-yellow-50 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-300",
                  urgent:
                    "border-orange-300 bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
                  expired:
                    "border-red-300 bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300",
                }[deadlineInfo.tier]
              }
              title={`Prazo: ${group.lastDeadline?.toLocaleString("pt-BR")}`}
            >
              <Timer className="size-3" />
              {deadlineInfo.label}
            </span>
          )}

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

          {/* Form com respostas → abre a página dedicada que lista todas
              as respostas e permite preencher uma nova. */}
          {hasResponses && (
            <Button
              size="sm"
              variant="outline"
              onClick={openFormPage}
              title="Ver respostas deste formulário"
            >
              Abrir
              <ArrowRight className="size-4" />
            </Button>
          )}

          {/* Menu de ações destrutivas — só aparece pra Master da org OU
              Tracking Owner E quando há uma resposta pra resetar. */}
          {hasResponses && canCancel && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  title="Mais ações"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                onClick={(e) => e.stopPropagation()}
              >
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={(e) => {
                    e.preventDefault();
                    setCancelDialogOpen(true);
                  }}
                >
                  <RotateCcw className="size-4" />
                  Cancelar formulário
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </ItemActions>
      </Item>

      {/* AlertDialog de confirmação — ação destrutiva, requer confirmação
          explícita. Mensagem deixa claro que os campos serão resetados. */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Tem certeza que deseja cancelar este formulário?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação vai excluir a última resposta do formulário{" "}
              <strong>{group.formName}</strong> deste lead. O formulário voltará
              a aparecer como "não preenchido" no card e nos detalhes do lead.
              <br />
              <br />
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelMutation.isPending}>
              Voltar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmCancel}
              disabled={cancelMutation.isPending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {cancelMutation.isPending ? (
                <>
                  <Loader className="size-4 animate-spin" />
                  Cancelando...
                </>
              ) : (
                "Cancelar formulário"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

