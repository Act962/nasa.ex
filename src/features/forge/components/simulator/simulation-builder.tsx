"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Plus, Sparkles, Trash2, Wand2 } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { FALLBACK_USD_TO_BRL, formatBrl, formatTokens } from "@/features/ia/lib/token-pricing";
import {
  computeSimulation,
  computeBid,
  type CostSimulatorInput,
  type BidSimulatorInput,
  type PriceCategory,
  type PriceCurrency,
  type PriceUnit,
  type WhatsappCategory,
} from "@/features/forge/lib/cost-simulator";
import {
  estimateUsage,
  recommendModel,
  recommendInfra,
  planHint,
  COMPLEXITY_LABEL,
  RESPONSE_LABEL,
  type TaskComplexity,
  type ResponseSize,
  type MessageSample,
} from "@/features/forge/lib/recommendation";
import { useForgePriceItems } from "@/features/forge/hooks/use-forge-price-catalog";
import {
  useForgeSimulation,
  useCreateForgeSimulation,
  useUpdateForgeSimulation,
  useConvertSimulationToProposal,
} from "@/features/forge/hooks/use-forge-simulations";
import { useForgeSettings } from "@/features/forge/hooks/use-forge";
import { CommercialResultsTable, BidResultsTable } from "./results-table";
import { PriceItemModal } from "./price-item-modal";

type Mode = "COMERCIAL" | "LICITACAO";

interface PriceItem {
  id: string;
  category: PriceCategory;
  name: string;
  code: string | null;
  provider: string | null;
  currency: PriceCurrency;
  unit: PriceUnit;
  unitPrice: string | null;
  inputPer1k: string | null;
  outputPer1k: string | null;
  cachedInputPer1k: string | null;
}

interface BidRow {
  code: string;
  parentCode: string;
  description: string;
  unit: string;
  quantity: number;
  internalUnitCostBrl: number;
  markupPercentage: string;
  ceilingUnitBrl: string;
  priceItemId: string;
}

const num = (value: string | number | null | undefined): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const round2 = (value: number) => Math.round(value * 100) / 100;

type Validity = "MENSAL" | "ANUAL" | "UNICA";
const VALIDITY_MONTHS: Record<Validity, number> = { MENSAL: 1, ANUAL: 12, UNICA: 1 };
const VALIDITY_LABEL: Record<Validity, string> = {
  MENSAL: "1 mês",
  ANUAL: "1 ano (12 meses)",
  UNICA: "Única vez",
};

type FeePeriod = "UNICA" | "MENSAL" | "DIARIA" | "PERIODO";

const FEE_PERIOD_LABEL: Record<FeePeriod, string> = {
  UNICA: "Única",
  MENSAL: "Mensal",
  DIARIA: "Diária",
  PERIODO: "Definir período",
};

// Converte um valor + periodicidade em quanto entra por mês e quanto é cobrança
// única. DIARIA vira mensal (× dias); PERIODO vira único (× nº de períodos).
function feeContribution(
  value: number,
  period: FeePeriod,
  daysPerMonth: number,
  quantity = 1,
): { monthly: number; once: number } {
  if (value <= 0) return { monthly: 0, once: 0 };
  if (period === "MENSAL") return { monthly: value, once: 0 };
  if (period === "DIARIA") return { monthly: value * daysPerMonth, once: 0 };
  if (period === "PERIODO") return { monthly: 0, once: value * Math.max(quantity, 1) };
  return { monthly: 0, once: value };
}

const findByCode = (items: PriceItem[], code: string) => items.find((item) => item.code === code);

const optionLabel = (item: PriceItem) => {
  const hint = planHint(item.code);
  const provider = item.provider ? ` · ${item.provider}` : "";
  return `${item.name}${provider}${hint ? ` (${hint})` : ""}`;
};

