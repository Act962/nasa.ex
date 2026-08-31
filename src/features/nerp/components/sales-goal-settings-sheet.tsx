"use client";

import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowDown, ArrowUp, Loader2, Play } from "lucide-react";
import {
  useSalesGoalRankingSettings,
  useUpdateSalesGoalRankingSettings,
  useSalesGoalRanking,
  useUpdateSalesGoalBranch,
  useSalesGoalEvolution,
} from "../hooks/use-nerp-ranking";
import type { SalesGoalPeriodType } from "../lib/sales-goal-xlsx-parser";
import {
  SALES_GOAL_SOUND_PRESETS,
  playSalesGoalSound,
  type SalesGoalSoundCategory,
} from "../lib/sales-goal-sound-presets";

const PERIOD_OPTIONS: { value: SalesGoalPeriodType; label: string }[] = [
  { value: "DAILY", label: "Diário" },
  { value: "WEEKLY", label: "Semanal" },
  { value: "MONTHLY", label: "Mensal" },
  { value: "BIMONTHLY", label: "Bimestral" },
  { value: "QUARTERLY", label: "Trimestral" },
  { value: "SEMIANNUAL", label: "Semestral" },
  { value: "ANNUAL", label: "Anual" },
];

const THEME_OPTIONS = [
  { value: "GAMING", label: "Gaming", swatch: "linear-gradient(135deg,#7a1fe7,#050510)" },
  { value: "LIGHT", label: "Claro", swatch: "linear-gradient(135deg,#f8fafc,#cbd5e1)" },
  { value: "DARK", label: "Escuro", swatch: "linear-gradient(135deg,#1e293b,#020617)" },
  { value: "GALAXY", label: "Galáxia", swatch: "linear-gradient(135deg,#312e81,#701a75)" },
] as const;

const PRIZE_POSITIONS = [1, 2, 3, 4] as const;

interface Prize {
  position: number;
  label: string;
  imageUrl?: string;
}

interface SettingsDraft {
  displayName: string;
  theme: "GAMING" | "LIGHT" | "DARK" | "GALAXY";
  activePeriodTypes: SalesGoalPeriodType[];
  soundEnabled: boolean;
  scoreSoundUrl: string;
  overtakeSoundUrl: string;
  victorySoundUrl: string;
  soundVolume: number;
  prizes: Prize[];
}

