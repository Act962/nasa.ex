"use client";

import { useState } from "react";
import Link from "next/link";
import { Calculator, ChevronRight, Plus, Send } from "lucide-react";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { formatCents } from "@/features/form-records/lib/measure-units";
import { cn } from "@/lib/utils";
import { FORM_RECORDS_SECTION_ID, InternalQuickView, formatPeriodKey } from "./form-records-section";

// Tela inicial das fichas (spec 0075, RF-16): uma ação principal, dois atalhos
// e a lista do que falta e do que está pronto.

export interface WorkspaceRecord {
  id: string;
  responseId: string;
  title: string;
  detail: string;
  leadId: string | null;
  leadName: string | null;
  referenceDate: string;
  usageTotalCents: number;
  isFinalized: boolean;
}

export interface FormWorkspace {
  openingForm: { id: string; name: string };
  followUpForm: { id: string; name: string } | null;
  closingFormId: string;
  pendingRecords: WorkspaceRecord[];
  pendingCount: number;
  completedRecords: WorkspaceRecord[];
  completedCount: number;
  monthSummary: { periodKey: string; openedCount: number; completedCount: number; usageCents: number; clientCount: number };
}

type ListTab = "pending" | "completed";

const DESKTOP_ROW_GRID = "md:grid md:grid-cols-[minmax(0,0.7fr)_minmax(0,1.2fr)_minmax(0,1.4fr)_minmax(0,0.8fr)_auto]";

function formatRecordDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
}

/** Onde a ficha seguinte é preenchida, já com a ficha de abertura escolhida. */
export function buildFollowUpHref(followUpFormId: string, record: Pick<WorkspaceRecord, "id" | "leadId">): string {
  if (!record.leadId) return `/formulario/novo/${followUpFormId}`;
  return `/formulario/novo/${followUpFormId}/${record.leadId}?origem=${record.id}`;
}

function ActionCard({ icon, title, hint, ...rest }: { icon: React.ReactNode; title: string; hint: string } & ({ href: string } | { onClick: () => void; guideId?: string })) {
  const className = "flex h-full w-full flex-col items-start rounded-[20px] border bg-card p-3.5 text-left transition-colors hover:bg-accent";
  const content = (
    <>
      <span className="mb-2.5 grid size-9 place-items-center rounded-full bg-knob [&_svg]:size-4">{icon}</span>
      <span className="text-sm font-medium">{title}</span>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </>
  );
  if ("href" in rest) {
    return (
      <Link href={rest.href} className={className}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={rest.onClick} className={className} data-guide={rest.guideId}>
      {content}
    </button>
  );
}

function MonthTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-[16px] bg-knob px-3.5 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate text-xl font-semibold tabular-nums tracking-tight">{value}</p>
    </div>
  );
}

