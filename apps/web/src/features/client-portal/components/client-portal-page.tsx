"use client";

import { usePortal } from "../hooks/use-portal";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/spinner";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2Icon, ClockIcon, CircleDotIcon, RocketIcon,
  FileIcon, LinkIcon, BarChart2Icon, CalendarIcon, ClipboardListIcon,
  ExternalLinkIcon, SparklesIcon,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const STAGE_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  PAYMENT_CONFIRMED:  { label: "Pagamento confirmado",       icon: <CheckCircle2Icon className="size-4 text-green-500" /> },
  FORMS_SENT:         { label: "Formulários enviados",        icon: <CheckCircle2Icon className="size-4 text-green-500" /> },
  BRAND_FORM_DONE:    { label: "Marca preenchida",            icon: <CheckCircle2Icon className="size-4 text-green-500" /> },
  ONBOARDING_DONE:    { label: "Onboarding concluído",        icon: <CheckCircle2Icon className="size-4 text-green-500" /> },
  KICKOFF_SCHEDULED:  { label: "Kickoff agendado",            icon: <CheckCircle2Icon className="size-4 text-green-500" /> },
  CAMPAIGN_CREATED:   { label: "Campanha criada",             icon: <CheckCircle2Icon className="size-4 text-green-500" /> },
  ACTIVE:             { label: "Projeto ativo",               icon: <CheckCircle2Icon className="size-4 text-green-500" /> },
};

const STAGE_ORDER = [
  "PAYMENT_CONFIRMED",
  "FORMS_SENT",
  "BRAND_FORM_DONE",
  "ONBOARDING_DONE",
  "KICKOFF_SCHEDULED",
  "CAMPAIGN_CREATED",
  "ACTIVE",
];

const CAMPAIGN_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho", ACTIVE: "Ativa", PAUSED: "Pausada", COMPLETED: "Concluída", ARCHIVED: "Arquivada",
};

const CAMPAIGN_STATUS_COLORS: Record<string, string> = {
  DRAFT: "secondary", ACTIVE: "default", PAUSED: "outline", COMPLETED: "default", ARCHIVED: "secondary",
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  TRAINING: "Treinamento", STRATEGIC_MEETING: "Reunião Estratégica", REVIEW: "Revisão",
  KICKOFF: "Kickoff", PRESENTATION: "Apresentação", DEADLINE: "Prazo",
};

const TASK_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente", IN_PROGRESS: "Em andamento", REVIEW: "Revisão", COMPLETED: "Concluída", BLOCKED: "Bloqueada",
};

const TASK_STATUS_COLORS: Record<string, "default" | "secondary" | "outline"> = {
  PENDING: "secondary", IN_PROGRESS: "default", REVIEW: "outline", COMPLETED: "default", BLOCKED: "outline",
};

function fmt(d: string | Date | null | undefined) {
  if (!d) return null;
  return format(new Date(d), "dd/MM/yyyy", { locale: ptBR });
}