function formatBrl(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const NONE_SOUND_VALUE = "__none__";
const CUSTOM_SOUND_VALUE = "__custom__";

function SoundPresetPicker({
  category,
  label,
  value,
  onChange,
  volume,
}: {
  category: SalesGoalSoundCategory;
  label: string;
  value: string;
  onChange: (value: string) => void;
  volume: number;
}) {
  const presets = SALES_GOAL_SOUND_PRESETS[category];
  const isKnownPreset = presets.some((preset) => preset.id === value);
  const isCustom = value !== "" && !isKnownPreset;
  const selectValue = value === "" ? NONE_SOUND_VALUE : isCustom ? CUSTOM_SOUND_VALUE : value;

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <Select
          value={selectValue}
          onValueChange={(next) => {
            if (next === CUSTOM_SOUND_VALUE) onChange(isCustom ? value : "https://");
            else if (next === NONE_SOUND_VALUE) onChange("");
            else onChange(next);
          }}
        >
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Nenhum" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE_SOUND_VALUE}>Nenhum</SelectItem>
            {presets.map((preset) => (
              <SelectItem key={preset.id} value={preset.id}>
                {preset.label}
              </SelectItem>
            ))}
            <SelectItem value={CUSTOM_SOUND_VALUE}>🔗 Link personalizado…</SelectItem>
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={!value}
          onClick={() => playSalesGoalSound(value, volume)}
          title="Testar som"
        >
          <Play className="size-3.5" />
        </Button>
      </div>
      {isCustom && (
        <Input
          placeholder="https://.../som.mp3"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </div>
  );
}

function TeamsTab({ periodType }: { periodType: SalesGoalPeriodType }) {
  const query = useSalesGoalRanking(periodType, undefined, true);
  const updateBranch = useUpdateSalesGoalBranch();
  const branches = query.data?.branches ?? [];

  if (query.isLoading) return <Loader2 className="size-5 animate-spin text-muted-foreground" />;
  if (branches.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhuma equipe importada ainda para este período.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">
        Renomear/reordenar aqui vale até o próximo import da planilha (que recria a equipe pelo
        nome original).
      </p>
      {branches.map((branch, index) => (
        <div key={branch.id} className="flex items-center gap-2 rounded-md border p-2">
          <div className="flex flex-col gap-1">
            <button
              className="disabled:opacity-30"
              disabled={index === 0}
              onClick={() =>
                updateBranch.mutate({ branchId: branch.id, sortOrder: index - 1 })
              }
            >
              <ArrowUp className="size-3.5" />
            </button>
            <button
              className="disabled:opacity-30"
              disabled={index === branches.length - 1}
              onClick={() =>
                updateBranch.mutate({ branchId: branch.id, sortOrder: index + 1 })
              }
            >
              <ArrowDown className="size-3.5" />
            </button>
          </div>
          <Input
            defaultValue={branch.name}
            className="flex-1"
            onBlur={(event) => {
              if (event.target.value !== branch.name) {
                updateBranch.mutate({ branchId: branch.id, name: event.target.value });
              }
            }}
          />
          <div className="flex items-center gap-1.5 shrink-0">
            <Label className="text-xs">Ativa</Label>
            <Switch
              checked={branch.isActive}
              onCheckedChange={(checked) =>
                updateBranch.mutate({ branchId: branch.id, isActive: checked })
              }
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function EvolutionTab() {
  const query = useSalesGoalEvolution();
  const points = (query.data ?? []).map((point) => ({
    name: point.label ?? new Date(point.periodStart).toLocaleDateString("pt-BR"),
    Meta: point.goalTotal,
    Vendido: point.achievedTotal,
  }));

  if (query.isLoading) return <Loader2 className="size-5 animate-spin text-muted-foreground" />;
  if (points.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem histórico suficiente ainda.</p>;
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => formatBrl(value)} width={90} />
          <Tooltip formatter={(value: number) => formatBrl(value)} />
          <Legend />
          <Line type="monotone" dataKey="Meta" stroke="#7a1fe7" strokeWidth={2} />
          <Line type="monotone" dataKey="Vendido" stroke="#10b981" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

interface SalesGoalSettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPeriodType: SalesGoalPeriodType;
}

export function SalesGoalSettingsSheet({
  open,
  onOpenChange,
  currentPeriodType,
}: SalesGoalSettingsSheetProps) {
  const settingsQuery = useSalesGoalRankingSettings();
  const updateSettings = useUpdateSalesGoalRankingSettings();

  const [draft, setDraft] = useState<SettingsDraft | null>(null);

  useEffect(() => {
    if (settingsQuery.data) {
      setDraft({
        displayName: settingsQuery.data.displayName,
        theme: settingsQuery.data.theme,
        activePeriodTypes: settingsQuery.data.activePeriodTypes,
        soundEnabled: settingsQuery.data.soundEnabled,
        scoreSoundUrl: settingsQuery.data.scoreSoundUrl ?? "",
        overtakeSoundUrl: settingsQuery.data.overtakeSoundUrl ?? "",
        victorySoundUrl: settingsQuery.data.victorySoundUrl ?? "",
        soundVolume: settingsQuery.data.soundVolume,
        prizes: settingsQuery.data.prizes,
      });
    }
  }, [settingsQuery.data]);

  const togglePeriodType = (value: SalesGoalPeriodType) => {
    setDraft((current) => {
      if (!current) return current;
      const has = current.activePeriodTypes.includes(value);
      const next = has
        ? current.activePeriodTypes.filter((item) => item !== value)
        : [...current.activePeriodTypes, value];
      return { ...current, activePeriodTypes: next.length > 0 ? next : current.activePeriodTypes };
    });
  };

  const updatePrize = (position: number, patch: Partial<Prize>) => {
    setDraft((current) => {
      if (!current) return current;
      const existing = current.prizes.find((prize) => prize.position === position);
      const nextPrize = { position, label: "", ...existing, ...patch };
      const prizes = current.prizes.filter((prize) => prize.position !== position);
      return { ...current, prizes: [...prizes, nextPrize].sort((a, b) => a.position - b.position) };
    });
  };

  const handleSave = () => {
    if (!draft) return;
    updateSettings.mutate({
      displayName: draft.displayName,
      theme: draft.theme,
      activePeriodTypes: draft.activePeriodTypes,
      soundEnabled: draft.soundEnabled,
      scoreSoundUrl: draft.scoreSoundUrl || null,
      overtakeSoundUrl: draft.overtakeSoundUrl || null,
      victorySoundUrl: draft.victorySoundUrl || null,
      soundVolume: draft.soundVolume,
      prizes: draft.prizes.filter((prize) => prize.label.trim().length > 0),
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Configurações do Ranking de Equipes</SheetTitle>
          <SheetDescription>
            Equipes, período, sons, premiações, evolução, aparência e integrações.
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-4">
          {!draft ? (
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          ) : (
            <Tabs defaultValue="teams">
              <TabsList className="w-full h-auto flex-wrap justify-start gap-1">
                <TabsTrigger value="teams">Equipes</TabsTrigger>
                <TabsTrigger value="period">Período</TabsTrigger>
                <TabsTrigger value="sound">Sons</TabsTrigger>
                <TabsTrigger value="prizes">Premiações</TabsTrigger>
                <TabsTrigger value="evolution">Evolução</TabsTrigger>
                <TabsTrigger value="appearance">Aparência</TabsTrigger>
                <TabsTrigger value="integrations">Integrações</TabsTrigger>
              </TabsList>

              <TabsContent value="teams" className="mt-4">
                <TeamsTab periodType={currentPeriodType} />
              </TabsContent>

              <TabsContent value="period" className="mt-4 space-y-2">
                <p className="text-xs text-muted-foreground mb-2">
                  Escolha quais granularidades aparecem como abas na tela de ranking.
                </p>
                {PERIOD_OPTIONS.map((option) => (
                  <div key={option.value} className="flex items-center justify-between rounded-md border p-2">
                    <Label className="text-sm">{option.label}</Label>
                    <Switch
                      checked={draft.activePeriodTypes.includes(option.value)}
                      onCheckedChange={() => togglePeriodType(option.value)}
                    />
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="sound" className="mt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Sons habilitados</Label>
                  <Switch
                    checked={draft.soundEnabled}
                    onCheckedChange={(checked) => setDraft({ ...draft, soundEnabled: checked })}
                  />
                </div>
                <SoundPresetPicker
                  category="score"
                  label="Som de pontuação (toca em qualquer alteração)"
                  value={draft.scoreSoundUrl}
                  onChange={(value) => setDraft({ ...draft, scoreSoundUrl: value })}
                  volume={draft.soundVolume}
                />
                <SoundPresetPicker
                  category="overtake"
                  label="Som de ultrapassagem (toca quando alguém sobe no ranking)"
                  value={draft.overtakeSoundUrl}
                  onChange={(value) => setDraft({ ...draft, overtakeSoundUrl: value })}
                  volume={draft.soundVolume}
                />
                <SoundPresetPicker
                  category="victory"
                  label="Som de vitória (toca quando alguém bate 100% da meta)"
                  value={draft.victorySoundUrl}
                  onChange={(value) => setDraft({ ...draft, victorySoundUrl: value })}
                  volume={draft.soundVolume}
                />
                <p className="text-[11px] text-muted-foreground">
                  Os presets acima são sons sintetizados (sem áudio externo). Se quiser um link
                  próprio, escolha "Link personalizado…" e cole a URL — só use áudio que vocês
                  tenham direito de usar (não incluímos trilhas oficiais de F1 nem hinos de
                  pilotos por padrão, são protegidos por direitos autorais).
                </p>
                <div className="space-y-1.5">
                  <Label className="text-xs">Volume ({Math.round(draft.soundVolume * 100)}%)</Label>
                  <Slider
                    value={[draft.soundVolume * 100]}
                    max={100}
                    step={5}
                    onValueChange={([value]) => setDraft({ ...draft, soundVolume: value / 100 })}
                  />
                </div>
              </TabsContent>

              <TabsContent value="prizes" className="mt-4 space-y-2">
                <p className="text-xs text-muted-foreground mb-2">
                  Premiação exibida acima do pódio pra 1º–4º colocado (ex: "R$100 iFood", "Folga
                  remunerada").
                </p>
                {PRIZE_POSITIONS.map((position) => {
                  const prize = draft.prizes.find((item) => item.position === position);
                  return (
                    <div key={position} className="flex items-center gap-2">
                      <span className="w-6 text-sm font-bold text-muted-foreground shrink-0">
                        {position}º
                      </span>
                      <Input
                        placeholder="Ex: R$100 iFood"
                        value={prize?.label ?? ""}
                        onChange={(event) => updatePrize(position, { label: event.target.value })}
                      />
                    </div>
                  );
                })}
              </TabsContent>

              <TabsContent value="evolution" className="mt-4">
                <EvolutionTab />
              </TabsContent>

              <TabsContent value="appearance" className="mt-4">
                <div className="grid grid-cols-2 gap-3">
                  {THEME_OPTIONS.map((theme) => (
                    <button
                      key={theme.value}
                      onClick={() => setDraft({ ...draft, theme: theme.value })}
                      className={`rounded-lg border-2 p-3 text-left transition-all ${
                        draft.theme === theme.value ? "border-[#7a1fe7]" : "border-transparent"
                      }`}
                    >
                      <div
                        className="h-12 w-full rounded-md mb-2"
                        style={{ background: theme.swatch }}
                      />
                      <p className="text-sm font-semibold">{theme.label}</p>
                    </button>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="integrations" className="mt-4 space-y-3">
                <div className="rounded-lg border p-3">
                  <p className="text-sm font-semibold">Fase 1 — Import manual (ativo)</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Os dados de meta e venda vêm de planilhas exportadas do Winthor (Totvs),
                    importadas manualmente na aba "Importar planilha".
                  </p>
                </div>
                <div className="rounded-lg border border-dashed p-3">
                  <p className="text-sm font-semibold">Fase 2 — Conector direto (em breve)</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Conexão direta ao banco do Winthor (ou outro ERP) via credenciais cifradas,
                    preenchendo "venda realizada" automaticamente por cron. Ainda não
                    disponível nesta organização.
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>

        <SheetFooter>
          <Button onClick={handleSave} disabled={!draft || updateSettings.isPending}>
            {updateSettings.isPending && <Loader2 className="size-4 animate-spin mr-1" />}
            Salvar alterações
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
