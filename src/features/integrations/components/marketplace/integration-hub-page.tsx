"use client";

import { useState } from "react";
import type { Integration } from "@/types/integration";
import { CATEGORY_LABELS, CATEGORY_ICONS } from "@/types/integration";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InstallModal } from "./install-modal";
import { CredentialForm } from "./credential-form";
import {
  CheckCircle2, ArrowLeft, ExternalLink, Lock, Zap,
  Star, Shield, Clock, Users, ArrowRight, BarChart2, KeyRound,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useMarketplace } from "@/features/integrations/context/marketplace-context";
import { StarCostBadge } from "@/features/stars";

interface IntegrationHubPageProps {
  integration: Integration;
}

// Generic features list based on category
const CATEGORY_FEATURES: Record<string, string[]> = {
  messengers: ["Receba mensagens direto no CRM", "Histórico completo de conversas", "Resposta automática com IA", "Captura de leads de qualquer interação"],
  whatsapp_providers: ["Conexão via API oficial", "Templates de mensagens aprovadas", "Múltiplos números na mesma conta", "Relatórios de entrega e leitura"],
  live_chat: ["Chat em tempo real no site", "Distribuição automática de atendentes", "Histórico salvo no perfil do lead", "Integração com pipeline de vendas"],
  forms: ["Captura automática de respostas", "Mapeamento de campos personalizado", "Criação de leads na submissão", "Trigger de automações"],
  ecommerce: ["Sincronização de pedidos e clientes", "Abandono de carrinho como lead", "Histórico de compras no CRM", "Segmentação por valor de compra"],
  chatbots: ["Transferência de conversa ao CRM", "Captura de dados do usuário", "Qualificação automática de leads", "Escalada para atendente humano"],
  marketing: ["Importação de contatos", "Sincronização bidirecional", "Triggers de automação", "Relatório de atribuição"],
  payments: ["Link de pagamento no FORGE", "Notificação ao receber pagamento", "Atualização de status da proposta", "Webhook de confirmação"],
  analytics: ["Dashboard unificado", "Relatórios exportáveis", "Métricas em tempo real", "Integração com outros dashboards"],
  documents: ["Assinar contratos do FORGE", "Notificação ao concluir assinatura", "Armazenamento seguro", "Validade jurídica"],
  integration_services: ["Conecte +5.000 apps sem código", "Triggers automáticos", "Filtros e transformações de dados", "Webhooks personalizados"],
  productivity: ["Sync de calendários e reuniões", "Criação automática de tarefas", "Notificações de follow-up", "Gestão de equipe integrada"],
  default: ["Integração nativa ao pipeline", "Sincronização em tempo real", "Automações configuráveis", "Suporte técnico dedicado"],
};

// Step-by-step guide based on category
const SETUP_STEPS: Record<string, { title: string; desc: string }[]> = {
  payments: [
    { title: "Configure as credenciais", desc: "Acesse Configurações → FORGE → Gateways de Pagamento e insira as chaves da API." },
    { title: "Crie uma proposta", desc: "Na aba Propostas do FORGE, crie uma nova proposta com o produto e valor." },
    { title: "Gere o link de pagamento", desc: "Selecione o gateway e clique em 'Gerar Link'. Copie e envie ao cliente." },
    { title: "Acompanhe o pagamento", desc: "O status da proposta atualiza automaticamente quando o cliente pagar." },
  ],
  default: [
    { title: "Instale a integração", desc: "Clique em 'Instalar' e confirme no modal." },
    { title: "Configure as credenciais", desc: "Acesse Satélites e insira as chaves de API." },
    { title: "Mapeie seus dados", desc: "Configure quais campos sincronizam entre os sistemas." },
    { title: "Ative e teste", desc: "Ative a integração e faça um teste com um lead de teste." },
  ],
};

