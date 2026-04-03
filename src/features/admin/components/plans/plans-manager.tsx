"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, Star, Users, CheckCircle2, XCircle,
  ToggleLeft, ToggleRight, GripVertical, Sparkles, ChevronDown, ChevronUp,
  ExternalLink, CreditCard, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { PlanDetailModal, type PlanDetail } from "@/components/plan-detail-modal";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PlanRow {
  id:           string;
  slug:         string;
  name:         string;
  slogan:       string | null;
  sortOrder:    number;
  monthlyStars: number;
  priceMonthly: number;
  billingType:  string;
  maxUsers:     number;
  rolloverPct:  number;
  benefits:     string[];
  ctaLabel:     string;
  ctaLink:      string | null;
  ctaGatewayId: string | null;
  highlighted:  boolean;
  isActive:     boolean;
  orgCount:     number;
}

const BILLING_LABELS: Record<string, string> = {
  monthly: "Mensal",
  annual:  "Anual",
  weekly:  "Semanal",
};

// ── Plan Form Dialog ──────────────────────────────────────────────────────────

function PlanFormDialog({
  open, onClose, editing,
}: {
  open:    boolean;
  onClose: () => void;
  editing: PlanRow | null;
}) {
  const qc = useQueryClient();

  const init = editing ?? {
    name: "", slogan: "", sortOrder: 0, priceMonthly: 0,
    billingType: "monthly", monthlyStars: 0, maxUsers: 3,
    rolloverPct: 30, benefits: [], ctaLabel: "Assinar agora",
    ctaLink: "", ctaGatewayId: null, highlighted: false, isActive: true,
  };

  const [name,         setName]         = useState(init.name);
  const [slogan,       setSlogan]       = useState(init.slogan ?? "");
  const [sortOrder,    setSortOrder]    = useState(String(init.sortOrder));
  const [price,        setPrice]        = useState(String(init.priceMonthly));
  const [billingType,  setBillingType]  = useState(init.billingType);
  const [stars,        setStars]        = useState(String(init.monthlyStars));
  const [maxUsers,     setMaxUsers]     = useState(String(init.maxUsers));
  const [rolloverPct,  setRolloverPct]  = useState(String(init.rolloverPct));
  const [benefits,     setBenefits]     = useState<string[]>(editing?.benefits ?? [""]);
  const [ctaLabel,     setCtaLabel]     = useState(init.ctaLabel);
  const [ctaLink,      setCtaLink]      = useState(init.ctaLink ?? "");
  const [ctaGatewayId, setCtaGatewayId] = useState<string>(init.ctaGatewayId ?? "");
  const [highlighted,  setHighlighted]  = useState(init.highlighted);
  const [isActive,     setIsActive]     = useState(init.isActive);
  const [ctaType,      setCtaType]      = useState<"link" | "gateway">(
    init.ctaGatewayId ? "gateway" : "link",
  );

  const { data: gwData } = useQuery(orpc.admin.listGatewayConfigs.queryOptions());
  const gateways = gwData?.gateways ?? [];

  const qOpts = orpc.admin.listPlans.queryOptions();

  const onDone = () => {
    qc.invalidateQueries(qOpts);
    onClose();
  };

  const { mutate: createPlan, isPending: isCreating } = useMutation({
    ...orpc.admin.createPlan.mutationOptions(),
    onSuccess: () => { toast.success("Plano criado!"); onDone(); },
    onError:   (e) => toast.error(e.message),
  });

  const { mutate: updatePlan, isPending: isUpdating } = useMutation({
    ...orpc.admin.updatePlan.mutationOptions(),
    onSuccess: () => { toast.success("Plano atualizado!"); onDone(); },
    onError:   (e) => toast.error(e.message),
  });

  const isPending = isCreating || isUpdating;

  const handleSave = () => {
    if (!name.trim()) return toast.error("Nome obrigatório.");

    const common = {
      name:         name.trim(),
      slogan:       slogan || undefined,
      sortOrder:    Number(sortOrder) || 0,
      priceMonthly: Number(price) || 0,
      billingType:  billingType as "monthly" | "annual" | "weekly",
      monthlyStars: Number(stars) || 0,
      maxUsers:     Number(maxUsers) || 3,
      rolloverPct:  Number(rolloverPct) || 30,
      benefits:     benefits.filter(Boolean),
      ctaLabel:     ctaLabel || "Assinar agora",
      ctaLink:      ctaType === "link" ? (ctaLink || undefined) : undefined,
      ctaGatewayId: ctaType === "gateway" ? (ctaGatewayId || undefined) : undefined,
      highlighted,
      isActive,
    };

    if (editing) {
      updatePlan({ id: editing.id, ...common });
    } else {
      createPlan(common);
    }
  };

  const addBenefit    = () => setBenefits((b) => [...b, ""]);
  const removeBenefit = (i: number) => setBenefits((b) => b.filter((_, idx) => idx !== i));
  const editBenefit   = (i: number, val: string) =>
    setBenefits((b) => b.map((x, idx) => (idx === i ? val : x)));

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl bg-zinc-900 border-zinc-700 text-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-400" />
            {editing ? "Editar Plano" : "Criar Novo Plano"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* Row 1: ordem + nome */}
          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-zinc-300 text-xs">Ordem</Label>
              <Input
                type="number" value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            <div className="col-span-3 space-y-1.5">
              <Label className="text-zinc-300 text-xs">Nome do plano <span className="text-red-400">*</span></Label>
              <Input
                value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Explore, Pro, Enterprise..."
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
              />
            </div>
          </div>

          {/* Slogan */}
          <div className="space-y-1.5">
            <Label className="text-zinc-300 text-xs">Slogan <span className="text-zinc-500">(opcional)</span></Label>
            <Input
              value={slogan} onChange={(e) => setSlogan(e.target.value)}
              placeholder="Ex: Para equipes que querem mais"
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
            />
          </div>

          {/* Row: valor + tipo de cobrança */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-zinc-300 text-xs">Valor (R$) <span className="text-red-400">*</span></Label>
              <Input
                type="number" step="0.01" value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-zinc-300 text-xs">Tipo de cobrança</Label>
              <Select value={billingType} onValueChange={setBillingType}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
                  <SelectItem value="monthly">Mensal</SelectItem>
                  <SelectItem value="annual">Anual</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row: stars + usuários + rollover */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-zinc-300 text-xs">Qtd. Stars ★</Label>
              <Input
                type="number" value={stars}
                onChange={(e) => setStars(e.target.value)}
                placeholder="500"
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-zinc-300 text-xs">Qtd. Usuários</Label>
              <Input
                type="number" value={maxUsers}
                onChange={(e) => setMaxUsers(e.target.value)}
                placeholder="3"
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-zinc-300 text-xs">Rollover %</Label>
              <Input
                type="number" value={rolloverPct}
                onChange={(e) => setRolloverPct(e.target.value)}
                placeholder="30"
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
          </div>

          {/* Benefícios */}
          <div className="space-y-2">
            <Label className="text-zinc-300 text-xs">Benefícios</Label>
            <div className="space-y-2">
              {benefits.map((b, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-zinc-600 text-xs w-5 text-right shrink-0">{i + 1}.</span>
                  <Input
                    value={b}
                    onChange={(e) => editBenefit(i, e.target.value)}
                    placeholder={`Benefício ${i + 1}...`}
                    className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => removeBenefit(i)}
                    className="text-zinc-600 hover:text-red-400 transition-colors p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <Button
              type="button" variant="outline" size="sm"
              onClick={addBenefit}
              className="border-zinc-700 text-zinc-400 hover:text-white hover:border-violet-500/50 gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar benefício
            </Button>
          </div>

          {/* CTA */}
          <div className="space-y-2">
            <Label className="text-zinc-300 text-xs">Botão CTA</Label>
            <Input
              value={ctaLabel}
              onChange={(e) => setCtaLabel(e.target.value)}
              placeholder="Assinar agora"
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
            />
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => setCtaType("link")}
                className={cn(
                  "flex-1 py-2 rounded-lg border text-xs font-medium transition-colors",
                  ctaType === "link"
                    ? "bg-violet-600/20 border-violet-500 text-violet-300"
                    : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600",
                )}
              >
                🔗 Link externo
              </button>
              <button
                type="button"
                onClick={() => setCtaType("gateway")}
                className={cn(
                  "flex-1 py-2 rounded-lg border text-xs font-medium transition-colors",
                  ctaType === "gateway"
                    ? "bg-violet-600/20 border-violet-500 text-violet-300"
                    : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600",
                )}
              >
                💳 Gateway de pagamento
              </button>
            </div>
            {ctaType === "link" ? (
              <Input
                value={ctaLink}
                onChange={(e) => setCtaLink(e.target.value)}
                placeholder="https://..."
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
              />
            ) : (
              <Select value={ctaGatewayId} onValueChange={setCtaGatewayId}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                  <SelectValue placeholder="Selecione o gateway..." />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
                  {gateways.map((gw) => (
                    <SelectItem key={gw.id} value={gw.id}>
                      {gw.provider === "stripe" ? "💳" : "🏦"} {gw.label ?? gw.provider}
                      {gw.environment === "sandbox" && " (sandbox)"}
                    </SelectItem>
                  ))}
                  {gateways.length === 0 && (
                    <div className="p-2 text-xs text-zinc-500">
                      Nenhum gateway configurado em /admin/payments
                    </div>
                  )}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Toggles */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-800 border border-zinc-700">
              <div>
                <p className="text-sm font-medium text-white">Destaque</p>
                <p className="text-xs text-zinc-400">Exibe badge "Mais popular"</p>
              </div>
              <Switch
                checked={highlighted} onCheckedChange={setHighlighted}
                className="data-[state=checked]:bg-violet-600"
              />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-800 border border-zinc-700">
              <div>
                <p className="text-sm font-medium text-white">Ativo</p>
                <p className="text-xs text-zinc-400">Visível na página de planos</p>
              </div>
              <Switch
                checked={isActive} onCheckedChange={setIsActive}
                className="data-[state=checked]:bg-emerald-600"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} className="text-zinc-400 hover:text-white">
            Cancelar
          </Button>
          <Button
            onClick={handleSave} disabled={isPending}
            className="bg-violet-600 hover:bg-violet-700 text-white"
          >
            {isPending ? "Salvando..." : editing ? "Salvar alterações" : "Criar plano"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main PlansManager ─────────────────────────────────────────────────────────

export function PlansManager() {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing,  setEditing]  = useState<PlanRow | null>(null);

  const qOpts = orpc.admin.listPlans.queryOptions();
  const { data, isLoading } = useQuery(qOpts);
  const plans = data?.plans ?? [];

  const { mutate: deletePlan } = useMutation({
    ...orpc.admin.deletePlan.mutationOptions(),
    onSuccess: () => { toast.success("Plano excluído."); qc.invalidateQueries(qOpts); },
    onError:   (e) => toast.error(e.message),
  });

  const { mutate: toggleActive } = useMutation({
    ...orpc.admin.togglePlanActive.mutationOptions(),
    onSuccess: () => qc.invalidateQueries(qOpts),
    onError:   (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Planos de Assinatura</h2>
          <p className="text-sm text-zinc-400">
            Configure os planos exibidos na aba "Escolha seu plano" da home.
          </p>
        </div>
        <Button
          onClick={() => { setEditing(null); setFormOpen(true); }}
          className="bg-violet-600 hover:bg-violet-700 text-white gap-2"
        >
          <Plus className="w-4 h-4" /> Novo plano
        </Button>
      </div>

      {/* Info banner */}
      <div className="flex gap-3 p-4 rounded-xl bg-blue-950/20 border border-blue-800/30">
        <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-200/80">
          A ordem de exibição é definida pelo campo <strong>Ordem</strong>. Planos com destaque
          aparecem com badge <strong>"Mais popular"</strong>. O botão CTA pode redirecionar para
          um link externo ou iniciar um checkout via gateway configurado em{" "}
          <a href="/admin/payments" className="text-blue-400 underline">Gateways</a>.
        </p>
      </div>

      {/* Plans grid */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 rounded-xl bg-zinc-800 animate-pulse" />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center border border-dashed border-zinc-700 rounded-xl">
          <Sparkles className="w-12 h-12 text-zinc-700" />
          <p className="text-zinc-400 font-medium">Nenhum plano criado</p>
          <p className="text-zinc-600 text-sm max-w-xs">
            Crie planos para exibir na tela inicial e permitir assinaturas.
          </p>
          <Button
            onClick={() => { setEditing(null); setFormOpen(true); }}
            variant="outline"
            className="border-violet-700 text-violet-400 hover:bg-violet-950/30 mt-2 gap-2"
          >
            <Plus className="w-4 h-4" /> Criar primeiro plano
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              onEdit={() => { setEditing(plan); setFormOpen(true); }}
              onDelete={() => {
                if (confirm(`Excluir plano "${plan.name}"? Esta ação não pode ser desfeita.`))
                  deletePlan({ id: plan.id });
              }}
              onToggle={() => toggleActive({ id: plan.id, isActive: !plan.isActive })}
            />
          ))}
        </div>
      )}

      <PlanFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        editing={editing}
      />
    </div>
  );
}

// ── Plan Card ─────────────────────────────────────────────────────────────────

const STAR_PER_USER = 30;

function PlanCard({
  plan, onEdit, onDelete, onToggle,
}: {
  plan:     PlanRow;
  onEdit:   () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const [showBenefits, setShowBenefits] = useState(false);
  const [detailOpen,   setDetailOpen]   = useState(false);

  const planDetail: PlanDetail = {
    id:          plan.id,
    name:        plan.name,
    slogan:      plan.slogan,
    price:       Number(plan.priceMonthly),
    stars:       plan.monthlyStars,
    rollover:    plan.rolloverPct,
    highlighted: plan.highlighted,
    badge:       plan.highlighted ? "MAIS POPULAR" : null,
    benefits:    plan.benefits,
    ctaLabel:    plan.ctaLabel,
    ctaHref:     plan.ctaLink ?? "/sign-up",
    starPerUser: STAR_PER_USER,
  };

  return (
    <>
      <PlanDetailModal
        plan={planDetail}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      />

    <div className={cn(
      "rounded-xl border p-4 space-y-3 transition-opacity",
      plan.highlighted ? "border-violet-500/50 bg-violet-950/20" : "border-zinc-700/50 bg-zinc-900",
      !plan.isActive && "opacity-50",
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setDetailOpen(true)}
              className="font-bold text-white hover:text-violet-300 transition-colors cursor-pointer underline-offset-2 hover:underline text-left"
            >
              {plan.name}
            </button>
            {plan.highlighted && (
              <Badge className="bg-violet-600/30 text-violet-300 border-violet-700/50 text-[10px]">
                ⭐ Destaque
              </Badge>
            )}
            <Badge className={cn(
              "text-[10px]",
              plan.isActive
                ? "bg-emerald-950/40 text-emerald-300 border-emerald-800/30"
                : "bg-zinc-800 text-zinc-500 border-zinc-700",
            )}>
              {plan.isActive ? "Ativo" : "Inativo"}
            </Badge>
          </div>
          {plan.slogan && <p className="text-xs text-zinc-400 mt-0.5">{plan.slogan}</p>}
          <p className="text-[10px] text-zinc-600 font-mono mt-0.5">ordem: {plan.sortOrder}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xl font-bold text-white">
            {Number(plan.priceMonthly) === 0
              ? "Grátis"
              : `R$ ${Number(plan.priceMonthly).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          </p>
          <p className="text-[10px] text-zinc-500">{BILLING_LABELS[plan.billingType] ?? plan.billingType}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="flex flex-col items-center p-2 rounded-lg bg-zinc-800/60">
          <Star className="w-3.5 h-3.5 text-yellow-400 mb-0.5" />
          <span className="font-semibold text-white">{plan.monthlyStars.toLocaleString("pt-BR")}</span>
          <span className="text-zinc-500">Stars</span>
        </div>
        <div className="flex flex-col items-center p-2 rounded-lg bg-zinc-800/60">
          <Users className="w-3.5 h-3.5 text-blue-400 mb-0.5" />
          <span className="font-semibold text-white">{plan.maxUsers === 999 ? "∞" : plan.maxUsers}</span>
          <span className="text-zinc-500">Usuários</span>
        </div>
        <div className="flex flex-col items-center p-2 rounded-lg bg-zinc-800/60">
          <span className="text-[16px] mb-0.5">🔁</span>
          <span className="font-semibold text-white">{plan.rolloverPct}%</span>
          <span className="text-zinc-500">Rollover</span>
        </div>
      </div>

      {/* Benefits collapsible */}
      {plan.benefits.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowBenefits(!showBenefits)}
            className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white transition-colors"
          >
            {showBenefits ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {plan.benefits.length} benefício(s)
          </button>
          {showBenefits && (
            <ul className="mt-2 space-y-1">
              {plan.benefits.map((b, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-zinc-400">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                  {b}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* CTA info */}
      <div className="flex items-center gap-1.5 text-xs text-zinc-500 truncate">
        {plan.ctaGatewayId ? (
          <><CreditCard className="w-3 h-3 shrink-0" /> Gateway: {plan.ctaGatewayId.slice(0, 8)}…</>
        ) : plan.ctaLink ? (
          <><ExternalLink className="w-3 h-3 shrink-0" /> <span className="truncate">{plan.ctaLink}</span></>
        ) : (
          <><span className="text-zinc-600">CTA: {plan.ctaLabel}</span></>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2 border-t border-zinc-700/40">
        <button
          onClick={onToggle}
          className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white transition-colors"
        >
          {plan.isActive
            ? <ToggleRight className="w-4 h-4 text-emerald-400" />
            : <ToggleLeft className="w-4 h-4" />}
          {plan.isActive ? "Desativar" : "Ativar"}
        </button>

        <button
          onClick={onEdit}
          className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white transition-colors ml-2"
        >
          <Pencil className="w-3.5 h-3.5" /> Editar
        </button>

        <button
          onClick={onDelete}
          className="flex items-center gap-1 text-xs text-zinc-400 hover:text-red-400 transition-colors ml-2"
          title={plan.orgCount > 0 ? `${plan.orgCount} empresa(s) com este plano` : "Excluir"}
        >
          <Trash2 className="w-3.5 h-3.5" />
          {plan.orgCount > 0 && <span className="text-amber-400">{plan.orgCount}</span>}
        </button>

        <div className="ml-auto text-[10px] text-zinc-600 font-mono">{plan.slug.slice(0, 16)}</div>
      </div>
    </div>
    </>
  );
}
