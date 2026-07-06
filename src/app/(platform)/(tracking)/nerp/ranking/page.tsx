"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Filter, Maximize2, Minimize2, RotateCcw, Settings, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { NerpShell } from "../../../../../features/nerp/components/nerp-shell";
import {
  useSalesGoalRanking,
  useSalesGoalRankingSettings,
  useUpsertSalesGoalEntry,
} from "../../../../../features/nerp/hooks/use-nerp-ranking";
import { SalesGoalImportDialog } from "../../../../../features/nerp/components/sales-goal-import-dialog";
import { SalesGoalSettingsSheet } from "../../../../../features/nerp/components/sales-goal-settings-sheet";
import {
  SalesGoalPodium,
  formatBrl,
  type SalesGoalRankEntry,
} from "../../../../../features/nerp/components/sales-goal-podium";
import { SalesGoalRankRow } from "../../../../../features/nerp/components/sales-goal-rank-row";
import { SalesGoalTeamHeader } from "../../../../../features/nerp/components/sales-goal-team-header";
import { SalesGoalSideRail } from "../../../../../features/nerp/components/sales-goal-side-rail";
import { SalesGoalTeamsCarousel } from "../../../../../features/nerp/components/sales-goal-teams-carousel";
import type { SalesGoalPeriodType } from "../../../../../features/nerp/lib/sales-goal-xlsx-parser";
import { SALES_GOAL_THEME_STYLES } from "../../../../../features/nerp/lib/sales-goal-theme";
import { playSalesGoalSound } from "../../../../../features/nerp/lib/sales-goal-sound-presets";

const ALL_PERIOD_TABS: { key: SalesGoalPeriodType; label: string }[] = [
  { key: "DAILY", label: "Diário" },
  { key: "WEEKLY", label: "Semanal" },
  { key: "MONTHLY", label: "Mensal" },
  { key: "BIMONTHLY", label: "Bimestral" },
  { key: "QUARTERLY", label: "Trimestral" },
  { key: "SEMIANNUAL", label: "Semestral" },
  { key: "ANNUAL", label: "Anual" },
];

const ALL_BRANCHES = "__all__";