function IntegrationLogo({ integration }: { integration: Integration }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const isUrl = integration.icon.startsWith("http");
  const fallbackEmoji = !isUrl ? integration.icon : (CATEGORY_ICONS[integration.category] ?? "🔌");

  return (
    <div className="size-16 rounded-2xl overflow-hidden flex items-center justify-center shrink-0 relative shadow-lg">
      <div className={cn(
        "absolute inset-0 rounded-2xl bg-gradient-to-br from-info/20 to-info/10 border border-info/30 flex items-center justify-center text-3xl",
        isUrl && imgLoaded && !imgFailed && "opacity-0",
      )}>
        {fallbackEmoji}
      </div>
      {isUrl && !imgFailed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={integration.icon}
          alt={integration.name}
          className={cn("absolute inset-0 size-full object-contain bg-white p-2.5 transition-opacity duration-200", imgLoaded ? "opacity-100" : "opacity-0")}
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgFailed(true)}
        />
      )}
    </div>
  );
}

const METRICS = [
  { icon: Star, label: "Avaliação", value: "4.8/5" },
  { icon: Users, label: "Usuários", value: "12k+" },
  { icon: Shield, label: "Segurança", value: "LGPD" },
  { icon: Clock, label: "Setup", value: "< 5 min" },
];

export function IntegrationHubPage({ integration }: IntegrationHubPageProps) {
  const [installOpen, setInstallOpen] = useState(false);
  const { isInstalled } = useMarketplace();
  const installed = isInstalled(integration.slug) || integration.status === "installed";
  const features = CATEGORY_FEATURES[integration.category] ?? CATEGORY_FEATURES.default;
  const steps = SETUP_STEPS[integration.category] ?? SETUP_STEPS.default;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back */}
      <Link
        href="/integrations"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-4" /> Voltar ao marketplace
      </Link>

      <div className="dark relative overflow-hidden rounded-[28px] bg-background text-foreground">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-0 right-1/4 size-72 rounded-full bg-info/15 blur-3xl" />
          <div className="absolute bottom-0 left-1/4 size-48 rounded-full bg-info/10 blur-3xl" />
        </div>

        <div className="relative z-10 p-6 md:p-10">
          <div className="flex flex-col sm:flex-row items-start gap-5">
            <IntegrationLogo integration={integration} />

            <div className="flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-card text-muted-foreground border-line text-[11px] gap-1">
                  <span>{CATEGORY_ICONS[integration.category]}</span>
                  {CATEGORY_LABELS[integration.category]}
                </Badge>
                {integration.tags.filter((t) => !["Instalado", "Visualizar"].includes(t)).map((t) => (
                  <Badge key={t} className="bg-info/15 text-info border-info/30 text-[11px]">
                    {t}
                  </Badge>
                ))}
                {installed && (
                  <Badge className="bg-success/20 text-success border-success/30 text-[11px] gap-1">
                    <CheckCircle2 className="size-3" /> Instalado
                  </Badge>
                )}
              </div>

              <h1 className="text-2xl md:text-3xl font-bold">{integration.name}</h1>
              <p className="text-sm text-muted-foreground max-w-lg leading-relaxed">{integration.description}</p>
              <StarCostBadge appSlug={integration.slug} showSetup className="[&>span]:bg-card [&>span]:text-muted-foreground [&>span]:border-line" />

              <div className="flex flex-wrap gap-2 pt-1">
                {installed ? (
                  <Button className="gap-2 bg-success hover:bg-success/90 text-primary-foreground" asChild>
                    <Link href="/insights">
                      <BarChart2 className="size-4" /> Ver Insights
                    </Link>
                  </Button>
                ) : integration.status === "view_only" ? (
                  <Button disabled className="gap-2 bg-warning/20 text-warning border border-warning/30 cursor-not-allowed">
                    <Lock className="size-4" /> Em Breve
                  </Button>
                ) : (
                  <Button
                    className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
                    onClick={() => setInstallOpen(true)}
                  >
                    <Zap className="size-4" /> Instalar agora
                  </Button>
                )}

                {integration.connectUrl && (
                  <Button variant="outline" className="gap-2" asChild>
                    <a href={integration.connectUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="size-4" /> Documentação
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-2">
            {METRICS.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-2.5">
                <div className="size-8 rounded-full bg-knob flex items-center justify-center shrink-0">
                  <Icon className="size-4 text-info" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{value}</p>
                  <p className="text-[10px] text-muted-foreground">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Features */}
        <div className="border rounded-xl p-5 space-y-4 bg-card">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <Zap className="size-4 text-info" />
            Funcionalidades incluídas
          </h2>
          <ul className="space-y-2.5">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm">
                <CheckCircle2 className="size-4 text-success mt-0.5 shrink-0" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Setup steps */}
        <div className="border rounded-xl p-5 space-y-4 bg-card">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <ArrowRight className="size-4 text-info" />
            Como configurar
          </h2>
          <ol className="space-y-3">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <div className={cn(
                  "size-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5",
                  "bg-info/10 text-info",
                )}>
                  {i + 1}
                </div>
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{step.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* ── Credential Configuration Section ── */}
      {(integration.credentials ?? []).length > 0 && (
        <div className="border rounded-xl bg-card overflow-hidden">
          {/* Section header */}
          <div className={cn(
            "flex items-center gap-3 px-5 py-4",
            installed
              ? "bg-gradient-to-r from-success/5 to-card"
              : "bg-muted/30",
          )}>
            <div className={cn(
              "size-9 rounded-lg flex items-center justify-center shrink-0",
              installed ? "bg-success/15" : "bg-info/10",
            )}>
              <KeyRound className={cn("size-4", installed ? "text-success" : "text-info")} />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-sm flex items-center gap-2">
                Configurar Credenciais
                {installed && (
                  <Badge className="bg-success/15 text-success border-success/30 text-[10px]">
                    <CheckCircle2 className="size-3 mr-1" /> Integração ativa
                  </Badge>
                )}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {installed
                  ? "Insira ou atualize as credenciais da sua conta para ativar a integração."
                  : "Instale a integração primeiro, depois configure as credenciais."}
              </p>
            </div>
            {!installed && (
              <Button
                size="sm"
                className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 shrink-0"
                onClick={() => setInstallOpen(true)}
              >
                <Zap className="size-3.5" /> Instalar primeiro
              </Button>
            )}
          </div>

          {/* Step indicator */}
          <div className="px-5 py-3 bg-muted/10 flex items-center gap-6">
            {[
              { n: 1, label: "Habilitar integração", done: installed },
              { n: 2, label: "Inserir credenciais", done: false },
              { n: 3, label: "Integração ativa", done: false },
            ].map((step, i) => (
              <div key={step.n} className="flex items-center gap-2">
                <div className={cn(
                  "size-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
                  step.done
                    ? "bg-success text-primary-foreground"
                    : i === 1 && installed
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                )}>
                  {step.done ? <CheckCircle2 className="size-3" /> : step.n}
                </div>
                <span className={cn(
                  "text-xs",
                  step.done ? "text-success font-medium" : "text-muted-foreground",
                )}>
                  {step.label}
                </span>
                {i < 2 && <ArrowRight className="size-3 text-muted-foreground/30 ml-2" />}
              </div>
            ))}
          </div>

          {/* Form */}
          <div className={cn("px-5 pb-5 pt-4", !installed && "opacity-40 pointer-events-none select-none")}>
            <CredentialForm
              slug={integration.slug}
              fields={integration.credentials ?? []}
              oauthProvider={integration.oauthProvider}
              manualFallback={integration.manualFallback ?? true}
            />
          </div>
        </div>
      )}

      {/* CTA */}
      {!installed && (
        <div className="border rounded-xl p-6 bg-info/5 border-info/20 flex flex-col sm:flex-row items-center gap-4">
          <div className="flex-1 space-y-1">
            <p className="font-semibold">Pronto para integrar?</p>
            <p className="text-sm text-muted-foreground">
              Configure em menos de 5 minutos e comece a capturar leads automaticamente.
            </p>
          </div>
          {integration.status === "view_only" ? (
            <Button disabled className="gap-2 border-warning/30 text-warning bg-warning/10 cursor-not-allowed">
              <Lock className="size-4" /> Em Breve
            </Button>
          ) : (
            <Button
              className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
              onClick={() => setInstallOpen(true)}
            >
              <Zap className="size-4" /> Instalar {integration.name}
            </Button>
          )}
        </div>
      )}

      {/* Install modal */}
      {installOpen && (
        <InstallModal
          integration={integration}
          open={installOpen}
          onClose={() => setInstallOpen(false)}
        />
      )}
    </div>
  );
}
