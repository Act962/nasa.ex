"use client";

import { useState } from "react";
import {
  BookmarkPlusIcon,
  ExpandIcon,
  FullscreenIcon,
  Link2Icon,
  PinIcon,
  PinOffIcon,
  RefreshCwIcon,
} from "lucide-react";
import { useHeaderPin } from "../context/use-header-pin";
import { SettingsPanel } from "./settings-panel";
import type {
  AppModule,
  ChartType,
  DashboardSettings,
  DateRange,
} from "@/features/insights/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SharingInsights } from "./sharing-insight-modal";
import { useDashboardStore } from "../hooks/use-dashboard-store";
import { authClient } from "@/lib/auth-client";
import { useFullscreen } from "@/hooks/use-full-screen";
import { SaveReportModal } from "./reports/save-report-modal";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DashboardHeaderProps {
  settings: DashboardSettings;
  onToggleSection: (
    section: keyof DashboardSettings["visibleSections"],
  ) => void;
  onChartTypeChange: (
    chart: keyof DashboardSettings["chartTypes"],
    type: ChartType,
  ) => void;
  onReset: () => void;
  onRefresh: () => void;
  isLoading: boolean;
  filters?: {
    trackingId?: string;
    organizationIds: string[];
    tagIds: string[];
    dateRange: DateRange;
  };
  modules?: AppModule[];
  snapshotData?: Record<string, unknown>;
}

/**
 * Botões de ação do dashboard de Insights — pensados pra serem
 * renderizados dentro do `<InsightsSidebar actions={...}>`. Cada botão
 * usa ícone + Tooltip (no estado retraído da sidebar só o ícone aparece).
 *
 * O componente não tem mais o título "Insights" porque ele agora vive
 * no header da própria sidebar.
 */
export function DashboardHeader({
  settings,
  onToggleSection,
  onChartTypeChange,
  onReset,
  onRefresh,
  isLoading,
  filters,
  modules,
  snapshotData,
}: DashboardHeaderProps) {
  const [saveOpen, setSaveOpen] = useState(false);
  const store = useDashboardStore();
  const session = authClient.useSession();
  const { isFullscreen, toggleFullscreen } = useFullscreen();
  const isPinned = useHeaderPin((s) => s.isPinned);
  const togglePin = useHeaderPin((s) => s.toggle);

  return (
    <TooltipProvider delayDuration={200}>
      {/* `contents` deixa cada botão flutuar direto no flex container da
          sidebar (que decide layout coluna-coluna vs linha conforme retraído). */}
      <div className="contents">
        <SharingInsights
          filters={{
            trackingId: store.trackingId,
            organizationIds:
              store.organizationIds.length === 0
                ? [session.data?.session.activeOrganizationId]
                : store.organizationIds,
            tagIds: store.tagIds,
            dateRange: store.dateRange,
          }}
          settings={settings}
        >
          <ActionButton
            label="Compartilhar"
            icon={<Link2Icon className="size-4" />}
            disabled={isLoading}
          />
        </SharingInsights>
        <ActionButton
          label="Atualizar"
          icon={
            <RefreshCwIcon
              className={cn("size-4", isLoading && "animate-spin")}
            />
          }
          onClick={onRefresh}
          disabled={isLoading}
        />
        <ActionButton
          label="Salvar Relatório"
          icon={<BookmarkPlusIcon className="size-4" />}
          onClick={() => setSaveOpen(true)}
          disabled={isLoading}
        />
        <SettingsPanel
          settings={settings}
          onToggleSection={onToggleSection}
          onChartTypeChange={onChartTypeChange}
          onReset={onReset}
        />
        <ActionButton
          label={isPinned ? "Desafixar header" : "Fixar header"}
          icon={
            isPinned ? (
              <PinOffIcon className="size-4" />
            ) : (
              <PinIcon className="size-4" />
            )
          }
          onClick={togglePin}
          disabled={isLoading}
        />
        <ActionButton
          label={isFullscreen ? "Sair da tela cheia" : "Modo tela cheia"}
          icon={
            isFullscreen ? (
              <FullscreenIcon className="size-4" />
            ) : (
              <ExpandIcon className="size-4" />
            )
          }
          onClick={toggleFullscreen}
          disabled={isLoading}
        />
        <SaveReportModal
          open={saveOpen}
          onOpenChange={setSaveOpen}
          defaultName={`Relatório ${new Date().toLocaleDateString("pt-BR")}`}
          filters={filters ?? store}
          modules={modules ?? []}
          snapshot={
            snapshotData ??
            { filters: filters ?? store, modules: modules ?? [] }
          }
        />
      </div>
    </TooltipProvider>
  );
}

interface ActionButtonProps {
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}

function ActionButton({ label, icon, onClick, disabled }: ActionButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}