export function FormWorkspaceHome({
  workspace,
  onSendLink,
  onShowDashboard,
}: {
  workspace: FormWorkspace;
  onSendLink: () => void;
  onShowDashboard: () => void;
}) {
  const { openingForm, followUpForm } = workspace;
  const hasPendingStep = followUpForm !== null;
  const [tab, setTab] = useState<ListTab>(hasPendingStep && workspace.pendingCount > 0 ? "pending" : "completed");
  const [openRecord, setOpenRecord] = useState<WorkspaceRecord | null>(null);

  const activeTab: ListTab = hasPendingStep ? tab : "completed";
  const records = activeTab === "pending" ? workspace.pendingRecords : workspace.completedRecords;
  const totalInTab = activeTab === "pending" ? workspace.pendingCount : workspace.completedCount;

  return (
    <section className="space-y-4 pb-2 md:grid md:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] md:items-start md:gap-5 md:space-y-0" aria-label="Início">
      <Link
        href={`/formulario/novo/${openingForm.id}`}
        data-guide={GUIDE_ANCHORS.formWorkspaceNewRecord.id}
        className="flex min-h-[52px] w-full md:hidden items-center justify-center gap-2 rounded-full bg-primary px-4 text-base font-semibold text-primary-foreground transition-opacity hover:opacity-90"
      >
        <Plus className="size-5 shrink-0" />
        <span className="truncate">{openingForm.name}</span>
      </Link>

      <div className="grid grid-cols-2 gap-2.5 md:hidden">
        <ActionCard
          href={`/form/responses/${workspace.closingFormId}/fechamento`}
          icon={<Calculator />}
          title="Fechamento do mês"
          hint="Total por cliente"
        />
        <ActionCard
          onClick={onSendLink}
          guideId={GUIDE_ANCHORS.formWorkspaceSendLink.id}
          icon={<Send />}
          title="Enviar link ao cliente"
          hint="Ele confere as fichas dele"
        />
      </div>

      <div className="min-w-0 space-y-2 md:col-start-1 md:row-start-1">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-base font-semibold">{hasPendingStep ? "Em andamento" : "Últimas fichas"}</h2>
          <a href={`#${FORM_RECORDS_SECTION_ID}`} className="text-xs text-muted-foreground hover:text-foreground">
            ver todas
          </a>
        </div>
        {hasPendingStep && (
          <>
            <div className="flex flex-wrap gap-1.5" role="tablist">
              {(
                [
                  { id: "pending", label: `Pendentes · ${workspace.pendingCount}` },
                  { id: "completed", label: `Prontas · ${workspace.completedCount}` },
                ] as const
              ).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === option.id}
                  onClick={() => setTab(option.id)}
                  className={cn(
                    "h-9 rounded-full px-3.5 text-xs font-medium transition-colors",
                    activeTab === option.id ? "bg-foreground text-background" : "bg-knob text-muted-foreground",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {activeTab === "pending" && <p className="text-xs text-muted-foreground">Falta preencher: {followUpForm.name}.</p>}
          </>
        )}

        <ul className="divide-y overflow-hidden rounded-[20px] border bg-card">
          {records.length > 0 && (
            <li className={`px-3.5 py-2 text-xs text-muted-foreground max-md:hidden ${DESKTOP_ROW_GRID}`} aria-hidden>
              <span>Ficha</span>
              <span>Cliente</span>
              <span>Detalhes</span>
              <span>Data</span>
              <span className="justify-self-end">{activeTab === "pending" ? "Falta preencher" : "Itens"}</span>
            </li>
          )}
          {records.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-muted-foreground">
              {activeTab === "pending" ? "Nada pendente. Tudo em dia." : "Nenhuma ficha ainda."}
            </li>
          )}
          {records.map((record) => {
            const dateText = [formatRecordDate(record.referenceDate), record.isFinalized ? null : "rascunho"].filter(Boolean).join(" · ");
            const rowText = (
              <>
                <span className="min-w-0 flex-1 md:hidden">
                  <span className="block break-words text-sm font-medium">{[record.title, record.leadName].filter(Boolean).join(" · ")}</span>
                  <span className="block break-words text-xs text-muted-foreground">{[record.detail, dateText].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="min-w-0 break-words text-sm font-semibold max-md:hidden">{record.title}</span>
                <span className="min-w-0 break-words text-sm max-md:hidden">{record.leadName ?? "Sem cliente"}</span>
                <span className="min-w-0 break-words text-sm text-muted-foreground max-md:hidden">{record.detail || "—"}</span>
                <span className="text-sm text-muted-foreground max-md:hidden">{dateText}</span>
              </>
            );
            const rowClassName = `flex w-full items-center gap-3 px-3.5 py-3 text-left hover:bg-accent ${DESKTOP_ROW_GRID}`;
            return (
              <li key={record.id}>
                {activeTab === "pending" && followUpForm ? (
                  <Link href={buildFollowUpHref(followUpForm.id, record)} className={rowClassName}>
                    {rowText}
                    <span className="flex shrink-0 items-center gap-0.5 justify-self-end rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-background">
                      Continuar
                      <ChevronRight className="size-3.5" />
                    </span>
                  </Link>
                ) : (
                  <button type="button" onClick={() => setOpenRecord(record)} className={rowClassName}>
                    {rowText}
                    <span className="shrink-0 justify-self-end text-sm font-medium tabular-nums">{formatCents(record.usageTotalCents)}</span>
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        {totalInTab > records.length && (
          <p className="text-center text-xs text-muted-foreground">
            Mostrando as {records.length} mais recentes de {totalInTab}.
          </p>
        )}
      </div>

      <aside className="space-y-3 rounded-[20px] border bg-card p-4 max-md:hidden md:col-start-2 md:row-start-1" aria-label="Números do mês">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-base font-semibold first-letter:uppercase">{formatPeriodKey(workspace.monthSummary.periodKey)}</h2>
          <button type="button" onClick={onShowDashboard} className="flex items-center text-xs text-muted-foreground hover:text-foreground">
            Ver painel completo
            <ChevronRight className="size-3.5" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {hasPendingStep && <MonthTile label="Abertas" value={String(workspace.monthSummary.openedCount)} />}
          <MonthTile label={hasPendingStep ? "Prontas" : "Fichas"} value={String(workspace.monthSummary.completedCount)} />
          <MonthTile label="Total dos itens" value={formatCents(workspace.monthSummary.usageCents)} />
          <MonthTile label="Clientes" value={String(workspace.monthSummary.clientCount)} />
        </div>
      </aside>

      {openRecord && <InternalQuickView responseId={openRecord.responseId} label={openRecord.title} onClose={() => setOpenRecord(null)} />}
    </section>
  );
}