export default function SalesGoalRankingPage() {
  const [periodType, setPeriodType] = useState<SalesGoalPeriodType>("MONTHLY");
  const [selectedBranch, setSelectedBranch] = useState<string>(ALL_BRANCHES);
  const [showScore, setShowScore] = useState(true);
  const [showPercent, setShowPercent] = useState(true);
  const [showSoldValue, setShowSoldValue] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [autoAdvanceSeconds, setAutoAdvanceSeconds] = useState(300);
  const [tvMode, setTvMode] = useState(false);
  const [tvControlsVisible, setTvControlsVisible] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);
  const hideControlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleFullscreenChange = () => setTvMode(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (!tvMode) return;

    const scheduleHide = () => {
      setTvControlsVisible(true);
      if (hideControlsTimeoutRef.current) clearTimeout(hideControlsTimeoutRef.current);
      hideControlsTimeoutRef.current = setTimeout(() => setTvControlsVisible(false), 3000);
    };

    scheduleHide();
    const node = panelRef.current;
    node?.addEventListener("mousemove", scheduleHide);
    return () => {
      node?.removeEventListener("mousemove", scheduleHide);
      if (hideControlsTimeoutRef.current) clearTimeout(hideControlsTimeoutRef.current);
    };
  }, [tvMode]);

  const toggleTvMode = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await panelRef.current?.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Fullscreen indisponível (ex: iframe sem permissão) — TV mode segue só visual.
      setTvMode((current) => !current);
    }
  }, []);

  const query = useSalesGoalRanking(periodType);
  const settingsQuery = useSalesGoalRankingSettings();
  const upsertEntry = useUpsertSalesGoalEntry();
  const settings = settingsQuery.data;
  const theme = SALES_GOAL_THEME_STYLES[settings?.theme ?? "GAMING"];
  const period = query.data;

  const periodTabs = useMemo(() => {
    if (!settings) return ALL_PERIOD_TABS;
    return ALL_PERIOD_TABS.filter((tab) => settings.activePeriodTypes.includes(tab.key));
  }, [settings]);

  const entries: SalesGoalRankEntry[] = useMemo(() => {
    if (!period) return [];
    const branches =
      selectedBranch === ALL_BRANCHES
        ? period.branches
        : period.branches.filter((branch) => branch.id === selectedBranch);
    return branches
      .flatMap((branch) => branch.entries)
      .sort((a, b) => (b.percentAchieved ?? -1) - (a.percentAchieved ?? -1));
  }, [period, selectedBranch]);

  const goalTotal =
    selectedBranch === ALL_BRANCHES
      ? (period?.goalTotal ?? 0)
      : (period?.branches.find((branch) => branch.id === selectedBranch)?.goalTotal ?? 0);
  const achievedTotal =
    selectedBranch === ALL_BRANCHES
      ? (period?.achievedTotal ?? 0)
      : (period?.branches.find((branch) => branch.id === selectedBranch)?.achievedTotal ?? 0);
  const top3AchievedTotal = entries.slice(0, 3).reduce((total, entry) => total + (entry.achievedAmount ?? 0), 0);

  const selectedBranchName =
    selectedBranch === ALL_BRANCHES
      ? "Todas as equipes"
      : (period?.branches.find((branch) => branch.id === selectedBranch)?.name ?? "Equipe");

  const teamsForCarousel = useMemo(() => {
    const teams = [{ id: ALL_BRANCHES, name: "Todas" }];
    period?.branches.forEach((branch) => teams.push({ id: branch.id, name: branch.name }));
    return teams;
  }, [period]);

  const previousScoresRef = useRef<Map<string, number> | null>(null);
  const previousOrderRef = useRef<string[]>([]);

  useEffect(() => {
    if (!settings?.soundEnabled) return;
    const previousScores = previousScoresRef.current;
    const previousOrder = previousOrderRef.current;

    if (previousScores) {
      const scoreImproved = entries.some((entry) => {
        const previous = previousScores.get(entry.id);
        return (
          previous !== undefined &&
          entry.percentAchieved !== null &&
          entry.percentAchieved > previous
        );
      });

      const currentOrder = entries.map((entry) => entry.id);
      const overtakeHappened = currentOrder.some((id, index) => {
        const previousIndex = previousOrder.indexOf(id);
        return previousIndex > 0 && previousIndex > index;
      });

      const victoryHappened = entries.some((entry) => {
        const previous = previousScores.get(entry.id);
        return previous !== undefined && previous < 100 && (entry.percentAchieved ?? 0) >= 100;
      });

      if (victoryHappened && settings.victorySoundUrl) {
        playSalesGoalSound(settings.victorySoundUrl, settings.soundVolume);
      } else if (scoreImproved && settings.scoreSoundUrl) {
        playSalesGoalSound(settings.scoreSoundUrl, settings.soundVolume);
      }
      if (overtakeHappened && settings.overtakeSoundUrl) {
        playSalesGoalSound(settings.overtakeSoundUrl, settings.soundVolume);
      }
    }

    previousScoresRef.current = new Map(entries.map((entry) => [entry.id, entry.percentAchieved ?? 0]));
    previousOrderRef.current = entries.map((entry) => entry.id);
  }, [entries, settings]);

  const prizes = (settings?.prizes ?? []).filter((prize) => prize.label.trim().length > 0);

  const handleAdjust = (entryId: string, delta: number) => {
    const entry = entries.find((item) => item.id === entryId);
    if (!entry) return;
    const nextAchieved = Math.max((entry.achievedAmount ?? 0) + delta, 0);
    upsertEntry.mutate({ entryId, achievedAmount: nextAchieved });
  };

  return (
    <NerpShell
      title={settings?.displayName ?? "Ranking de Equipes"}
      description="Metas por equipe e vendedor, importadas do Winthor."
      actions={
        <Button onClick={() => setImportOpen(true)} className="gap-2">
          <Upload className="size-4" /> Importar planilha
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Select value={periodType} onValueChange={(value) => setPeriodType(value as SalesGoalPeriodType)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {periodTabs.map((tab) => (
                <SelectItem key={tab.key} value={tab.key}>
                  {tab.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Filter className="size-3.5" /> Filtros avançados
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm">Exibir pontuação</label>
                  <Switch checked={showScore} onCheckedChange={setShowScore} />
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm">Exibir porcentagem</label>
                  <Switch checked={showPercent} onCheckedChange={setShowPercent} />
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm">Exibir valor vendido</label>
                  <Switch checked={showSoldValue} onCheckedChange={setShowSoldValue} />
                </div>
              </PopoverContent>
            </Popover>
            <Button variant="outline" size="icon" onClick={() => query.refetch()} title="Atualizar">
              <RotateCcw className="size-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => setSettingsOpen(true)} title="Configurações">
              <Settings className="size-4" />
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={toggleTvMode}>
              <Maximize2 className="size-3.5" /> Modo TV
            </Button>
          </div>
        </div>

        {query.isLoading ? (
          <div className="h-96 rounded-2xl bg-white/5 animate-pulse" />
        ) : !period ? (
          <div className="text-center py-14 text-muted-foreground">
            <p className="text-4xl mb-3">🚀</p>
            <p className="text-sm font-semibold">Nenhuma meta importada ainda</p>
            <p className="text-xs mt-1 opacity-60">
              Importe a planilha de metas do Winthor para este período.
            </p>
          </div>
        ) : (
          <div
            ref={panelRef}
            className={cn(
              "border flex flex-col gap-3",
              tvMode
                ? "fixed inset-0 z-50 rounded-none p-8 overflow-y-auto"
                : "rounded-2xl p-4",
            )}
            style={{ background: theme.podiumGradient, borderColor: theme.accent + "33" }}
          >
            {tvMode && (
              <div
                className={cn(
                  "flex justify-end transition-opacity duration-500",
                  tvControlsVisible ? "opacity-100" : "opacity-0 pointer-events-none",
                )}
              >
                <Button variant="outline" size="sm" className="gap-2" onClick={toggleTvMode}>
                  <Minimize2 className="size-3.5" /> Sair do modo TV
                </Button>
              </div>
            )}

            <div
              className={cn(
                "grid grid-cols-1 gap-4",
                tvMode ? "lg:grid-cols-[minmax(0,60%)_minmax(0,1fr)]" : "lg:grid-cols-[minmax(0,60%)_auto_minmax(0,1fr)]",
              )}
            >
              {/* Painel esquerdo: header do time + pódio */}
              <div className="flex flex-col gap-3">
                <SalesGoalTeamHeader
                  teamName={selectedBranchName}
                  subtitle="Por percentual de meta"
                  totalLabel="Total do time"
                  totalValue={formatBrl(goalTotal)}
                  top3Label="Vendido top 3"
                  top3Value={formatBrl(top3AchievedTotal)}
                  accent={theme.accent}
                />
                <SalesGoalPodium
                  entries={entries.slice(0, 3)}
                  showScore={showScore}
                  showPercent={showPercent}
                  showSoldValue={showSoldValue}
                  podiumGradient={theme.podiumGradient}
                  accent={theme.accent}
                  prizes={prizes}
                />
                <div
                  className={cn(
                    "rounded-xl border px-4 py-3 flex items-center justify-between",
                    theme.textOnDark ? "text-white" : "text-black",
                  )}
                  style={{ borderColor: theme.accent + "33", background: theme.totalCardGradient }}
                >
                  <div>
                    <p className="text-[10px] uppercase tracking-wider opacity-60">
                      {period.label ?? "Meta do período"}
                    </p>
                    <p className="text-lg font-black">{formatBrl(goalTotal)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] opacity-60">Vendido</p>
                    <p className="text-base font-bold text-emerald-400">{formatBrl(achievedTotal)}</p>
                  </div>
                </div>
              </div>

              {/* Trilho de ícones + presets de tempo — some no modo TV pra deixar limpo */}
              {!tvMode && (
                <SalesGoalSideRail
                  accent={theme.accent}
                  autoAdvanceSeconds={autoAdvanceSeconds}
                  onChangeAutoAdvance={setAutoAdvanceSeconds}
                />
              )}

              {/* Painel direito: lista em 2 colunas — @container pra reagir à
                  largura real da coluna (não ao viewport), já que o pódio
                  pode ocupar a maior parte da tela e deixar pouco espaço aqui. */}
              <div className="min-w-0 @container">
                {entries.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhuma meta cadastrada para esta equipe.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 @2xl:grid-cols-2 gap-x-2">
                    {entries.map((entry, index) => (
                      <SalesGoalRankRow
                        key={entry.id}
                        entry={entry}
                        position={index + 1}
                        showScore={showScore}
                        showPercent={showPercent}
                        showSoldValue={showSoldValue}
                        accent={theme.accent}
                        onAdjust={handleAdjust}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            <SalesGoalTeamsCarousel
              teams={teamsForCarousel}
              selectedId={selectedBranch}
              onSelect={setSelectedBranch}
              autoAdvanceSeconds={autoAdvanceSeconds}
              accent={theme.accent}
            />
          </div>
        )}
      </div>

      <SalesGoalImportDialog open={importOpen} onOpenChange={setImportOpen} />
      <SalesGoalSettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        currentPeriodType={periodType}
      />
    </NerpShell>
  );
}
