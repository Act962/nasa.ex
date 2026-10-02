"use client";

import { CalendarIcon, XIcon } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useTags } from "@/features/tags/hooks/use-tags";
import { useStatus } from "@/features/status/hooks/use-status";
import { useWorkspaces } from "@/features/workspace/hooks/use-workspace";
import { usePaymentAccounts, usePaymentCategories } from "@/features/payment/hooks/use-payment";
import { useQueryListAllTrackings } from "@/features/insights/hooks/use-dashboard";
import { useInsightsMembers } from "@/features/insights/hooks/use-insights-members";
import type { CrossSeriesFilters } from "@/features/insights/lib/cross-chart-catalog";
import { describePeriod } from "./series-filters-popover";

/** Cartões dos filtros ativos de uma série, na mesma linha dela; o "x" de cada cartão tira aquele filtro. */

interface NamedOption {
  id: string;
  name: string;
}

function FilterChip({ label, value, onRemove }: { label: string; value: string; onRemove?: () => void }) {
  return (
    <span className="flex h-7 max-w-56 shrink-0 items-center gap-1 rounded-full bg-card pr-1 pl-2.5 text-[11px]">
      <span className="text-muted-foreground">{label}:</span>
      <span className="truncate font-medium">{value}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Tirar filtro ${label}`}
          className="grid size-5 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <XIcon className="size-3" />
        </button>
      )}
    </span>
  );
}

function summarizeNames(selectedIds: string[], options: NamedOption[]): string {
  const names = selectedIds.map((selectedId) => options.find((option) => option.id === selectedId)?.name ?? "…");
  return names.length <= 2 ? names.join(", ") : `${names[0]} +${names.length - 1}`;
}

interface ChipGroupProps {
  filters: CrossSeriesFilters;
  onChange: (filters: CrossSeriesFilters) => void;
}

function OrganizationChip({ filters, onChange }: ChipGroupProps) {
  const { data: organizations } = authClient.useListOrganizations();
  const options = (organizations ?? []).map((organization) => ({ id: organization.id, name: organization.name }));
  return (
    <FilterChip
      label="Empresa"
      value={summarizeNames(filters.organizationIds ?? [], options)}
      onRemove={() => onChange({ ...filters, organizationIds: [], trackingIds: [], tagIds: [], statusIds: [], memberIds: [], workspaceIds: [] })}
    />
  );
}

function TrackingChip({ filters, onChange }: ChipGroupProps) {
  const { trackings } = useQueryListAllTrackings(filters.organizationIds ?? []);
  return (
    <FilterChip
      label="Tracking"
      value={summarizeNames(filters.trackingIds ?? [], trackings.map((tracking) => ({ id: tracking.id, name: tracking.name })))}
      onRemove={() => onChange({ ...filters, trackingIds: [], statusIds: [] })}
    />
  );
}

function TagChip({ filters, onChange }: ChipGroupProps) {
  const singleTrackingId = filters.trackingIds?.length === 1 ? filters.trackingIds[0] : undefined;
  const { tags } = useTags({ trackingId: singleTrackingId });
  return (
    <FilterChip
      label="Tag"
      value={summarizeNames(filters.tagIds ?? [], tags.map((tag) => ({ id: tag.id, name: tag.name })))}
      onRemove={() => onChange({ ...filters, tagIds: [] })}
    />
  );
}

function StatusChip({ filters, onChange }: ChipGroupProps) {
  const singleTrackingId = filters.trackingIds?.length === 1 ? filters.trackingIds[0] : "";
  const { status: statuses } = useStatus(singleTrackingId);
  return (
    <FilterChip
      label="Status"
      value={summarizeNames(filters.statusIds ?? [], statuses.map((status) => ({ id: status.id, name: status.name })))}
      onRemove={() => onChange({ ...filters, statusIds: [] })}
    />
  );
}

function AttendantChip({ filters, onChange }: ChipGroupProps) {
  const { members } = useInsightsMembers({
    organizationIds: filters.organizationIds?.length ? filters.organizationIds : undefined,
    trackingIds: filters.trackingIds?.length ? filters.trackingIds : undefined,
  });
  return (
    <FilterChip
      label="Atendente"
      value={summarizeNames(filters.memberIds ?? [], members.map((member) => ({ id: member.id, name: member.name })))}
      onRemove={() => onChange({ ...filters, memberIds: [] })}
    />
  );
}

function WorkspaceChip({ filters, onChange }: ChipGroupProps) {
  const { data } = useWorkspaces();
  return (
    <FilterChip
      label="Workspace"
      value={summarizeNames(filters.workspaceIds ?? [], (data?.workspaces ?? []).map((workspace) => ({ id: workspace.id, name: workspace.name })))}
      onRemove={() => onChange({ ...filters, workspaceIds: [] })}
    />
  );
}

function PaymentAccountChip({ filters, onChange }: ChipGroupProps) {
  const { data } = usePaymentAccounts();
  return (
    <FilterChip
      label="Banco"
      value={summarizeNames(filters.paymentAccountIds ?? [], (data?.accounts ?? []).map((account) => ({ id: account.id, name: account.name })))}
      onRemove={() => onChange({ ...filters, paymentAccountIds: [] })}
    />
  );
}

function PaymentCategoryChip({ filters, onChange }: ChipGroupProps) {
  const { data } = usePaymentCategories();
  return (
    <FilterChip
      label="Categoria"
      value={summarizeNames(filters.paymentCategoryIds ?? [], (data?.categories ?? []).map((category) => ({ id: category.id, name: category.name })))}
      onRemove={() => onChange({ ...filters, paymentCategoryIds: [] })}
    />
  );
}

const hasIds = (ids?: string[]) => Boolean(ids && ids.length > 0);

export function SeriesFilterChips({ filters, onChange }: ChipGroupProps) {
  const isCustomPeriod = Boolean(filters.startDate);
  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
      <span className="flex h-7 shrink-0 items-center gap-1 rounded-full bg-card px-2.5 text-[11px] font-medium">
        <CalendarIcon className="size-3 text-muted-foreground" />
        {describePeriod(filters)}
        {isCustomPeriod && (
          <button
            type="button"
            onClick={() => onChange({ ...filters, startDate: undefined, endDate: undefined })}
            aria-label="Voltar ao período padrão"
            className="ml-0.5 grid size-5 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <XIcon className="size-3" />
          </button>
        )}
      </span>
      {/* Cada cartão só monta quando o filtro está ativo — evita buscar listas (e o Financeiro) à toa. */}
      {hasIds(filters.organizationIds) && <OrganizationChip filters={filters} onChange={onChange} />}
      {hasIds(filters.trackingIds) && <TrackingChip filters={filters} onChange={onChange} />}
      {hasIds(filters.tagIds) && <TagChip filters={filters} onChange={onChange} />}
      {hasIds(filters.statusIds) && <StatusChip filters={filters} onChange={onChange} />}
      {hasIds(filters.memberIds) && <AttendantChip filters={filters} onChange={onChange} />}
      {hasIds(filters.workspaceIds) && <WorkspaceChip filters={filters} onChange={onChange} />}
      {hasIds(filters.paymentAccountIds) && <PaymentAccountChip filters={filters} onChange={onChange} />}
      {hasIds(filters.paymentCategoryIds) && <PaymentCategoryChip filters={filters} onChange={onChange} />}
    </div>
  );
}
