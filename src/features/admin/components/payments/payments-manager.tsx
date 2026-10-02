"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  CreditCard,
  Landmark,
  AlertTriangle,
  ToggleLeft,
  ToggleRight,
  Copy,
  Check,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface GatewayRow {
  id: string;
  provider: string;
  label: string | null;
  secretKeyMask: string;
  publicKey: string | null;
  hasWebhookSecret: boolean;
  environment: string;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
}

const PROVIDER_META: Record<
  string,
  { name: string; color: string; bg: string; logo: string }
> = {
  stripe: {
    name: "Stripe",
    color: "text-info",
    bg: "bg-info/10",
    logo: "💳",
  },
  asaas: {
    name: "Asaas",
    color: "text-success",
    bg: "bg-success/10",
    logo: "🏦",
  },
};

// ── Webhook URL copy helper ───────────────────────────────────────────────────

function WebhookUrlBox({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="flex items-center gap-2 bg-card border border-knob rounded-lg px-3 py-2">
      <code className="flex-1 text-[11px] text-info break-all font-mono">
        {url}
      </code>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
        title="Copiar URL"
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-success" />
        ) : (
          <Copy className="w-3.5 h-3.5" />
        )}
      </button>
    </div>
  );
}

// ── Setup guide per provider ──────────────────────────────────────────────────