export function SimulationBuilder({
  simulationId,
  onClose,
}: {
  simulationId?: string;
  onClose: () => void;
}) {
  const { data: catalog } = useForgePriceItems({ activeOnly: true });
  const { data: settingsData } = useForgeSettings();
  const { data: existing } = useForgeSimulation(simulationId, { enabled: Boolean(simulationId) });

  const createMutation = useCreateForgeSimulation();
  const updateMutation = useUpdateForgeSimulation();
  const convertMutation = useConvertSimulationToProposal();

  const items = (catalog?.items ?? []) as unknown as PriceItem[];
  const itemsById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const aiItems = items.filter((item) => item.category === "AI_MODEL");
  const whatsappItems = items.filter((item) => item.category === "WHATSAPP_CONVERSATION");
  const serverItems = items.filter((item) => ["INFRA_SERVER", "HOSTING"].includes(item.category));
  const dbItems = items.filter((item) => item.category === "DATABASE");
  const storageItems = items.filter((item) => item.category === "STORAGE");
  const extraItems = items.filter((item) => ["LABOR", "OTHER", "HOSTING"].includes(item.category));
  const costCatalogItems = items.filter(
    (item) => item.category !== "AI_MODEL" && item.unitPrice != null,
  );

  const [savedId, setSavedId] = useState<string | undefined>(simulationId);
  const [name, setName] = useState("Nova simulação");
  const [mode, setMode] = useState<Mode>("COMERCIAL");
  const [markup, setMarkup] = useState("40");
  const [taxRate, setTaxRate] = useState("0");
  const [validity, setValidity] = useState<Validity>("ANUAL");
  const [showInternal, setShowInternal] = useState(true);
  const [advanced, setAdvanced] = useState(false);

  // Perfil de uso
  const [aiEnabled, setAiEnabled] = useState(true);
  const [userCount, setUserCount] = useState(100);
  const [daysPerMonth, setDaysPerMonth] = useState(22);
  const [samples, setSamples] = useState<MessageSample[]>([
    { text: "Quantos alunos estão matriculados até hoje no 6º ano?", perUserPerDay: 3 },
  ]);
  const [complexity, setComplexity] = useState<TaskComplexity>("PADRAO");
  const [responseSize, setResponseSize] = useState<ResponseSize>("CURTA");

  // Infra (escolhível, pré-preenchida com a recomendação)
  const [serverId, setServerId] = useState("");
  const [dbId, setDbId] = useState("");
  const [storageId, setStorageId] = useState("");
  const [storageQty, setStorageQty] = useState(1);
  const [extraOps, setExtraOps] = useState<{ priceItemId: string; quantity: number }[]>([]);
  const [extraPick, setExtraPick] = useState("");

  // WhatsApp — mensagens por usuário/mês, por categoria (cobrança por mensagem)
  const [whatsappUsage, setWhatsappUsage] = useState<Record<string, number>>({});

  // Cobranças adicionais ao cliente (fora do cálculo de uso/margem)
  const [setupValue, setSetupValue] = useState(0);
  const [setupPeriod, setSetupPeriod] = useState<FeePeriod>("UNICA");
  const [trainValue, setTrainValue] = useState(0);
  const [trainPeriod, setTrainPeriod] = useState<FeePeriod>("UNICA");
  const [trainQty, setTrainQty] = useState(1);

  const [customCostOpen, setCustomCostOpen] = useState(false);

  // Overrides de IA
  const [overrideAiId, setOverrideAiId] = useState("");
  const [overrideInput, setOverrideInput] = useState<number | null>(null);
  const [overrideOutput, setOverrideOutput] = useState<number | null>(null);

  // Licitação
  const [bidOrg, setBidOrg] = useState("");
  const [bidNumber, setBidNumber] = useState("");
  const [contractMonths, setContractMonths] = useState(12);
  const [ceilingTotal, setCeilingTotal] = useState("");
  const [bidRows, setBidRows] = useState<BidRow[]>([]);

  const applyInfraRecommendation = (users: number) => {
    const rec = recommendInfra(users);
    const pick = (category: string) => {
      const found = rec.find((entry) => entry.category === category);
      const item = found ? findByCode(items, found.code) : undefined;
      return { id: item?.id ?? "", qty: found?.quantity ?? 1 };
    };
    setServerId(pick("INFRA_SERVER").id);
    setDbId(pick("DATABASE").id);
    const storage = pick("STORAGE");
    setStorageId(storage.id);
    setStorageQty(storage.qty);
  };

  useEffect(() => {
    if (!simulationId && settingsData?.settings?.commissionPercentage) {
      const value = Number(settingsData.settings.commissionPercentage);
      if (value > 0) setMarkup(String(value));
    }
  }, [simulationId, settingsData]);

  // Semeia a infra recomendada uma vez (simulação nova).
  useEffect(() => {
    if (simulationId || items.length === 0 || serverId || dbId || storageId) return;
    applyInfraRecommendation(userCount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, simulationId]);

  // Prefill ao editar — reconstrói infra e WhatsApp a partir do salvo.
  useEffect(() => {
    const sim = existing?.simulation;
    if (!sim) return;
    setSavedId(sim.id);
    setName(sim.name);
    setMode(sim.mode);
    setMarkup(String(sim.markupPercentage ?? "0"));
    setUserCount(sim.userCount ?? 100);

    if (sim.mode === "COMERCIAL") {
      setAdvanced(true);
      setOverrideAiId(sim.aiPriceItemId ?? "");
      setOverrideInput(sim.inputTokensPerUser ?? 0);
      setOverrideOutput(sim.outputTokensPerUser ?? 0);

      const opsLines = (Array.isArray(sim.lineItems) ? sim.lineItems : []).filter(
        (line: Record<string, unknown>) => line.priceItemId,
      );
      const findLine = (cats: string[]) =>
        opsLines.find((line: Record<string, unknown>) => cats.includes(String(line.category)));
      setServerId(String(findLine(["INFRA_SERVER", "HOSTING"])?.priceItemId ?? ""));
      setDbId(String(findLine(["DATABASE"])?.priceItemId ?? ""));
      const storageLine = findLine(["STORAGE"]);
      setStorageId(String(storageLine?.priceItemId ?? ""));
      setStorageQty(num(storageLine?.quantity as string) || 1);
      setExtraOps(
        opsLines
          .filter((line: Record<string, unknown>) => ["LABOR", "OTHER"].includes(String(line.category)))
          .map((line: Record<string, unknown>) => ({
            priceItemId: String(line.priceItemId),
            quantity: num(line.quantity as string),
          })),
      );

      if (Array.isArray(sim.whatsappMix)) {
        const usage: Record<string, number> = {};
        for (const line of sim.whatsappMix as { priceItemId: string; conversationsPerUser: number }[]) {
          usage[line.priceItemId] = line.conversationsPerUser;
        }
        setWhatsappUsage(usage);
      }
    }

    setBidOrg(sim.bidOrg ?? "");
    setBidNumber(sim.bidNumber ?? "");
    setContractMonths(sim.contractMonths ?? 12);
    setCeilingTotal(sim.ceilingTotalBrl ? String(sim.ceilingTotalBrl) : "");
    if (Array.isArray(sim.bidItems)) {
      const idToCode = new Map<string, string>(
        sim.bidItems.map((item: Record<string, unknown>) => [String(item.id), String(item.code ?? "")]),
      );
      setBidRows(
        sim.bidItems.map((item: Record<string, unknown>) => ({
          code: String(item.code ?? ""),
          parentCode: item.parentId ? idToCode.get(String(item.parentId)) ?? "" : "",
          description: String(item.description ?? ""),
          unit: String(item.unit ?? "SV"),
          quantity: num(item.quantity as string),
          internalUnitCostBrl: num(item.internalUnitCostBrl as string),
          markupPercentage: item.markupPercentage != null ? String(item.markupPercentage) : "",
          ceilingUnitBrl: item.ceilingUnitBrl != null ? String(item.ceilingUnitBrl) : "",
          priceItemId: String(item.priceItemId ?? ""),
        })),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing]);

  const rate = FALLBACK_USD_TO_BRL;

  const estimate = useMemo(
    () => estimateUsage({ userCount, daysPerMonth, samples, complexity, responseSize }),
    [userCount, daysPerMonth, samples, complexity, responseSize],
  );
  const modelRec = useMemo(() => recommendModel(complexity), [complexity]);
  const recommendedAiItem = findByCode(aiItems, modelRec.modelId);
  const effectiveAiItem = overrideAiId ? itemsById.get(overrideAiId) : recommendedAiItem;
  const effectiveInput = overrideInput ?? estimate.inputTokensPerUser;
  const effectiveOutput = overrideOutput ?? estimate.outputTokensPerUser;

  const operationalLines = useMemo(() => {
    const lines: { priceItemId: string; quantity: number }[] = [];
    if (serverId) lines.push({ priceItemId: serverId, quantity: 1 });
    if (dbId) lines.push({ priceItemId: dbId, quantity: 1 });
    if (storageId) lines.push({ priceItemId: storageId, quantity: storageQty });
    return [...lines, ...extraOps];
  }, [serverId, dbId, storageId, storageQty, extraOps]);

  const whatsappLines = useMemo(() => {
    return whatsappItems.flatMap((item) => {
      const messagesPerUser = whatsappUsage[item.id] ?? 0;
      if (messagesPerUser <= 0) return [];
      return [
        {
          category: (item.code ?? "SERVICE") as WhatsappCategory,
          pricePerConversation: num(item.unitPrice),
          currency: item.currency,
          conversationsPerUser: messagesPerUser,
        },
      ];
    });
  }, [whatsappItems, whatsappUsage]);

  const commercialResult = useMemo(() => {
    const input: CostSimulatorInput = {
      userCount,
      markupPercentage: num(markup),
      usdToBrlRate: rate,
      ai:
        aiEnabled && effectiveAiItem
          ? {
              modelCode: effectiveAiItem.code ?? effectiveAiItem.name,
              inputPer1kUsd: num(effectiveAiItem.inputPer1k),
              outputPer1kUsd: num(effectiveAiItem.outputPer1k),
              cachedInputPer1kUsd: effectiveAiItem.cachedInputPer1k
                ? num(effectiveAiItem.cachedInputPer1k)
                : undefined,
              inputTokensPerUser: effectiveInput,
              outputTokensPerUser: effectiveOutput,
              cachedTokensPerUser: 0,
            }
          : null,
      whatsapp: whatsappLines,
      operational: operationalLines.flatMap((line) => {
        const item = itemsById.get(line.priceItemId);
        if (!item) return [];
        return [
          {
            priceItemId: item.id,
            category: item.category,
            label: item.name,
            unit: item.unit,
            unitPrice: num(item.unitPrice),
            currency: item.currency,
            quantity: line.quantity,
          },
        ];
      }),
    };
    return computeSimulation(input);
  }, [
    aiEnabled,
    userCount,
    markup,
    rate,
    effectiveAiItem,
    effectiveInput,
    effectiveOutput,
    whatsappLines,
    operationalLines,
    itemsById,
  ]);

  const bidResult = useMemo(() => {
    const input: BidSimulatorInput = {
      contractMonths,
      markupPercentage: num(markup),
      ceilingTotalBrl: ceilingTotal ? num(ceilingTotal) : null,
      items: bidRows.map((row, index) => ({
        code: row.code || String(index + 1),
        parentCode: row.parentCode || null,
        description: row.description,
        unit: row.unit,
        quantity: row.quantity,
        internalUnitCostBrl: row.internalUnitCostBrl,
        markupPercentage: row.markupPercentage ? num(row.markupPercentage) : null,
        ceilingUnitBrl: row.ceilingUnitBrl ? num(row.ceilingUnitBrl) : null,
        priceItemId: row.priceItemId || null,
        order: index,
      })),
    };
    return computeBid(input);
  }, [contractMonths, markup, ceilingTotal, bidRows]);

  const setupFee = feeContribution(setupValue, setupPeriod, daysPerMonth);
  const trainFee = feeContribution(trainValue, trainPeriod, daysPerMonth, trainQty);

  const monthlyFees: { label: string; amount: number }[] = [];
  const oneTimeFees: { label: string; amount: number }[] = [];
  if (setupFee.monthly > 0) monthlyFees.push({ label: `Setup (${FEE_PERIOD_LABEL[setupPeriod]})`, amount: setupFee.monthly });
  if (setupFee.once > 0) oneTimeFees.push({ label: `Setup (${FEE_PERIOD_LABEL[setupPeriod]})`, amount: setupFee.once });
  if (trainFee.monthly > 0) monthlyFees.push({ label: `Treinamento (${FEE_PERIOD_LABEL[trainPeriod]})`, amount: trainFee.monthly });
  if (trainFee.once > 0) oneTimeFees.push({ label: `Treinamento (${FEE_PERIOD_LABEL[trainPeriod]})`, amount: trainFee.once });

  const feeMonthly = monthlyFees.reduce((total, fee) => total + fee.amount, 0);
  const feeOneTime = oneTimeFees.reduce((total, fee) => total + fee.amount, 0);

  const taxRateNum = num(taxRate);
  const monthlySubtotal = commercialResult.clientPriceBrl + feeMonthly;
  const monthlyTax = round2((monthlySubtotal * taxRateNum) / 100);
  const oneTimeTax = round2((feeOneTime * taxRateNum) / 100);
  const termMonths = VALIDITY_MONTHS[validity];

  function buildPayload() {
    const whatsapp = Object.entries(whatsappUsage)
      .filter(([, messages]) => messages > 0)
      .map(([priceItemId, messages]) => ({ priceItemId, conversationsPerUser: messages }));
    return {
      name,
      mode,
      markupPercentage: num(markup),
      userCount,
      aiPriceItemId: aiEnabled ? effectiveAiItem?.id ?? null : null,
      inputTokensPerUser: aiEnabled ? effectiveInput : 0,
      outputTokensPerUser: aiEnabled ? effectiveOutput : 0,
      cachedTokensPerUser: 0,
      whatsappEnabled: whatsapp.length > 0,
      whatsapp,
      operational: operationalLines,
      bidOrg: bidOrg || null,
      bidNumber: bidNumber || null,
      contractMonths,
      ceilingTotalBrl: ceilingTotal ? num(ceilingTotal) : null,
      bidItems: bidRows.map((row, index) => ({
        code: row.code || String(index + 1),
        parentCode: row.parentCode || null,
        description: row.description || `Item ${index + 1}`,
        unit: row.unit || "SV",
        quantity: row.quantity,
        internalUnitCostBrl: row.internalUnitCostBrl,
        markupPercentage: row.markupPercentage ? num(row.markupPercentage) : null,
        ceilingUnitBrl: row.ceilingUnitBrl ? num(row.ceilingUnitBrl) : null,
        priceItemId: row.priceItemId || null,
        order: index,
      })),
    };
  }

  async function handleSave(): Promise<string | undefined> {
    const payload = buildPayload();
    try {
      if (savedId) {
        await updateMutation.mutateAsync({ ...payload, id: savedId } as never);
        toast.success("Simulação atualizada");
        return savedId;
      }
      const created = await createMutation.mutateAsync(payload as never);
      setSavedId(created.id);
      toast.success("Simulação salva");
      return created.id;
    } catch {
      toast.error("Não foi possível salvar a simulação");
      return undefined;
    }
  }

  async function handleConvert() {
    const id = await handleSave();
    if (!id) return;
    try {
      const recurring = [
        { label: "Assinatura ÓRBITA — uso recorrente", monthly: commercialResult.clientPriceBrl },
        ...monthlyFees.map((fee) => ({ label: fee.label, monthly: fee.amount })),
      ];
      if (monthlyTax > 0) recurring.push({ label: `Impostos (${taxRateNum}%)`, monthly: monthlyTax });
      const oneTime = [
        ...oneTimeFees.map((fee) => ({ label: fee.label, amount: fee.amount })),
      ];
      if (oneTimeTax > 0) oneTime.push({ label: `Impostos (${taxRateNum}%) sobre única`, amount: oneTimeTax });

      const result = await convertMutation.mutateAsync({
        simulationId: id,
        breakdown:
          mode === "COMERCIAL"
            ? { recurring, oneTime, termMonths, validityLabel: VALIDITY_LABEL[validity] }
            : undefined,
      } as never);
      toast.success(`Proposta #${result.number} gerada`);
      onClose();
    } catch {
      toast.error("Não foi possível gerar a proposta");
    }
  }

  const saving = createMutation.isPending || updateMutation.isPending;

  const updateSample = (index: number, patch: Partial<MessageSample>) => {
    const next = [...samples];
    next[index] = { ...next[index], ...patch };
    setSamples(next);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="size-8" onClick={onClose}>
            <ArrowLeft className="size-4" />
          </Button>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="h-9 w-72 font-semibold"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowInternal((prev) => !prev)}>
            {showInternal ? "Ocultar custo interno" : "Ver custo interno"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleSave}
            disabled={saving}
            className="border-[#7C3AED] text-[#7C3AED]"
          >
            Salvar
          </Button>
          <Button
            size="sm"
            onClick={handleConvert}
            disabled={saving || convertMutation.isPending}
            className="bg-[#7C3AED] hover:bg-[#6D28D9]"
          >
            Gerar proposta
          </Button>
        </div>
      </div>

      <div className="inline-flex rounded-lg border p-1">
        {(["COMERCIAL", "LICITACAO"] as Mode[]).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setMode(option)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium ${
              mode === option ? "bg-[#7C3AED] text-white" : "text-muted-foreground"
            }`}
          >
            {option === "COMERCIAL" ? "Comercial" : "Licitação"}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-5">
          <SliderInput
            label="Margem de lucro (% sobre o preço)"
            value={num(markup)}
            onChange={(value) => setMarkup(String(value))}
            min={0}
            max={90}
            step={5}
            suffix="%"
          />

          {mode === "COMERCIAL" && (
            <SliderInput
              label="Quantidade de usuários"
              value={userCount}
              onChange={setUserCount}
              min={0}
              max={20000}
              step={100}
              hint={
                <p className="text-sm font-semibold text-[#7C3AED]">
                  {formatBrl(commercialResult.clientPriceBrl + feeMonthly)}{" "}
                  <span className="text-xs font-normal text-muted-foreground">/ mês ao cliente</span>
                  {feeOneTime > 0 ? (
                    <span className="text-xs font-normal text-muted-foreground">
                      {" "}+ {formatBrl(feeOneTime)} única
                    </span>
                  ) : null}
                </p>
              }
            />
          )}

          {mode === "LICITACAO" ? (
            <BidInputs
              bidOrg={bidOrg}
              setBidOrg={setBidOrg}
              bidNumber={bidNumber}
              setBidNumber={setBidNumber}
              contractMonths={contractMonths}
              setContractMonths={setContractMonths}
              ceilingTotal={ceilingTotal}
              setCeilingTotal={setCeilingTotal}
              bidRows={bidRows}
              setBidRows={setBidRows}
              costItems={costCatalogItems}
              rate={rate}
              onNewCost={() => setCustomCostOpen(true)}
            />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Impostos (%)">
                  <Input
                    type="number"
                    value={taxRate}
                    onChange={(event) => setTaxRate(event.target.value)}
                    className="h-9"
                  />
                </Field>
                <Field label="Vigência da proposta">
                  <Select value={validity} onValueChange={(value) => setValidity(value as Validity)}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(VALIDITY_LABEL) as Validity[]).map((key) => (
                        <SelectItem key={key} value={key}>
                          {VALIDITY_LABEL[key]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <Field label="Dias de uso / mês">
                <Input
                  type="number"
                  value={daysPerMonth}
                  onChange={(event) => setDaysPerMonth(Number(event.target.value))}
                  className="h-9 w-32"
                />
              </Field>

              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Usar IA na solução</Label>
                <Switch checked={aiEnabled} onCheckedChange={setAiEnabled} />
              </div>

              {aiEnabled && (
                <>
              <Separator />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Exemplos de mensagem</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSamples([...samples, { text: "", perUserPerDay: 1 }])}
                  >
                    <Plus className="mr-1 size-4" /> Exemplo
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Escreva mensagens típicas e quantas por dia. O sistema estima os tokens sozinho.
                </p>
                {samples.map((sample, index) => (
                  <div key={index} className="grid grid-cols-[1fr_84px_32px] items-start gap-2">
                    <Input
                      placeholder="Ex.: Quantos alunos no 6º ano?"
                      value={sample.text}
                      onChange={(event) => updateSample(index, { text: event.target.value })}
                      className="h-9"
                    />
                    <Input
                      type="number"
                      title="por usuário / dia"
                      value={sample.perUserPerDay}
                      onChange={(event) => updateSample(index, { perUserPerDay: Number(event.target.value) })}
                      className="h-9"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => setSamples(samples.filter((_, position) => position !== index))}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <Field label="Tipo de tarefa">
                <Select value={complexity} onValueChange={(value) => setComplexity(value as TaskComplexity)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(COMPLEXITY_LABEL) as TaskComplexity[]).map((key) => (
                      <SelectItem key={key} value={key}>
                        {COMPLEXITY_LABEL[key]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Tamanho da resposta">
                <Select value={responseSize} onValueChange={(value) => setResponseSize(value as ResponseSize)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(RESPONSE_LABEL) as ResponseSize[]).map((key) => (
                      <SelectItem key={key} value={key}>
                        {RESPONSE_LABEL[key]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                <div className="mb-1 flex items-center gap-1.5 font-medium text-[#7C3AED]">
                  <Sparkles className="size-4" /> Estimativa de IA
                </div>
                Plano {modelRec.tierLabel} · ≈{" "}
                {formatTokens(estimate.inputTokensPerUser + estimate.outputTokensPerUser)} tokens/mês por
                usuário ({estimate.messagesPerUserPerDay} msg/dia).
              </div>
                </>
              )}

              <Separator />

              {/* Infra escolhível */}
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Infraestrutura</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-[#7C3AED]"
                  onClick={() => applyInfraRecommendation(userCount)}
                >
                  <Wand2 className="mr-1 size-4" /> Sugerir pelo uso
                </Button>
              </div>
              <Field label="Servidor">
                <PickSelect items={serverItems} value={serverId} onChange={setServerId} placeholder="Escolha o servidor" />
              </Field>
              <Field label="Banco de dados">
                <PickSelect items={dbItems} value={dbId} onChange={setDbId} placeholder="Escolha o banco" />
              </Field>
              <div className="grid grid-cols-[1fr_100px] gap-3">
                <Field label="Storage">
                  <PickSelect items={storageItems} value={storageId} onChange={setStorageId} placeholder="Escolha o storage" />
                </Field>
                <Field label="GB">
                  <Input
                    type="number"
                    value={storageQty}
                    onChange={(event) => setStorageQty(Number(event.target.value))}
                    className="h-9"
                  />
                </Field>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Outros custos (mão de obra, serviços)</Label>
                  <button
                    type="button"
                    className="text-xs font-medium text-[#7C3AED]"
                    onClick={() => setCustomCostOpen(true)}
                  >
                    + Novo custo (salva na org)
                  </button>
                </div>
                <div className="flex gap-2">
                  <PickSelect items={extraItems} value={extraPick} onChange={setExtraPick} placeholder="Buscar item" />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-9 shrink-0"
                    onClick={() => {
                      if (!extraPick || extraOps.some((line) => line.priceItemId === extraPick)) return;
                      setExtraOps([...extraOps, { priceItemId: extraPick, quantity: 1 }]);
                      setExtraPick("");
                    }}
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
              </div>
              {extraOps.map((line, index) => {
                const item = itemsById.get(line.priceItemId);
                return (
                  <div key={line.priceItemId} className="grid grid-cols-[1fr_90px_32px] items-center gap-2">
                    <span className="text-sm">{item?.name ?? line.priceItemId}</span>
                    <Input
                      type="number"
                      value={line.quantity}
                      onChange={(event) => {
                        const next = [...extraOps];
                        next[index] = { ...line, quantity: Number(event.target.value) };
                        setExtraOps(next);
                      }}
                      className="h-9"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => setExtraOps(extraOps.filter((_, position) => position !== index))}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                );
              })}

              <Separator />

              {/* WhatsApp — por categoria, cobrança por mensagem */}
              <Label className="text-sm font-medium">Mensagens via WhatsApp oficial</Label>
              <p className="text-xs text-muted-foreground">
                Cobrança <strong>por mensagem</strong> (Meta). Informe quantas <strong>mensagens por
                usuário, por mês</strong> em cada categoria. Valores oficiais Brasil/BRL.
              </p>
              <div className="space-y-2">
                {whatsappItems.map((item) => (
                  <div key={item.id} className="flex items-end justify-between gap-3">
                    <div>
                      <div className="text-sm">{item.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {num(item.unitPrice) > 0 ? `${formatBrl(num(item.unitPrice))}/msg` : "grátis"}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">msgs/usuário · mês</Label>
                      <Input
                        type="number"
                        value={whatsappUsage[item.id] ?? ""}
                        onChange={(event) =>
                          setWhatsappUsage({ ...whatsappUsage, [item.id]: Number(event.target.value) })
                        }
                        className="h-9 w-28"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <Separator />

              {/* Cobranças adicionais: Setup e Treinamento */}
              <Label className="text-sm font-medium">Cobranças adicionais</Label>
              <FeeRow
                label="Setup / Implantação"
                value={setupValue}
                setValue={setSetupValue}
                period={setupPeriod}
                setPeriod={setSetupPeriod}
              />
              <FeeRow
                label="Treinamento"
                value={trainValue}
                setValue={setTrainValue}
                period={trainPeriod}
                setPeriod={setTrainPeriod}
                quantity={trainQty}
                setQuantity={setTrainQty}
                allowPeriodo
              />

              <Separator />

              {aiEnabled && (
                <button
                  type="button"
                  className="text-xs font-medium text-[#7C3AED]"
                  onClick={() => setAdvanced(!advanced)}
                >
                  {advanced ? "Ocultar ajustes de IA" : "Ajustes avançados de IA (modelo e tokens)"}
                </button>
              )}
              {aiEnabled && advanced && (
                <div className="space-y-4 rounded-lg border p-3">
                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="text-xs font-medium text-[#7C3AED]"
                      onClick={() => setCustomCostOpen(true)}
                    >
                      + Novo custo (salva na org)
                    </button>
                  </div>
                  <Field label="Modelo de IA (sobrescreve a recomendação)">
                    <Select value={overrideAiId} onValueChange={setOverrideAiId}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder={`Recomendado: ${modelRec.modelId}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {aiItems.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name} {item.provider ? `· ${item.provider}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Tokens entrada / usuário (mês)">
                      <Input
                        type="number"
                        value={effectiveInput}
                        onChange={(event) => setOverrideInput(Number(event.target.value))}
                        className="h-9"
                      />
                    </Field>
                    <Field label="Tokens saída / usuário (mês)">
                      <Input
                        type="number"
                        value={effectiveOutput}
                        onChange={(event) => setOverrideOutput(Number(event.target.value))}
                        className="h-9"
                      />
                    </Field>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div>
          {mode === "COMERCIAL" ? (
            <CommercialResultsTable
              result={commercialResult}
              showInternal={showInternal}
              monthlyFees={monthlyFees}
              oneTimeFees={oneTimeFees}
              taxRate={taxRateNum}
              termMonths={termMonths}
              validityLabel={VALIDITY_LABEL[validity]}
            />
          ) : (
            <BidResultsTable result={bidResult} showInternal={showInternal} />
          )}
        </div>
      </div>

      <PriceItemModal open={customCostOpen} onOpenChange={setCustomCostOpen} item={null} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function SliderInput({
  label,
  value,
  onChange,
  min,
  max,
  step,
  suffix,
  hint,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  hint?: React.ReactNode;
}) {
  const clamped = Math.min(Math.max(value, min), max);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <div className="flex items-center gap-1">
          <Input
            type="number"
            value={value}
            onChange={(event) => onChange(Number(event.target.value))}
            className="h-8 w-28 text-right"
          />
          {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
        </div>
      </div>
      <Slider
        value={[clamped]}
        min={min}
        max={max}
        step={step}
        onValueChange={(next) => onChange(next[0])}
        className="py-1"
      />
      {hint}
    </div>
  );
}

function FeeRow({
  label,
  value,
  setValue,
  period,
  setPeriod,
  quantity,
  setQuantity,
  allowPeriodo,
}: {
  label: string;
  value: number;
  setValue: (value: number) => void;
  period: FeePeriod;
  setPeriod: (value: FeePeriod) => void;
  quantity?: number;
  setQuantity?: (value: number) => void;
  allowPeriodo?: boolean;
}) {
  const periods: FeePeriod[] = allowPeriodo
    ? ["UNICA", "MENSAL", "DIARIA", "PERIODO"]
    : ["UNICA", "MENSAL", "DIARIA"];
  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-[1fr_130px] items-end gap-2">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{label} (R$)</Label>
          <Input
            type="number"
            value={value}
            onChange={(event) => setValue(Number(event.target.value))}
            className="h-9"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Periodicidade</Label>
          <Select value={period} onValueChange={(next) => setPeriod(next as FeePeriod)}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {periods.map((option) => (
                <SelectItem key={option} value={option}>
                  {FEE_PERIOD_LABEL[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {period === "PERIODO" && setQuantity && (
        <div className="grid grid-cols-[1fr_130px] gap-2">
          <div />
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Nº de períodos</Label>
            <Input
              type="number"
              value={quantity ?? 1}
              onChange={(event) => setQuantity(Number(event.target.value))}
              className="h-8"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function PickSelect({
  items,
  value,
  onChange,
  placeholder,
}: {
  items: PriceItem[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.id} value={item.id}>
            {optionLabel(item)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function BidInputs(props: {
  bidOrg: string;
  setBidOrg: (value: string) => void;
  bidNumber: string;
  setBidNumber: (value: string) => void;
  contractMonths: number;
  setContractMonths: (value: number) => void;
  ceilingTotal: string;
  setCeilingTotal: (value: string) => void;
  bidRows: BidRow[];
  setBidRows: (value: BidRow[]) => void;
  costItems: PriceItem[];
  rate: number;
  onNewCost: () => void;
}) {
  const {
    bidOrg,
    setBidOrg,
    bidNumber,
    setBidNumber,
    contractMonths,
    setContractMonths,
    ceilingTotal,
    setCeilingTotal,
    bidRows,
    setBidRows,
    costItems,
    rate,
    onNewCost,
  } = props;

  const updateRow = (index: number, patch: Partial<BidRow>) => {
    const next = [...bidRows];
    next[index] = { ...next[index], ...patch };
    setBidRows(next);
  };

  const applyCatalogCost = (index: number, priceItemId: string) => {
    const item = costItems.find((entry) => entry.id === priceItemId);
    if (!item) return;
    const unitCostBrl = num(item.unitPrice) * (item.currency === "USD" ? rate : 1);
    updateRow(index, { priceItemId, internalUnitCostBrl: Math.round(unitCostBrl * 100) / 100 });
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Órgão">
          <Input value={bidOrg} onChange={(event) => setBidOrg(event.target.value)} className="h-9" />
        </Field>
        <Field label="Nº do pregão">
          <Input value={bidNumber} onChange={(event) => setBidNumber(event.target.value)} className="h-9" />
        </Field>
        <Field label="Meses de contrato">
          <Input
            type="number"
            value={contractMonths}
            onChange={(event) => setContractMonths(Number(event.target.value))}
            className="h-9"
          />
        </Field>
        <Field label="Teto do orçamento estimado (R$)">
          <Input
            type="number"
            value={ceilingTotal}
            onChange={(event) => setCeilingTotal(event.target.value)}
            className="h-9"
          />
        </Field>
      </div>

      <Separator />

      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Itens / subitens</Label>
        <div className="flex items-center gap-3">
          <button type="button" className="text-xs font-medium text-[#7C3AED]" onClick={onNewCost}>
            + Novo custo (salva na org)
          </button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setBidRows([
                ...bidRows,
                {
                  code: "",
                  parentCode: "",
                  description: "",
                  unit: "SV",
                  quantity: 1,
                  internalUnitCostBrl: 0,
                  markupPercentage: "",
                  ceilingUnitBrl: "",
                  priceItemId: "",
                },
              ])
            }
          >
            <Plus className="mr-1 size-4" /> Item
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {bidRows.map((row, index) => (
          <div key={index} className="space-y-2 rounded-lg border p-3">
            <div className="grid grid-cols-[70px_1fr_70px_32px] items-center gap-2">
              <Input
                placeholder="Cód."
                value={row.code}
                onChange={(event) => updateRow(index, { code: event.target.value })}
                className="h-8"
              />
              <Input
                placeholder="Descrição"
                value={row.description}
                onChange={(event) => updateRow(index, { description: event.target.value })}
                className="h-8"
              />
              <Input
                placeholder="Un."
                value={row.unit}
                onChange={(event) => updateRow(index, { unit: event.target.value })}
                className="h-8"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => setBidRows(bidRows.filter((_, position) => position !== index))}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">
                Custo interno do catálogo (opcional — preenche o custo unit.)
              </Label>
              <PickSelect
                items={costItems}
                value={row.priceItemId}
                onChange={(value) => applyCatalogCost(index, value)}
                placeholder="Puxar custo do catálogo"
              />
            </div>
            <div className="grid grid-cols-4 gap-2">
              <NumberField label="Qtd" value={row.quantity} onChange={(value) => updateRow(index, { quantity: value })} />
              <NumberField
                label="Custo unit."
                value={row.internalUnitCostBrl}
                onChange={(value) => updateRow(index, { internalUnitCostBrl: value, priceItemId: "" })}
              />
              <TextField
                label="Markup %"
                value={row.markupPercentage}
                onChange={(value) => updateRow(index, { markupPercentage: value })}
              />
              <TextField
                label="Teto unit."
                value={row.ceilingUnitBrl}
                onChange={(value) => updateRow(index, { ceilingUnitBrl: value })}
              />
            </div>
            <TextField
              label="Subitem de (código do item pai, opcional)"
              value={row.parentCode}
              onChange={(value) => updateRow(index, { parentCode: value })}
            />
          </div>
        ))}
        {bidRows.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Adicione os itens e subitens do edital (ex.: 1.1, 1.2, 2).
          </p>
        )}
      </div>
    </>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <Input type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} className="h-8" />
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} className="h-8" />
    </div>
  );
}