export function ClientPortalPage({ clientCode }: { clientCode: string }) {
  const { portal, isLoading } = usePortal(clientCode);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!portal) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center px-4">
        <SparklesIcon className="size-12 text-muted-foreground opacity-40" />
        <h1 className="text-2xl font-bold">Portal não encontrado</h1>
        <p className="text-muted-foreground">O código informado não corresponde a nenhum cliente ativo.</p>
      </div>
    );
  }

  const accentColor = portal.orgProject?.color ?? "#7c3aed";
  const currentStageIdx = STAGE_ORDER.indexOf(portal.stage);
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b" style={{ borderColor: `${accentColor}30` }}>
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="flex items-center gap-4">
            {portal.orgProject?.avatar ? (
              <img src={portal.orgProject.avatar} alt={portal.orgProject.name ?? ""} className="size-16 rounded-xl object-cover" />
            ) : (
              <div className="size-16 rounded-xl flex items-center justify-center text-white font-bold text-2xl" style={{ backgroundColor: accentColor }}>
                {(portal.orgProject?.name ?? portal.lead?.name ?? "C")[0].toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold">{portal.orgProject?.name ?? portal.lead?.name ?? "Meu Portal"}</h1>
              {portal.orgProject?.slogan && <p className="text-muted-foreground text-sm mt-0.5">{portal.orgProject.slogan}</p>}
              <Badge variant="outline" className="mt-1 text-xs">{portal.clientPortalCode}</Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">

        {/* Formulários pendentes */}
        {(portal.stage === "FORMS_SENT" || portal.stage === "BRAND_FORM_DONE") && (
          <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-amber-700 dark:text-amber-400 flex items-center gap-2">
                <ClipboardListIcon className="size-4" />Ação necessária
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {portal.brandFormId && !portal.brandFormDoneAt && (
                <Button variant="outline" size="sm" className="gap-1.5" asChild>
                  <a href={`${baseUrl}/submit-form/${portal.brandFormId}`} target="_blank" rel="noopener noreferrer">
                    <ExternalLinkIcon className="size-3.5" />Preencher formulário de marca
                  </a>
                </Button>
              )}
              {portal.onboardingFormId && !portal.onboardingDoneAt && (
                <Button variant="outline" size="sm" className="gap-1.5" asChild>
                  <a href={`${baseUrl}/submit-form/${portal.onboardingFormId}`} target="_blank" rel="noopener noreferrer">
                    <ExternalLinkIcon className="size-3.5" />Preencher formulário de onboarding
                  </a>
                </Button>
              )}
              {portal.kickoffLink && (
                <Button variant="outline" size="sm" className="gap-1.5" asChild>
                  <a href={portal.kickoffLink} target="_blank" rel="noopener noreferrer">
                    <CalendarIcon className="size-3.5" />Agendar reunião de Kickoff
                  </a>
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Jornada / Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CircleDotIcon className="size-4" style={{ color: accentColor }} />Jornada
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {STAGE_ORDER.map((stage, idx) => {
                const done = idx <= currentStageIdx;
                const ts = {
                  PAYMENT_CONFIRMED: portal.paymentConfirmedAt,
                  FORMS_SENT: portal.formsSentAt,
                  BRAND_FORM_DONE: portal.brandFormDoneAt,
                  ONBOARDING_DONE: portal.onboardingDoneAt,
                  KICKOFF_SCHEDULED: null,
                  CAMPAIGN_CREATED: portal.campaignCreatedAt,
                  ACTIVE: portal.activatedAt,
                }[stage];
                return (
                  <div key={stage} className={`flex items-center gap-3 ${!done ? "opacity-40" : ""}`}>
                    {done ? (
                      <CheckCircle2Icon className="size-4 shrink-0 text-green-500" />
                    ) : (
                      <ClockIcon className="size-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="text-sm flex-1">{STAGE_LABELS[stage]?.label}</span>
                    {ts && <span className="text-xs text-muted-foreground">{fmt(ts)}</span>}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Campanha */}
        {portal.campaign && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <RocketIcon className="size-4" style={{ color: accentColor }} />Campanha Ativa
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{portal.campaign.title}</p>
                  {portal.campaign.description && <p className="text-sm text-muted-foreground mt-1">{portal.campaign.description}</p>}
                </div>
                <Badge variant={CAMPAIGN_STATUS_COLORS[portal.campaign.status] as any}>
                  {CAMPAIGN_STATUS_LABELS[portal.campaign.status] ?? portal.campaign.status}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                {portal.campaign.startDate && <span>Início: {fmt(portal.campaign.startDate)}</span>}
                {portal.campaign.endDate && <span>Término: {fmt(portal.campaign.endDate)}</span>}
                <span>Código: {portal.campaign.companyCode}</span>
              </div>

              {portal.campaign.publicAccess?.isActive && (
                <Button variant="outline" size="sm" className="gap-1.5" asChild>
                  <a href={`${baseUrl}/nasa-planner/calendario-cliente?code=${portal.campaign.publicAccess.accessCode}`} target="_blank" rel="noopener noreferrer">
                    <CalendarIcon className="size-3.5" />Ver calendário da campanha
                  </a>
                </Button>
              )}

              {/* Eventos */}
              {portal.campaign.events?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Próximos eventos</p>
                  {portal.campaign.events.slice(0, 5).map((ev: any) => (
                    <div key={ev.id} className="flex items-center gap-2 text-sm">
                      <CalendarIcon className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="flex-1">{ev.title}</span>
                      <Badge variant="outline" className="text-xs">{EVENT_TYPE_LABELS[ev.eventType] ?? ev.eventType}</Badge>
                      {ev.scheduledAt && <span className="text-xs text-muted-foreground">{fmt(ev.scheduledAt)}</span>}
                    </div>
                  ))}
                </div>
              )}

              {/* Tarefas */}
              {portal.campaign.tasks?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tarefas</p>
                  {portal.campaign.tasks.slice(0, 6).map((task: any) => (
                    <div key={task.id} className="flex items-center gap-2 text-sm">
                      <ClipboardListIcon className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="flex-1">{task.title}</span>
                      <Badge variant={TASK_STATUS_COLORS[task.status] ?? "secondary"} className="text-xs">
                        {TASK_STATUS_LABELS[task.status] ?? task.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Relatórios / Insights */}
        {portal.insights?.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart2Icon className="size-4" style={{ color: accentColor }} />Relatórios
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {portal.insights.map((insight: any) => (
                  <a
                    key={insight.id}
                    href={`${baseUrl}/insights/${insight.token}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-2 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <BarChart2Icon className="size-4 text-muted-foreground shrink-0" />
                    <span className="text-sm flex-1">{insight.name}</span>
                    <span className="text-xs text-muted-foreground">{fmt(insight.createdAt)}</span>
                    <ExternalLinkIcon className="size-3.5 text-muted-foreground shrink-0" />
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Arquivos / Entregáveis */}
        {portal.deliverables?.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileIcon className="size-4" style={{ color: accentColor }} />Arquivos e Entregáveis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-60">
                <div className="space-y-2">
                  {portal.deliverables.map((file: any) => (
                    <a
                      key={file.id}
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      {file.type === "LINK" ? (
                        <LinkIcon className="size-4 text-muted-foreground shrink-0" />
                      ) : (
                        <FileIcon className="size-4 text-muted-foreground shrink-0" />
                      )}
                      <span className="text-sm flex-1 truncate">{file.name}</span>
                      {file.description && <span className="text-xs text-muted-foreground hidden sm:block">{file.description}</span>}
                      <ExternalLinkIcon className="size-3.5 text-muted-foreground shrink-0" />
                    </a>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground pb-8">
          Powered by NASA — Código do cliente: {portal.clientPortalCode}
        </p>
      </div>
    </div>
  );
}
