"use client";

import dayjs from "dayjs";
import { SlidersHorizontalIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import { useTags } from "@/features/tags/hooks/use-tags";
import { useStatus } from "@/features/status/hooks/use-status";
import { useWorkspaces } from "@/features/workspace/hooks/use-workspace";
import { usePaymentAccounts, usePaymentCategories } from "@/features/payment/hooks/use-payment";
import { useQueryListAllTrackings } from "@/features/insights/hooks/use-dashboard";
import { useInsightsMembers } from "@/features/insights/hooks/use-insights-members";
import {
  CROSS_FILTER_LABELS,
  DEFAULT_SERIES_RANGE_DAYS,
  type CrossDatasetDef,
  type CrossFilterKey,
  type CrossSeriesFilters,
} from "@/features/insights/lib/cross-chart-catalog";
import { FilterMultiSelect } from "./filter-multi-select";

/** Filtros próprios de uma série do Gráfico Cruzado: período, empresas e os do App da série. */

interface PeriodPreset {
  key: string;
  label: string;
  toRange: () => { startDate: string; endDate: string };
}

const PERIOD_PRESETS: PeriodPreset[] = [
  { key: "7d", label: "7 dias", toRange: () => ({ startDate: dayjs().subtract(7, "day").startOf("day").toISOString(), endDate: dayjs().endOf("day").toISOString() }) },
  { key: "30d", label: "30 dias", toRange: () => ({ startDate: dayjs().subtract(30, "day").startOf("day").toISOString(), endDate: dayjs().endOf("day").toISOString() }) },
  { key: "90d", label: "90 dias", toRange: () => ({ startDate: dayjs().subtract(90, "day").startOf("day").toISOString(), endDate: dayjs().endOf("day").toISOString() }) },
  { key: "month", label: "Este mês", toRange: () => ({ startDate: dayjs().startOf("month").toISOString(), endDate: dayjs().endOf("day").toISOString() }) },
  { key: "last-month", label: "Mês passado", toRange: () => ({ startDate: dayjs().subtract(1, "month").startOf("month").toISOString(), endDate: dayjs().subtract(1, "month").endOf("month").toISOString() }) },
];

export function countActiveFilters(filters: CrossSeriesFilters): number {
  const listKeys: Array<keyof CrossSeriesFilters> = [
    "organizationIds", "trackingIds", "tagIds", "statusIds", "memberIds", "workspaceIds", "paymentAccountIds", "paymentCategoryIds",
  ];
  return listKeys.filter((filterKey) => ((filters[filterKey] as string[] | undefined)?.length ?? 0) > 0).length;
}

export function describePeriod(filters: CrossSeriesFilters): string {
  if (!filters.startDate) return `Últimos ${DEFAULT_SERIES_RANGE_DAYS} dias`;
  const start = dayjs(filters.startDate).format("DD/MM");
  const end = dayjs(filters.endDate ?? undefined).format("DD/MM");
  return `${start} – ${end}`;
}

interface FilterFieldProps {
  filters: CrossSeriesFilters;
  onChange: (patch: Partial<CrossSeriesFilters>) => void;
}

function OrganizationField({ filters, onChange }: FilterFieldProps) {
  const { data: organizations } = authClient.useListOrganizations();
  return (
    <FilterMultiSelect
      label="Empresas"
      allLabel="Todas as empresas"
      options={(organizations ?? []).map((organization) => ({ id: organization.id, name: organization.name }))}
      selectedIds={filters.organizationIds ?? []}
      // Tracking, tag, status e atendente pertencem à empresa: trocar a empresa limpa esses filtros.
      onChange={(organizationIds) =>
        onChange({ organizationIds, trackingIds: [], tagIds: [], statusIds: [], memberIds: [], workspaceIds: [] })
      }
    />
  );
}

function TrackingField({ filters, onChange }: FilterFieldProps) {
  const { trackings } = useQueryListAllTrackings(filters.organizationIds ?? []);
  return (
    <FilterMultiSelect
      label={CROSS_FILTER_LABELS.tracking}
      allLabel="Todos os trackings"
      options={trackings.map((tracking) => ({ id: tracking.id, name: tracking.name }))}
      selectedIds={filters.trackingIds ?? []}
      // Status depende do tracking: trocar o tracking limpa os status escolhidos.
      onChange={(trackingIds) => onChange({ trackingIds, statusIds: [] })}
    />
  );
}

function TagField({ filters, onChange }: FilterFieldProps) {
  const singleTrackingId = filters.trackingIds?.length === 1 ? filters.trackingIds[0] : undefined;
  const { tags } = useTags({ trackingId: singleTrackingId });
  return (
    <FilterMultiSelect
      label={CROSS_FILTER_LABELS.tag}
      allLabel="Todas as tags"
      options={tags.map((tag) => ({ id: tag.id, name: tag.name }))}
      selectedIds={filters.tagIds ?? []}
      onChange={(tagIds) => onChange({ tagIds })}
    />
  );
}

function StatusField({ filters, onChange }: FilterFieldProps) {
  const singleTrackingId = filters.trackingIds?.length === 1 ? filters.trackingIds[0] : "";
  const { status: statuses } = useStatus(singleTrackingId);
  return (
    <FilterMultiSelect
      label={CROSS_FILTER_LABELS.status}
      allLabel="Todos os status"
      options={statuses.map((status) => ({ id: status.id, name: status.name }))}
      selectedIds={filters.statusIds ?? []}
      onChange={(statusIds) => onChange({ statusIds })}
      disabledHint={singleTrackingId ? undefined : "Escolha 1 tracking para filtrar status"}
    />
  );
}

function AttendantField({ filters, onChange }: FilterFieldProps) {
  const { members } = useInsightsMembers({
    organizationIds: filters.organizationIds?.length ? filters.organizationIds : undefined,
    trackingIds: filters.trackingIds?.length ? filters.trackingIds : undefined,
  });
  return (
    <FilterMultiSelect
      label={CROSS_FILTER_LABELS.attendant}
      allLabel="Todos os atendentes"
      options={members.map((member) => ({ id: member.id, name: member.name }))}
      selectedIds={filters.memberIds ?? []}
      onChange={(memberIds) => onChange({ memberIds })}
    />
  );
}

function WorkspaceField({ filters, onChange }: FilterFieldProps) {
  const { data } = useWorkspaces();
  return (
    <FilterMultiSelect
      label={CROSS_FILTER_LABELS.workspace}
      allLabel="Todos os workspaces"
      options={(data?.workspaces ?? []).map((workspace) => ({ id: workspace.id, name: workspace.name }))}
      selectedIds={filters.workspaceIds ?? []}
      onChange={(workspaceIds) => onChange({ workspaceIds })}
    />
  );
}

function PaymentAccountField({ filters, onChange }: FilterFieldProps) {
  const { data, isError } = usePaymentAccounts();
  return (
    <FilterMultiSelect
      label={CROSS_FILTER_LABELS.paymentAccount}
      allLabel="Todos os bancos"
      options={(data?.accounts ?? []).map((account) => ({ id: account.id, name: account.name }))}
      selectedIds={filters.paymentAccountIds ?? []}
      onChange={(paymentAccountIds) => onChange({ paymentAccountIds })}
      disabledHint={isError ? "Sem acesso ao Financeiro" : undefined}
    />
  );
}

function PaymentCategoryField({ filters, onChange }: FilterFieldProps) {
  const { data, isError } = usePaymentCategories();
  return (
    <FilterMultiSelect
      label={CROSS_FILTER_LABELS.paymentCategory}
      allLabel="Todas as categorias"
      options={(data?.categories ?? []).map((category) => ({ id: category.id, name: category.name }))}
      selectedIds={filters.paymentCategoryIds ?? []}
      onChange={(paymentCategoryIds) => onChange({ paymentCategoryIds })}
      disabledHint={isError ? "Sem acesso ao Financeiro" : undefined}
    />
  );
}

const FIELD_BY_FILTER: Record<CrossFilterKey, (props: FilterFieldProps) => React.ReactNode> = {
  tracking: TrackingField,
  tag: TagField,
  status: StatusField,
  attendant: AttendantField,
  workspace: WorkspaceField,
  paymentAccount: PaymentAccountField,
  paymentCategory: PaymentCategoryField,
};

interface SeriesFiltersPopoverProps {
  dataset: CrossDatasetDef;
  filters: CrossSeriesFilters;
  onChange: (filters: CrossSeriesFilters) => void;
}

export function SeriesFiltersPopover({ dataset, filters, onChange }: SeriesFiltersPopoverProps) {
  const activeCount = countActiveFilters(filters);
  const applyPatch = (patch: Partial<CrossSeriesFilters>) => onChange({ ...filters, ...patch });
  const toDateInput = (isoDate?: string) => (isoDate ? dayjs(isoDate).format("YYYY-MM-DD") : "");

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-line px-3 text-[11px] font-medium transition-colors hover:bg-accent",
            activeCount > 0 && "border-foreground/40",
          )}
        >
          <SlidersHorizontalIcon className="size-3.5" />
          <span>Filtros</span>
          {activeCount > 0 && (
            <span className="grid size-4 place-items-center rounded-full bg-foreground text-[10px] text-background">{activeCount}</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-1rem))] space-y-3 p-3">
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-muted-foreground">Período</p>
          <div className="flex flex-wrap gap-1">
            {PERIOD_PRESETS.map((preset) => (
              <button
                key={preset.key}
                type="button"
                onClick={() => applyPatch(preset.toRange())}
                className="rounded-full border border-line px-2.5 py-1 text-[11px] hover:bg-accent"
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={toDateInput(filters.startDate)}
              onChange={(event) =>
                applyPatch({ startDate: event.target.value ? dayjs(event.target.value).startOf("day").toISOString() : undefined })
              }
              className="h-9 rounded-full border border-line bg-card px-3 text-xs"
              aria-label="Data inicial"
            />
            <input
              type="date"
              value={toDateInput(filters.endDate)}
              onChange={(event) =>
                applyPatch({ endDate: event.target.value ? dayjs(event.target.value).endOf("day").toISOString() : undefined })
              }
              className="h-9 rounded-full border border-line bg-card px-3 text-xs"
              aria-label="Data final"
            />
          </div>
        </div>

        <OrganizationField filters={filters} onChange={applyPatch} />
        {dataset.filters.map((filterKey) => {
          const FilterField = FIELD_BY_FILTER[filterKey];
          return <FilterField key={filterKey} filters={filters} onChange={applyPatch} />;
        })}

        {activeCount > 0 && (
          <button
            type="button"
            onClick={() => onChange({ startDate: filters.startDate, endDate: filters.endDate })}
            className="text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Limpar filtros desta série
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
