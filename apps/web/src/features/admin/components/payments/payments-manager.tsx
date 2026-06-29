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
    color: "text-indigo-400",
    bg: "bg-indigo-950/40",
    logo: "💳",
  },
  asaas: {
    name: "Asaas",
    color: "text-green-400",
    bg: "bg-green-950/40",
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
    <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-600 rounded-lg px-3 py-2">
      <code className="flex-1 text-[11px] text-violet-300 break-all font-mono">
        {url}
      </code>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 text-zinc-400 hover:text-white transition-colors"
        title="Copiar URL"
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-emerald-400" />
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
      <div className="rounded-lg border border-zinc-700 overflow-hidden">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between px-3 py-2.5 bg-zinc-800/60 hover:bg-zinc-800 transition-colors text-left"
        >
          <div className="flex items-center gap-2 text-sm text-zinc-300 font-medium">
            <Info className="w-4 h-4 text-indigo-400" />
            Como obter as chaves do Stripe
          </div>
          {open ? (
            <ChevronUp className="w-4 h-4 text-zinc-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-zinc-500" />
          )}
        </button>

        {open && (
          <div className="px-3 pb-3 pt-2 bg-zinc-800/30 space-y-3 text-xs text-zinc-400">
            {/* Secret Key */}
            <div className="space-y-1">
              <p className="font-semibold text-zinc-200">
                1. Secret Key & Publishable Key
              </p>
              <ol className="space-y-1 list-decimal list-inside text-zinc-400">
                <li>
                  Acesse{" "}
                  <a
                    href="https://dashboard.stripe.com/apikeys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-400 hover:underline inline-flex items-center gap-0.5"
                  >
                    dashboard.stripe.com/apikeys{" "}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </li>
                <li>
                  Copie a <span className="text-zinc-200">Secret key</span>{" "}
                  <code className="bg-zinc-700 px-1 rounded">sk_live_...</code>
                </li>
                <li>
                  Copie a <span className="text-zinc-200">Publishable key</span>{" "}
                  <code className="bg-zinc-700 px-1 rounded">pk_live_...</code>
                </li>
              </ol>
              <p className="text-zinc-500 italic">
                Para testes, use as chaves{" "}
                <code className="bg-zinc-700 px-1 rounded">sk_test_...</code>{" "}
                com ambiente Sandbox.
              </p>
            </div>

            <div className="border-t border-zinc-700" />

            {/* Webhook Secret */}
            <div className="space-y-1">
              <p className="font-semibold text-zinc-200">
                2. Webhook Secret{" "}
                <code className="bg-zinc-700 px-1 rounded text-violet-300">
                  whsec_...
                </code>
              </p>
              <ol className="space-y-1 list-decimal list-inside text-zinc-400">
                <li>
                  Acesse{" "}
                  <a
                    href="https://dashboard.stripe.com/webhooks"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-400 hover:underline inline-flex items-center gap-0.5"
                  >
                    dashboard.stripe.com/webhooks{" "}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </li>
                <li>
                  Clique em{" "}
                  <span className="text-zinc-200">"Add destination"</span>
                </li>
                <li>
                  Cole a URL do webhook abaixo no campo{" "}
                  <span className="text-zinc-200">"Endpoint URL"</span>
                </li>
                <li>
                  Em eventos, selecione:{" "}
                  <code className="bg-zinc-700 px-1 rounded">
                    checkout.session.completed
                  </code>
                </li>
                <li>
                  Clique em{" "}
                  <span className="text-zinc-200">"Add endpoint"</span>
                </li>
                <li>
                  Abra o endpoint criado → clique em{" "}
                  <span className="text-zinc-200">"Reveal"</span> na seção{" "}
                  <span className="text-zinc-200">"Signing secret"</span>
                </li>
                <li>
                  Copie o valor{" "}
                  <code className="bg-zinc-700 px-1 rounded">whsec_...</code> e
                  cole aqui
                </li>
              </ol>
            </div>

            <div className="border-t border-zinc-700" />

            <div className="space-y-1">
              <p className="font-semibold text-zinc-200">URL do Webhook:</p>
              <WebhookUrlBox url={webhookUrl} />
            </div>

            <div className="p-2 rounded bg-amber-950/40 border border-amber-800/30 text-amber-300">
              💡 <strong>Testes locais:</strong> Use o Stripe CLI —{" "}
              <code className="bg-zinc-700 px-1 rounded">
                stripe listen --forward-to localhost:3000/api/stripe/webhook
              </code>{" "}
              — ele gera um{" "}
              <code className="bg-zinc-700 px-1 rounded">whsec_...</code>{" "}
              temporário para desenvolvimento.
            </div>
          </div>
        )}
      </div>
    );
  }

  if (provider === "asaas") {
    return (
      <div className="rounded-lg border border-zinc-700 overflow-hidden">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between px-3 py-2.5 bg-zinc-800/60 hover:bg-zinc-800 transition-colors text-left"
        >
          <div className="flex items-center gap-2 text-sm text-zinc-300 font-medium">
            <Info className="w-4 h-4 text-green-400" />
            Como obter a API Key do Asaas
          </div>
          {open ? (
            <ChevronUp className="w-4 h-4 text-zinc-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-zinc-500" />
          )}
        </button>

        {open && (
          <div className="px-3 pb-3 pt-2 bg-zinc-800/30 space-y-3 text-xs text-zinc-400">
            {/* API Key */}
            <div className="space-y-1">
              <p className="font-semibold text-zinc-200">
                1. API Key (token de acesso)
              </p>
              <ol className="space-y-1 list-decimal list-inside">
                <li>
                  Acesse{" "}
                  <a
                    href="https://www.asaas.com/config/accessToken"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-400 hover:underline inline-flex items-center gap-0.5"
                  >
                    asaas.com → Configurações → Integrações{" "}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </li>
                <li>
                  Clique em{" "}
                  <span className="text-zinc-200">"Gerar novo token"</span>
                </li>
                <li>
                  Copie o token{" "}
                  <code className="bg-zinc-700 px-1 rounded">$aact_...</code> e
                  cole no campo API Key
                </li>
              </ol>
              <p className="text-zinc-500 italic">
                Para sandbox, acesse{" "}
                <code className="bg-zinc-700 px-1 rounded">
                  sandbox.asaas.com
                </code>{" "}
                e crie uma conta de teste.
              </p>
            </div>

            <div className="border-t border-zinc-700" />

            {/* Webhook */}
            <div className="space-y-1">
              <p className="font-semibold text-zinc-200">
                2. Webhook (notificação de pagamento)
              </p>
              <ol className="space-y-1 list-decimal list-inside">
                <li>
                  Acesse{" "}
                  <a
                    href="https://www.asaas.com/config/webhookConfig"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-400 hover:underline inline-flex items-center gap-0.5"
                  >
                    asaas.com → Configurações → Notificações/Webhook{" "}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </li>
                <li>Cole a URL abaixo no campo de URL</li>
                <li>
                  Ative os eventos:{" "}
                  <code className="bg-zinc-700 px-1 rounded">
                    PAYMENT_RECEIVED
                  </code>{" "}
                  e{" "}
                  <code className="bg-zinc-700 px-1 rounded">
                    PAYMENT_CONFIRMED
                  </code>
                </li>
                <li>Salve</li>
              </ol>
              <div className="mt-1.5">
                <WebhookUrlBox url={webhookUrl} />
              </div>
            </div>

            <div className="p-2 rounded bg-green-950/40 border border-green-800/30 text-green-300">
              ℹ️ O Asaas <strong>não usa Webhook Secret</strong> — a
              autenticação é feita pelo token da API. O campo &quot;Webhook
              Secret&quot; não é necessário para o Asaas.
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

  console.log(webhookUrl);

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
      <DialogContent className="max-w-lg bg-zinc-900 border-zinc-700 text-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">
            {editing ? "Editar Gateway" : "Adicionar Gateway de Pagamento"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Provider */}
          <div className="space-y-1.5">
            <Label className="text-zinc-300">Provedor</Label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
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
            <Label className="text-zinc-300">
              Nome de exibição <span className="text-zinc-500">(opcional)</span>
            </Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={
                provider === "stripe" ? "Ex: Stripe Principal" : "Ex: Asaas PIX"
              }
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
            />
          </div>

          {/* Environment */}
          <div className="space-y-1.5">
            <Label className="text-zinc-300">Ambiente</Label>
            <Select value={environment} onValueChange={setEnvironment}>
              <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
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
            <Label className="text-zinc-300">
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
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
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
                <Label className="text-zinc-300">
                  Publishable Key{" "}
                  <span className="text-zinc-500">
                    (opcional, para uso no frontend)
                  </span>
                </Label>
                <Input
                  value={publicKey}
                  onChange={(e) => setPublicKey(e.target.value)}
                  placeholder="pk_live_... ou pk_test_..."
                  className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-zinc-300">
                  Webhook Secret
                  <span className="ml-2 text-[10px] text-amber-400 font-normal">
                    Necessário para confirmar pagamentos
                  </span>
                </Label>
                <div className="relative">
                  <Input
                    type={showWebhook ? "text" : "password"}
                    value={webhookSecret}
                    onChange={(e) => setWebhookSecret(e.target.value)}
                    placeholder="whsec_..."
                    className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowWebhook(!showWebhook)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                  >
                    {showWebhook ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-zinc-500">
                  Encontrado no painel Stripe → Developers → Webhooks → seu
                  endpoint → &quot;Signing secret&quot;. Veja as instruções
                  acima.
                </p>
              </div>
            </>
          )}

          {/* Is Default */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-800 border border-zinc-700">
            <div>
              <p className="text-sm font-medium text-white">Gateway padrão</p>
              <p className="text-xs text-zinc-400">
                Priorizado quando houver múltiplos gateways ativos
              </p>
            </div>
            <Switch
              checked={isDefault}
              onCheckedChange={setIsDefault}
              className="data-[state=checked]:bg-violet-600"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={onClose}
            className="text-zinc-400 hover:text-white"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={isPending}
            className="bg-violet-600 hover:bg-violet-700 text-white"
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
      <div className="flex gap-2 border-b border-zinc-800">
        {(["gateways", "payments"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              activeTab === tab
                ? "border-violet-500 text-violet-300"
                : "border-transparent text-zinc-500 hover:text-zinc-300",
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
              <h2 className="text-lg font-bold text-white">
                Gateways de Pagamento
              </h2>
              <p className="text-sm text-zinc-400">
                Configure os provedores de pagamento disponíveis para compra de
                Stars e planos.
              </p>
            </div>
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              className="bg-violet-600 hover:bg-violet-700 text-white gap-2"
            >
              <Plus className="w-4 h-4" /> Adicionar Gateway
            </Button>
          </div>

          {/* Info banner */}
          <div className="flex gap-3 p-4 rounded-xl bg-amber-950/20 border border-amber-800/30">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-200/80 space-y-1">
              <p className="font-medium text-amber-300">Como funciona</p>
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
                  className="h-24 bg-zinc-800 rounded-xl animate-pulse"
                />
              ))}
            </div>
          ) : gateways.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <Landmark className="w-12 h-12 text-zinc-700" />
              <p className="text-zinc-400 font-medium">
                Nenhum gateway configurado
              </p>
              <p className="text-zinc-600 text-sm max-w-xs">
                Adicione Stripe ou Asaas para aceitar pagamentos de Stars e
                planos.
              </p>
              <Button
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
                variant="outline"
                className="border-violet-700 text-violet-400 hover:bg-violet-950/30 mt-2 gap-2"
              >
                <Plus className="w-4 h-4" /> Adicionar primeiro gateway
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {gateways.map((gw) => {
                const meta = PROVIDER_META[gw.provider] ?? {
                  name: gw.provider,
                  color: "text-zinc-400",
                  bg: "bg-zinc-800",
                  logo: "💰",
                };
                return (
                  <div
                    key={gw.id}
                    className={cn(
                      "p-4 rounded-xl border border-zinc-700/50",
                      meta.bg,
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl">{meta.logo}</div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-white">
                              {gw.label ?? meta.name}
                            </p>
                            {gw.isDefault && (
                              <Badge className="bg-violet-600/30 text-violet-300 border-violet-700/50 text-[10px]">
                                Padrão
                              </Badge>
                            )}
                            <Badge
                              className={cn(
                                "text-[10px]",
                                gw.environment === "production"
                                  ? "bg-red-950/40 text-red-300 border-red-800/30"
                                  : "bg-yellow-950/40 text-yellow-300 border-yellow-800/30",
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
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-zinc-600" />
                        )}
                        <span
                          className={cn(
                            "text-xs",
                            gw.isActive ? "text-emerald-400" : "text-zinc-500",
                          )}
                        >
                          {gw.isActive ? "Ativo" : "Inativo"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-4 pt-3 border-t border-zinc-700/40">
                      <button
                        onClick={() =>
                          toggleActive({ id: gw.id, isActive: !gw.isActive })
                        }
                        className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
                      >
                        {gw.isActive ? (
                          <ToggleRight className="w-4 h-4 text-emerald-400" />
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
                        className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors ml-2"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Editar
                      </button>

                      <button
                        onClick={() => {
                          if (confirm(`Remover ${gw.label ?? meta.name}?`))
                            deleteGw({ id: gw.id });
                        }}
                        className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-red-400 transition-colors ml-2"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remover
                      </button>

                      <div className="ml-auto flex gap-2 text-xs text-zinc-600">
                        {gw.publicKey && (
                          <span title="Publishable key configurada">
                            <CreditCard className="w-3.5 h-3.5 text-zinc-500" />
                          </span>
                        )}
                        {gw.hasWebhookSecret && (
                          <span title="Webhook secret configurado">
                            <CheckCircle2 className="w-3.5 h-3.5 text-zinc-500" />
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
          <h2 className="text-lg font-bold text-white">
            Histórico de Pagamentos — Stars
          </h2>
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/50">
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
                      className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {(paymentsData?.payments ?? []).map((p) => (
                  <tr
                    key={p.id}
                    className="hover:bg-zinc-800/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                      {p.id.slice(0, 8)}…
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-xs font-medium",
                          p.provider === "stripe"
                            ? "bg-indigo-950/60 text-indigo-300"
                            : "bg-green-950/60 text-green-300",
                        )}
                      >
                        {p.provider}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white font-medium">
                      +{p.starsAmount.toLocaleString("pt-BR")} ★
                    </td>
                    <td className="px-4 py-3 text-white">
                      R$ {p.amountBrl.toFixed(2).replace(".", ",")}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-xs font-medium",
                          {
                            "bg-emerald-950/60 text-emerald-300":
                              p.status === "paid",
                            "bg-amber-950/60 text-amber-300":
                              p.status === "pending",
                            "bg-red-950/60 text-red-300": p.status === "failed",
                          },
                        )}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">
                      {new Date(p.createdAt).toLocaleDateString("pt-BR")}
                    </td>
                  </tr>
                ))}
                {(paymentsData?.payments ?? []).length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-12 text-center text-zinc-500"
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
