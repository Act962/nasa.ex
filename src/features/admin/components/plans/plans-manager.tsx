"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Star,
  Users,
  CheckCircle2,
  XCircle,
  ToggleLeft,
  ToggleRight,
  GripVertical,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  CreditCard,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  PlanDetailModal,
  type PlanDetail,
} from "@/components/plan-detail-modal";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PlanRow {
  id: string;
  slug: string;
  name: string;
  slogan: string | null;
  sortOrder: number;
  monthlyStars: number;
  priceMonthly: number;
  priceLabel: string | null;
  billingType: string;
  maxUsers: number;
  rolloverPct: number;
  benefits: string[];
  ctaLabel: string;
  ctaLink: string | null;
  ctaGatewayId: string | null;
  highlighted: boolean;
  isActive: boolean;
  stripePriceId: string | null;
  stripeProductId: string | null;
  orgCount: number;
}

const BILLING_LABELS: Record<string, string> = {
  monthly: "Mensal",
  annual: "Anual",
  weekly: "Semanal",
};

// ── Plan Form Dialog ──────────────────────────────────────────────────────────

function PlanFormDialog({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing: PlanRow | null;
}) {
  const qc = useQueryClient();

  const init = editing ?? {
    name: "",
    slogan: "",
    sortOrder: 0,
    priceMonthly: 0,
    priceLabel: null as string | null,
    billingType: "monthly",
    monthlyStars: 0,
    maxUsers: 3,
    rolloverPct: 30,
    benefits: [],
    ctaLabel: "Assinar agora",
    ctaLink: "",
    ctaGatewayId: null,
    highlighted: false,
    isActive: true,
    stripePriceId: null,
    stripeProductId: null,
  };

  const [name, setName] = useState(init.name);
  const [slogan, setSlogan] = useState(init.slogan ?? "");
  const [sortOrder, setSortOrder] = useState(String(init.sortOrder));
  const [price, setPrice] = useState(String(init.priceMonthly));
  const [priceLabel, setPriceLabel] = useState(init.priceLabel ?? "");
  const [billingType, setBillingType] = useState(init.billingType);
  const [stars, setStars] = useState(String(init.monthlyStars));
  const [maxUsers, setMaxUsers] = useState(String(init.maxUsers));
  const [rolloverPct, setRolloverPct] = useState(String(init.rolloverPct));
  const [benefits, setBenefits] = useState<string[]>(editing?.benefits ?? [""]);
  const [ctaLabel, setCtaLabel] = useState(init.ctaLabel);
  const [ctaLink, setCtaLink] = useState(init.ctaLink ?? "");
  const [ctaGatewayId, setCtaGatewayId] = useState<string>(
    init.ctaGatewayId ?? "",
  );
  const [highlighted, setHighlighted] = useState(init.highlighted);
  const [isActive, setIsActive] = useState(init.isActive);
  const [stripePriceId, setStripePriceId] = useState(init.stripePriceId ?? "");
  const [stripeProductId, setStripeProductId] = useState(
    init.stripeProductId ?? "",
  );
  const [ctaType, setCtaType] = useState<"link" | "gateway">(
    init.ctaGatewayId ? "gateway" : "link",
  );

  const { data: gwData } = useQuery(
    orpc.admin.listGatewayConfigs.queryOptions(),
  );
  const gateways = gwData?.gateways ?? [];

  const qOpts = orpc.admin.listPlans.queryOptions();

  const onDone = () => {
    qc.invalidateQueries(qOpts);
    onClose();
  };

  const { mutate: createPlan, isPending: isCreating } = useMutation({
    ...orpc.admin.createPlan.mutationOptions(),
    onSuccess: () => {
      toast.success("Plano criado!");
      onDone();
    },
    onError: (e) => toast.error(e.message),
  });

  const { mutate: updatePlan, isPending: isUpdating } = useMutation({
    ...orpc.admin.updatePlan.mutationOptions(),
    onSuccess: () => {
      toast.success("Plano atualizado!");
      onDone();
    },
    onError: (e) => toast.error(e.message),
  });

  const isPending = isCreating || isUpdating;

  const handleSave = () => {
    if (!name.trim()) return toast.error("Nome obrigatório.");

    const common = {
      name: name.trim(),
      slogan: slogan || undefined,
      sortOrder: Number(sortOrder) || 0,
      priceMonthly: Number(price) || 0,
      priceLabel: priceLabel.trim() || undefined,
      billingType: billingType as "monthly" | "annual" | "weekly",
      monthlyStars: Number(stars) || 0,
      maxUsers: Number(maxUsers) || 3,
      rolloverPct: Number(rolloverPct) || 30,
      benefits: benefits.filter(Boolean),
      ctaLabel: ctaLabel || "Assinar agora",
      ctaLink: ctaType === "link" ? ctaLink || undefined : undefined,
      ctaGatewayId:
        ctaType === "gateway" ? ctaGatewayId || undefined : undefined,
      highlighted,
      isActive,
      stripePriceId: stripePriceId.trim() || undefined,
      stripeProductId: stripeProductId.trim() || undefined,
    };

    if (editing) {
      updatePlan({ id: editing.id, ...common });
    } else {
      createPlan(common);
    }
  };

  const addBenefit = () => setBenefits((b) => [...b, ""]);
  const removeBenefit = (i: number) =>
    setBenefits((b) => b.filter((_, idx) => idx !== i));
  const editBenefit = (i: number, val: string) =>
    setBenefits((b) => b.map((x, idx) => (idx === i ? val : x)));

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-2xl bg-card border-border text-foreground max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-info" />
            {editing ? "Editar Plano" : "Criar Novo Plano"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* Row 1: ordem + nome */}
          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-foreground text-xs">Ordem</Label>
              <Input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="bg-panel border-border text-foreground"
              />
            </div>
            <div className="col-span-3 space-y-1.5">
              <Label className="text-foreground text-xs">
                Nome do plano <span className="text-destructive">*</span>
              </Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Explore, Pro, Enterprise..."
                className="bg-panel border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>

          {/* Slogan */}
          <div className="space-y-1.5">
            <Label className="text-foreground text-xs">
              Slogan <span className="text-muted-foreground">(opcional)</span>
            </Label>
            <Input
              value={slogan}
              onChange={(e) => setSlogan(e.target.value)}
              placeholder="Ex: Para equipes que querem mais"
              className="bg-panel border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>

          {/* Row: valor + tipo de cobrança */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-foreground text-xs">
                Valor (R$) <span className="text-destructive">*</span>
              </Label>
              <Input
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                className="bg-panel border-border text-foreground"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-foreground text-xs">Tipo de cobrança</Label>
              <Select value={billingType} onValueChange={setBillingType}>
                <SelectTrigger className="bg-panel border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-panel border-border text-foreground">
                  <SelectItem value="monthly">Mensal</SelectItem>
                  <SelectItem value="annual">Anual</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Rótulo de preço (override do canto direito do card) */}
          <div className="space-y-1.5">
            <Label className="text-foreground text-xs">
              Rótulo de preço{" "}
              <span className="text-muted-foreground">
                (opcional — substitui o "R$ X" / "Consultar" no card)
              </span>
            </Label>
            <Input
              value={priceLabel}
              onChange={(e) => setPriceLabel(e.target.value)}
              placeholder='Ex: "Gratuito", "Sob consulta", "A partir de R$ 197"'
              className="bg-panel border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>

          {/* Row: stars + usuários + rollover */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-foreground text-xs">Qtd. Stars ★</Label>
              <Input
                type="number"
                value={stars}
                onChange={(e) => setStars(e.target.value)}
                placeholder="500"
                className="bg-panel border-border text-foreground"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-foreground text-xs">Qtd. Usuários</Label>
              <Input
                type="number"
                value={maxUsers}
                onChange={(e) => setMaxUsers(e.target.value)}
                placeholder="3"
                className="bg-panel border-border text-foreground"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-foreground text-xs">Rollover %</Label>
              <Input
                type="number"
                value={rolloverPct}
                onChange={(e) => setRolloverPct(e.target.value)}
                placeholder="30"
                className="bg-panel border-border text-foreground"
              />
            </div>
          </div>

          {/* Benefícios */}
          <div className="space-y-2">
            <Label className="text-foreground text-xs">Benefícios</Label>
            <div className="space-y-2">
              {benefits.map((b, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs w-5 text-right shrink-0">
                    {i + 1}.
                  </span>
                  <Input
                    value={b}
                    onChange={(e) => editBenefit(i, e.target.value)}
                    placeholder={`Benefício ${i + 1}...`}
                    className="bg-panel border-border text-foreground placeholder:text-muted-foreground flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => removeBenefit(i)}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addBenefit}
              className="border-border text-muted-foreground hover:text-foreground hover:border-info/50 gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar benefício
            </Button>
          </div>

          {/* CTA */}
          <div className="space-y-2">
            <Label className="text-foreground text-xs">Botão CTA</Label>
            <Input
              value={ctaLabel}
              onChange={(e) => setCtaLabel(e.target.value)}
              placeholder="Assinar agora"
              className="bg-panel border-border text-foreground placeholder:text-muted-foreground"
            />
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => setCtaType("link")}
                className={cn(
                  "flex-1 py-2 rounded-lg border text-xs font-medium transition-colors",
                  ctaType === "link"
                    ? "bg-info/20 border-info text-info"
                    : "bg-panel border-border text-muted-foreground hover:border-knob",
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
                    ? "bg-info/20 border-info text-info"
                    : "bg-panel border-border text-muted-foreground hover:border-knob",
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
                className="bg-panel border-border text-foreground placeholder:text-muted-foreground"
              />
            ) : (
              <Select value={ctaGatewayId} onValueChange={setCtaGatewayId}>
                <SelectTrigger className="bg-panel border-border text-foreground">
                  <SelectValue placeholder="Selecione o gateway..." />
                </SelectTrigger>
                <SelectContent className="bg-panel border-border text-foreground">
                  {gateways.map((gw) => (
                    <SelectItem key={gw.id} value={gw.id}>
                      {gw.provider === "stripe" ? "💳" : "🏦"}{" "}
                      {gw.label ?? gw.provider}
                      {gw.environment === "sandbox" && " (sandbox)"}
                    </SelectItem>
                  ))}
                  {gateways.length === 0 && (
                    <div className="p-2 text-xs text-muted-foreground">
                      Nenhum gateway configurado em /admin/payments
                    </div>
                  )}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Vínculo Stripe */}
          <div className="space-y-2 p-3 rounded-lg border border-border bg-panel">
            <Label className="text-foreground text-xs flex items-center gap-1.5">
              <CreditCard className="w-3 h-3 text-info" /> Vínculo Stripe
            </Label>
            <Input
              value={stripePriceId}
              onChange={(e) => setStripePriceId(e.target.value)}
              placeholder="price_xxx (Stripe Price ID — obrigatório p/ checkout)"
              className="bg-panel border-border text-foreground placeholder:text-muted-foreground font-mono text-xs"
            />
            <Input
              value={stripeProductId}
              onChange={(e) => setStripeProductId(e.target.value)}
              placeholder="prod_xxx (Stripe Product ID — opcional, p/ sync de nome)"
              className="bg-panel border-border text-foreground placeholder:text-muted-foreground font-mono text-xs"
            />
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Pegue os IDs no painel do Stripe → Produtos. Sem o{" "}
              <strong>Price ID</strong> o checkout deste plano não funciona. Se
              alterar o valor do plano, gere um novo Price no Stripe (Prices
              são imutáveis) e cole o novo ID aqui.
            </p>
          </div>

          {/* Toggles */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-panel border border-border">
              <div>
                <p className="text-sm font-medium text-foreground">Destaque</p>
                <p className="text-xs text-muted-foreground">
                  Exibe badge "Mais popular"
                </p>
              </div>
              <Switch
                checked={highlighted}
                onCheckedChange={setHighlighted}
              />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-panel border border-border">
              <div>
                <p className="text-sm font-medium text-foreground">Ativo</p>
                <p className="text-xs text-muted-foreground">
                  Visível na página de planos
                </p>
              </div>
              <Switch
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={isPending}
          >
            {isPending
              ? "Salvando..."
              : editing
                ? "Salvar alterações"
                : "Criar plano"}
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
  const [editing, setEditing] = useState<PlanRow | null>(null);

  const qOpts = orpc.admin.listPlans.queryOptions();
  const { data, isLoading } = useQuery(qOpts);
  const plans = data?.plans ?? [];

  const { mutate: deletePlan } = useMutation({
    ...orpc.admin.deletePlan.mutationOptions(),
    onSuccess: () => {
      toast.success("Plano excluído.");
      qc.invalidateQueries(qOpts);
    },
    onError: (e) => toast.error(e.message),
  });

  const { mutate: toggleActive } = useMutation({
    ...orpc.admin.togglePlanActive.mutationOptions(),
    onSuccess: () => qc.invalidateQueries(qOpts),
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Planos de Assinatura</h2>
          <p className="text-sm text-muted-foreground">
            Configure os planos exibidos na aba "Escolha seu plano" da home.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className="gap-2"
        >
          <Plus className="w-4 h-4" /> Novo plano
        </Button>
      </div>

      {/* Info banner */}
      <div className="flex gap-3 p-4 rounded-xl bg-info/10 border border-info/30">
        <Info className="w-4 h-4 text-info shrink-0 mt-0.5" />
        <p className="text-sm text-info">
          A ordem de exibição é definida pelo campo <strong>Ordem</strong>.
          Planos com destaque aparecem com badge <strong>"Mais popular"</strong>
          . O botão CTA pode redirecionar para um link externo ou iniciar um
          checkout via gateway configurado em{" "}
          <a href="/admin/payments" className="text-info underline">
            Gateways
          </a>
          .
        </p>
      </div>

      {/* Plans grid */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-64 rounded-xl bg-panel animate-pulse"
            />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center border border-dashed border-border rounded-xl">
          <Sparkles className="w-12 h-12 text-muted-foreground" />
          <p className="text-muted-foreground font-medium">Nenhum plano criado</p>
          <p className="text-muted-foreground text-sm max-w-xs">
            Crie planos para exibir na tela inicial e permitir assinaturas.
          </p>
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            variant="outline"
            className="border-info/50 text-info hover:bg-info/10 mt-2 gap-2"
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
              onEdit={() => {
                setEditing(plan);
                setFormOpen(true);
              }}
              onDelete={() => {
                if (
                  confirm(
                    `Excluir plano "${plan.name}"? Esta ação não pode ser desfeita.`,
                  )
                )
                  deletePlan({ id: plan.id });
              }}
              onToggle={() =>
                toggleActive({ id: plan.id, isActive: !plan.isActive })
              }
            />
          ))}
        </div>
      )}

      <PlanFormDialog
        key={editing?.id ?? "new"}
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        editing={editing}
      />
    </div>
  );
}

// ── Plan Card ─────────────────────────────────────────────────────────────────

const STAR_PER_USER = 30;

function PlanCard({
  plan,
  onEdit,
  onDelete,
  onToggle,
}: {
  plan: PlanRow;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const [showBenefits, setShowBenefits] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  const planDetail: PlanDetail = {
    id: plan.id,
    name: plan.name,
    slogan: plan.slogan,
    price: Number(plan.priceMonthly),
    stars: plan.monthlyStars,
    rollover: plan.rolloverPct,
    highlighted: plan.highlighted,
    badge: plan.highlighted ? "MAIS POPULAR" : null,
    benefits: plan.benefits,
    ctaLabel: plan.ctaLabel,
    ctaHref: plan.ctaLink ?? "/sign-up",
    starPerUser: STAR_PER_USER,
  };

  return (
    <>
      <PlanDetailModal
        plan={planDetail}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      />

      <div
        className={cn(
          "rounded-xl border p-4 space-y-3 transition-opacity",
          plan.highlighted
            ? "border-info/50 bg-info/10"
            : "border-border bg-card",
          !plan.isActive && "opacity-50",
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setDetailOpen(true)}
                className="font-bold text-foreground hover:text-info transition-colors cursor-pointer underline-offset-2 hover:underline text-left"
              >
                {plan.name}
              </button>
              {plan.highlighted && (
                <Badge className="bg-info/30 text-info border-info/50 text-[10px]">
                  ⭐ Destaque
                </Badge>
              )}
              <Badge
                className={cn(
                  "text-[10px]",
                  plan.isActive
                    ? "bg-success/10 text-success border-success/30"
                    : "bg-panel text-muted-foreground border-border",
                )}
              >
                {plan.isActive ? "Ativo" : "Inativo"}
              </Badge>
            </div>
            {plan.slogan && (
              <p className="text-xs text-muted-foreground mt-0.5">{plan.slogan}</p>
            )}
            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
              ordem: {plan.sortOrder}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xl font-bold text-foreground">
              {Number(plan.priceMonthly) === 0
                ? "Consultar"
                : `R$ ${Number(plan.priceMonthly).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {BILLING_LABELS[plan.billingType] ?? plan.billingType}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="flex flex-col items-center p-2 rounded-lg bg-panel">
            <Star className="w-3.5 h-3.5 text-warning mb-0.5" />
            <span className="font-semibold text-foreground">
              {plan.monthlyStars.toLocaleString("pt-BR")}
            </span>
            <span className="text-muted-foreground">Stars</span>
          </div>
          <div className="flex flex-col items-center p-2 rounded-lg bg-panel">
            <Users className="w-3.5 h-3.5 text-info mb-0.5" />
            <span className="font-semibold text-foreground">
              {plan.maxUsers === 999 ? "∞" : plan.maxUsers}
            </span>
            <span className="text-muted-foreground">Usuários</span>
          </div>
          <div className="flex flex-col items-center p-2 rounded-lg bg-panel">
            <span className="text-[16px] mb-0.5">🔁</span>
            <span className="font-semibold text-foreground">
              {plan.rolloverPct}%
            </span>
            <span className="text-muted-foreground">Rollover</span>
          </div>
        </div>

        {/* Benefits collapsible */}
        {plan.benefits.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowBenefits(!showBenefits)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {showBenefits ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
              {plan.benefits.length} benefício(s)
            </button>
            {showBenefits && (
              <ul className="mt-2 space-y-1">
                {plan.benefits.map((b, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-1.5 text-xs text-muted-foreground"
                  >
                    <CheckCircle2 className="w-3 h-3 text-success shrink-0 mt-0.5" />
                    {b}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* CTA & Stripe info */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
            {plan.ctaGatewayId ? (
              <>
                <CreditCard className="w-3 h-3 shrink-0" /> Gateway:{" "}
                {plan.ctaGatewayId.slice(0, 8)}…
              </>
            ) : plan.ctaLink ? (
              <>
                <ExternalLink className="w-3 h-3 shrink-0" />{" "}
                <span className="truncate">{plan.ctaLink}</span>
              </>
            ) : (
              <>
                <span className="text-muted-foreground">CTA: {plan.ctaLabel}</span>
              </>
            )}
          </div>

          {plan.stripePriceId && (
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono truncate">
              <CreditCard className="w-3 h-3 shrink-0 text-info" />
              <span className="truncate">{plan.stripePriceId}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-border">
          <button
            onClick={onToggle}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {plan.isActive ? (
              <ToggleRight className="w-4 h-4 text-success" />
            ) : (
              <ToggleLeft className="w-4 h-4" />
            )}
            {plan.isActive ? "Desativar" : "Ativar"}
          </button>

          <button
            onClick={onEdit}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors ml-2"
          >
            <Pencil className="w-3.5 h-3.5" /> Editar
          </button>

          <button
            onClick={onDelete}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors ml-2"
            title={
              plan.orgCount > 0
                ? `${plan.orgCount} empresa(s) com este plano`
                : "Excluir"
            }
          >
            <Trash2 className="w-3.5 h-3.5" />
            {plan.orgCount > 0 && (
              <span className="text-warning">{plan.orgCount}</span>
            )}
          </button>

          <div className="ml-auto text-[10px] text-muted-foreground font-mono">
            {plan.slug.slice(0, 16)}
          </div>
        </div>
      </div>
    </>
  );
}