function SetupGuide({
  provider,
  webhookUrl,
}: {
  provider: string;
  webhookUrl: string;
}) {
  const [open, setOpen] = useState(false);

  if (provider === "stripe") {
    return (
      <div className="rounded-lg border border-border overflow-hidden">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between px-3 py-2.5 bg-panel hover:bg-accent transition-colors text-left"
        >
          <div className="flex items-center gap-2 text-sm text-foreground font-medium">
            <Info className="w-4 h-4 text-info" />
            Como obter as chaves do Stripe
          </div>
          {open ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </button>

        {open && (
          <div className="px-3 pb-3 pt-2 bg-panel space-y-3 text-xs text-muted-foreground">
            {/* Secret Key */}
            <div className="space-y-1">
              <p className="font-semibold text-foreground">
                1. Secret Key & Publishable Key
              </p>
              <ol className="space-y-1 list-decimal list-inside text-muted-foreground">
                <li>
                  Acesse{" "}
                  <a
                    href="https://dashboard.stripe.com/apikeys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-info hover:underline inline-flex items-center gap-0.5"
                  >
                    dashboard.stripe.com/apikeys{" "}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </li>
                <li>
                  Copie a <span className="text-foreground">Secret key</span>{" "}
                  <code className="bg-muted px-1 rounded">sk_live_...</code>
                </li>
                <li>
                  Copie a <span className="text-foreground">Publishable key</span>{" "}
                  <code className="bg-muted px-1 rounded">pk_live_...</code>
                </li>
              </ol>
              <p className="text-muted-foreground italic">
                Para testes, use as chaves{" "}
                <code className="bg-muted px-1 rounded">sk_test_...</code>{" "}
                com ambiente Sandbox.
              </p>
            </div>

            <div className="border-t border-border" />

            {/* Webhook Secret */}
            <div className="space-y-1">
              <p className="font-semibold text-foreground">
                2. Webhook Secret{" "}
                <code className="bg-muted px-1 rounded text-info">
                  whsec_...
                </code>
              </p>
              <ol className="space-y-1 list-decimal list-inside text-muted-foreground">
                <li>
                  Acesse{" "}
                  <a
                    href="https://dashboard.stripe.com/webhooks"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-info hover:underline inline-flex items-center gap-0.5"
                  >
                    dashboard.stripe.com/webhooks{" "}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </li>
                <li>
                  Clique em{" "}
                  <span className="text-foreground">"Add destination"</span>
                </li>
                <li>
                  Cole a URL do webhook abaixo no campo{" "}
                  <span className="text-foreground">"Endpoint URL"</span>
                </li>
                <li>
                  Em eventos, selecione:{" "}
                  <code className="bg-muted px-1 rounded">
                    checkout.session.completed
                  </code>
                </li>
                <li>
                  Clique em{" "}
                  <span className="text-foreground">"Add endpoint"</span>
                </li>
                <li>
                  Abra o endpoint criado → clique em{" "}
                  <span className="text-foreground">"Reveal"</span> na seção{" "}
                  <span className="text-foreground">"Signing secret"</span>
                </li>
                <li>
                  Copie o valor{" "}
                  <code className="bg-muted px-1 rounded">whsec_...</code> e
                  cole aqui
                </li>
              </ol>
            </div>

            <div className="border-t border-border" />

            <div className="space-y-1">
              <p className="font-semibold text-foreground">URL do Webhook:</p>
              <WebhookUrlBox url={webhookUrl} />
            </div>

            <div className="p-2 rounded bg-warning/10 border border-warning/30 text-warning">
              💡 <strong>Testes locais:</strong> Use o Stripe CLI —{" "}
              <code className="bg-muted px-1 rounded">
                stripe listen --forward-to localhost:3000/api/stripe/webhook
              </code>{" "}
              — ele gera um{" "}
              <code className="bg-muted px-1 rounded">whsec_...</code>{" "}
              temporário para desenvolvimento.
            </div>
          </div>
        )}
      </div>
    );
  }

  if (provider === "asaas") {
    return (
      <div className="rounded-lg border border-border overflow-hidden">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between px-3 py-2.5 bg-panel hover:bg-accent transition-colors text-left"
        >
          <div className="flex items-center gap-2 text-sm text-foreground font-medium">
            <Info className="w-4 h-4 text-success" />
            Como obter a API Key do Asaas
          </div>
          {open ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </button>

        {open && (
          <div className="px-3 pb-3 pt-2 bg-panel space-y-3 text-xs text-muted-foreground">
            {/* API Key */}
            <div className="space-y-1">
              <p className="font-semibold text-foreground">
                1. API Key (token de acesso)
              </p>
              <ol className="space-y-1 list-decimal list-inside">
                <li>
                  Acesse{" "}
                  <a
                    href="https://www.asaas.com/config/accessToken"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-success hover:underline inline-flex items-center gap-0.5"
                  >
                    asaas.com → Configurações → Integrações{" "}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </li>
                <li>
                  Clique em{" "}
                  <span className="text-foreground">"Gerar novo token"</span>
                </li>
                <li>
                  Copie o token{" "}
                  <code className="bg-muted px-1 rounded">$aact_...</code> e
                  cole no campo API Key
                </li>
              </ol>
              <p className="text-muted-foreground italic">
                Para sandbox, acesse{" "}
                <code className="bg-muted px-1 rounded">
                  sandbox.asaas.com
                </code>{" "}
                e crie uma conta de teste.
              </p>
            </div>

            <div className="border-t border-border" />

            {/* Webhook */}
            <div className="space-y-1">
              <p className="font-semibold text-foreground">
                2. Webhook (notificação de pagamento)
              </p>
              <ol className="space-y-1 list-decimal list-inside">
                <li>
                  Acesse{" "}
                  <a
                    href="https://www.asaas.com/config/webhookConfig"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-success hover:underline inline-flex items-center gap-0.5"
                  >
                    asaas.com → Configurações → Notificações/Webhook{" "}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </li>
                <li>Cole a URL abaixo no campo de URL</li>
                <li>
                  Ative os eventos:{" "}
                  <code className="bg-muted px-1 rounded">
                    PAYMENT_RECEIVED
                  </code>{" "}
                  e{" "}
                  <code className="bg-muted px-1 rounded">
                    PAYMENT_CONFIRMED
                  </code>
                </li>
                <li>Salve</li>
              </ol>
              <div className="mt-1.5">
                <WebhookUrlBox url={webhookUrl} />
              </div>
            </div>

            <div className="p-2 rounded bg-warning/10 border border-warning/30 text-warning">
              ⚠️ O Asaas <strong>usa token de webhook</strong>, no header{" "}
              <code>asaas-access-token</code> — este endpoint (recarga de Stars)
              ainda <strong>não valida</strong>, e isso é o item S1 da auditoria
              de segurança. O PIX do trafeGO valida, e lê as credenciais do
              ambiente (<code>ASAAS_*</code>), não desta tela.
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}

// ── Gateway Form Dialog ───────────────────────────────────────────────────────

function GatewayFormDialog({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing: GatewayRow | null;
}) {
  const qc = useQueryClient();
  const [provider, setProvider] = useState(editing?.provider ?? "stripe");
  const [label, setLabel] = useState(editing?.label ?? "");
  const [secretKey, setSecretKey] = useState(
    editing ? editing.secretKeyMask : "",
  );
  const [publicKey, setPublicKey] = useState(editing?.publicKey ?? "");
  const [webhookSecret, setWebhookSecret] = useState(
    editing?.hasWebhookSecret ? "••••••••••••" : "",
  );
  const [environment, setEnvironment] = useState(
    editing?.environment ?? "production",
  );
  const [isDefault, setIsDefault] = useState(editing?.isDefault ?? false);
  const [showSecret, setShowSecret] = useState(false);
  const [showWebhook, setShowWebhook] = useState(false);

  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://seudominio.com";
  const webhookUrl =
    provider === "stripe"
      ? `${origin}/api/stripe/webhook`
      : `${origin}/api/payments/asaas/webhook`;

  const { mutate: save, isPending } = useMutation({
    ...orpc.admin.setGatewayConfig.mutationOptions(),
    onSuccess: () => {
      toast.success(editing ? "Gateway atualizado!" : "Gateway adicionado!");
      qc.invalidateQueries(orpc.admin.listGatewayConfigs.queryOptions());
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSave = () => {
    if (!secretKey || secretKey.length < 4)
      return toast.error("Chave secreta obrigatória.");
    save({
      id: editing?.id,
      provider: provider as "stripe" | "asaas",
      label: label || undefined,
      secretKey,
      publicKey: publicKey || undefined,
      webhookSecret: webhookSecret || undefined,
      environment: environment as "production" | "sandbox",
      isDefault,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-lg bg-card border-border text-foreground max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {editing ? "Editar Gateway" : "Adicionar Gateway de Pagamento"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Provider */}
          <div className="space-y-1.5">
            <Label className="text-foreground">Provedor</Label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger className="bg-panel border-border text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-panel border-border text-foreground">
                <SelectItem value="stripe">
                  💳 Stripe — Cartão de crédito/débito
                </SelectItem>
                <SelectItem value="asaas">
                  🏦 Asaas — PIX, Boleto e Cartão BR
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Setup guide */}
          <SetupGuide provider={provider} webhookUrl={webhookUrl} />

          {/* Label */}
          <div className="space-y-1.5">
            <Label className="text-foreground">
              Nome de exibição <span className="text-muted-foreground">(opcional)</span>
            </Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={
                provider === "stripe" ? "Ex: Stripe Principal" : "Ex: Asaas PIX"
              }
              className="bg-panel border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>

          {/* Environment */}
          <div className="space-y-1.5">
            <Label className="text-foreground">Ambiente</Label>
            <Select value={environment} onValueChange={setEnvironment}>
              <SelectTrigger className="bg-panel border-border text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-panel border-border text-foreground">
                <SelectItem value="production">
                  🔴 Produção — cobranças reais
                </SelectItem>
                <SelectItem value="sandbox">
                  🟡 Sandbox — apenas para testes
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Secret Key */}
          <div className="space-y-1.5">
            <Label className="text-foreground">
              {provider === "stripe"
                ? "Secret Key"
                : "API Key (token de acesso)"}
            </Label>
            <div className="relative">
              <Input
                type={showSecret ? "text" : "password"}
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                placeholder={
                  provider === "stripe"
                    ? "sk_live_... ou sk_test_..."
                    : "$aact_..."
                }
                className="bg-panel border-border text-foreground placeholder:text-muted-foreground pr-10"
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showSecret ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Stripe-specific fields */}
          {provider === "stripe" && (
            <>
              <div className="space-y-1.5">
                <Label className="text-foreground">
                  Publishable Key{" "}
                  <span className="text-muted-foreground">
                    (opcional, para uso no frontend)
                  </span>
                </Label>
                <Input
                  value={publicKey}
                  onChange={(e) => setPublicKey(e.target.value)}
                  placeholder="pk_live_... ou pk_test_..."
                  className="bg-panel border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-foreground">
                  Webhook Secret
                  <span className="ml-2 text-[10px] text-warning font-normal">
                    Necessário para confirmar pagamentos
                  </span>
                </Label>
                <div className="relative">
                  <Input
                    type={showWebhook ? "text" : "password"}
                    value={webhookSecret}
                    onChange={(e) => setWebhookSecret(e.target.value)}
                    placeholder="whsec_..."
                    className="bg-panel border-border text-foreground placeholder:text-muted-foreground pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowWebhook(!showWebhook)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showWebhook ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Encontrado no painel Stripe → Developers → Webhooks → seu
                  endpoint → &quot;Signing secret&quot;. Veja as instruções
                  acima.
                </p>
              </div>
            </>
          )}

          {/* Is Default */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-panel border border-border">
            <div>
              <p className="text-sm font-medium text-foreground">Gateway padrão</p>
              <p className="text-xs text-muted-foreground">
                Priorizado quando houver múltiplos gateways ativos
              </p>
            </div>
            <Switch
              checked={isDefault}
              onCheckedChange={setIsDefault}
            />
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
                ? "Atualizar Gateway"
                : "Adicionar Gateway"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main PaymentsManager ──────────────────────────────────────────────────────

export function PaymentsManager() {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<GatewayRow | null>(null);
  const [activeTab, setActiveTab] = useState<"gateways" | "payments">(
    "gateways",
  );

  const { data, isLoading } = useQuery(
    orpc.admin.listGatewayConfigs.queryOptions(),
  );

  const { mutate: deleteGw } = useMutation({
    ...orpc.admin.deleteGatewayConfig.mutationOptions(),
    onSuccess: () => {
      toast.success("Gateway removido.");
      qc.invalidateQueries(orpc.admin.listGatewayConfigs.queryOptions());
    },
    onError: (e) => toast.error(e.message),
  });

  const { mutate: toggleActive } = useMutation({
    ...orpc.admin.toggleGatewayActive.mutationOptions(),
    onSuccess: () =>
      qc.invalidateQueries(orpc.admin.listGatewayConfigs.queryOptions()),
    onError: (e) => toast.error(e.message),
  });

  const { data: paymentsData } = useQuery({
    ...orpc.admin.listStarsPayments.queryOptions({
      input: { limit: 50, offset: 0 },
    }),
    enabled: activeTab === "payments",
  });

  const gateways = data?.gateways ?? [];

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-full bg-panel p-1">
        {(["gateways", "payments"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors",
              activeTab === tab
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab === "gateways"
              ? "🔌 Gateways Configurados"
              : "📋 Histórico de Pagamentos"}
          </button>
        ))}
      </div>

      {activeTab === "gateways" && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-foreground">
                Gateways de Pagamento
              </h2>
              <p className="text-sm text-muted-foreground">
                Configure os provedores de pagamento disponíveis para compra de
                Stars e planos.
              </p>
            </div>
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              className="gap-2"
            >
              <Plus className="w-4 h-4" /> Adicionar Gateway
            </Button>
          </div>

          {/* Info banner */}
          <div className="flex gap-3 p-4 rounded-xl bg-warning/10 border border-warning/30">
            <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
            <div className="text-sm text-warning space-y-1">
              <p className="font-medium text-warning">Como funciona</p>
              <p>
                As chaves configuradas aqui são usadas para processar pagamentos
                de Stars e planos. Use chaves de produção apenas quando estiver
                pronto para cobranças reais. Configure o webhook de cada
                provedor para garantir que Stars sejam creditadas após
                pagamento.
              </p>
            </div>
          </div>

          {/* Gateway cards */}
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="h-24 bg-panel rounded-xl animate-pulse"
                />
              ))}
            </div>
          ) : gateways.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <Landmark className="w-12 h-12 text-muted-foreground" />
              <p className="text-muted-foreground font-medium">
                Nenhum gateway configurado
              </p>
              <p className="text-muted-foreground text-sm max-w-xs">
                Adicione Stripe ou Asaas para aceitar pagamentos de Stars e
                planos.
              </p>
              <Button
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
                variant="outline"
                className="border-info/50 text-info hover:bg-info/10 mt-2 gap-2"
              >
                <Plus className="w-4 h-4" /> Adicionar primeiro gateway
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {gateways.map((gw) => {
                const meta = PROVIDER_META[gw.provider] ?? {
                  name: gw.provider,
                  color: "text-muted-foreground",
                  bg: "bg-panel",
                  logo: "💰",
                };
                return (
                  <div
                    key={gw.id}
                    className={cn(
                      "p-4 rounded-xl border border-border",
                      meta.bg,
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl">{meta.logo}</div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-foreground">
                              {gw.label ?? meta.name}
                            </p>
                            {gw.isDefault && (
                              <Badge className="bg-info/30 text-info border-info/50 text-[10px]">
                                Padrão
                              </Badge>
                            )}
                            <Badge
                              className={cn(
                                "text-[10px]",
                                gw.environment === "production"
                                  ? "bg-destructive/10 text-destructive border-destructive/30"
                                  : "bg-warning/10 text-warning border-warning/30",
                              )}
                            >
                              {gw.environment === "production"
                                ? "Produção"
                                : "Sandbox"}
                            </Badge>
                          </div>
                          <p
                            className={cn(
                              "text-xs font-mono mt-0.5",
                              meta.color,
                            )}
                          >
                            {gw.secretKeyMask}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {gw.isActive ? (
                          <CheckCircle2 className="w-4 h-4 text-success" />
                        ) : (
                          <XCircle className="w-4 h-4 text-muted-foreground" />
                        )}
                        <span
                          className={cn(
                            "text-xs",
                            gw.isActive ? "text-success" : "text-muted-foreground",
                          )}
                        >
                          {gw.isActive ? "Ativo" : "Inativo"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border">
                      <button
                        onClick={() =>
                          toggleActive({ id: gw.id, isActive: !gw.isActive })
                        }
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {gw.isActive ? (
                          <ToggleRight className="w-4 h-4 text-success" />
                        ) : (
                          <ToggleLeft className="w-4 h-4" />
                        )}
                        {gw.isActive ? "Desativar" : "Ativar"}
                      </button>

                      <button
                        onClick={() => {
                          setEditing(gw);
                          setFormOpen(true);
                        }}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors ml-2"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Editar
                      </button>

                      <button
                        onClick={() => {
                          if (confirm(`Remover ${gw.label ?? meta.name}?`))
                            deleteGw({ id: gw.id });
                        }}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors ml-2"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remover
                      </button>

                      <div className="ml-auto flex gap-2 text-xs text-muted-foreground">
                        {gw.publicKey && (
                          <span title="Publishable key configurada">
                            <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />
                          </span>
                        )}
                        {gw.hasWebhookSecret && (
                          <span title="Webhook secret configurado">
                            <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground" />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {activeTab === "payments" && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-foreground">
            Histórico de Pagamentos — Stars
          </h2>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-card">
                  {[
                    "ID",
                    "Provedor",
                    "Stars",
                    "Valor (R$)",
                    "Status",
                    "Data",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(paymentsData?.payments ?? []).map((p) => (
                  <tr
                    key={p.id}
                    className="hover:bg-accent transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {p.id.slice(0, 8)}…
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-xs font-medium",
                          p.provider === "stripe"
                            ? "bg-info/15 text-info"
                            : "bg-success/15 text-success",
                        )}
                      >
                        {p.provider}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-foreground font-medium">
                      +{p.starsAmount.toLocaleString("pt-BR")} ★
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      R$ {p.amountBrl.toFixed(2).replace(".", ",")}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-xs font-medium",
                          {
                            "bg-success/15 text-success":
                              p.status === "paid",
                            "bg-warning/15 text-warning":
                              p.status === "pending",
                            "bg-destructive/15 text-destructive": p.status === "failed",
                          },
                        )}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {new Date(p.createdAt).toLocaleDateString("pt-BR")}
                    </td>
                  </tr>
                ))}
                {(paymentsData?.payments ?? []).length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-12 text-center text-muted-foreground"
                    >
                      Nenhum pagamento registrado ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <GatewayFormDialog
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
