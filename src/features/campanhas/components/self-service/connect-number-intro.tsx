"use client";

import { useState } from "react";
import {
  BadgeCheck,
  Bot,
  CreditCard,
  Gift,
  Megaphone,
  ShieldCheck,
  Smartphone,
  TrendingUp,
  Users,
  Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { estimateMetaCost, formatBrlCents, metaPriceTable, type TemplateCategory } from "../../lib/meta-pricing";
import { quoteBroadcastFee } from "../../lib/broadcast-fee";

/** Convite instrutivo antes de conectar o número oficial: benefícios, custos (com simulador) e o passo a passo. */

type IntroTab = "benefits" | "costs" | "steps";

const INTRO_TABS: Array<{ id: IntroTab; label: string }> = [
  { id: "benefits", label: "Benefícios" },
  { id: "costs", label: "Custos" },
  { id: "steps", label: "Como conectar" },
];

interface InfoItem {
  icon: LucideIcon;
  title: string;
  text: string;
}

const BENEFITS: InfoItem[] = [
  { icon: Users, title: "Mais de 2 bilhões de pessoas", text: "Fale com o cliente no WhatsApp, que ele já abre todo dia." },
  { icon: ShieldCheck, title: "Número oficial, sem bloqueio", text: "API da Meta: nada de aparelho ligado nem risco de ban por disparo." },
  { icon: Megaphone, title: "Disparo em massa", text: "Modelos aprovados pela Meta para milhares de contatos, em lotes automáticos." },
  { icon: Workflow, title: "Tudo no Chat da ÓRBITA", text: "A equipe atende junto e cada resposta vira lead no funil, com o histórico." },
  { icon: Bot, title: "Astro no atendimento", text: "Automações e o Astro respondem e qualificam enquanto você vende." },
  { icon: BadgeCheck, title: "Nome da empresa no chat", text: "Perfil comercial com o nome verificado pela Meta." },
];

const WHAT_CHANGES: string[] = [
  "Todas as conversas do número passam a chegar no Chat da ÓRBITA — no computador e no celular, com a equipe toda atendendo.",
  "Mensagens que você inicia usam modelos aprovados pela Meta (texto, imagem e botões).",
  "A Meta libera volume aos poucos: começa com 250 contatos por dia e sobe conforme a qualidade.",
];

const STEPS: InfoItem[] = [
  { icon: Smartphone, title: "1. Número", text: "Use um chip livre da empresa ou peça um número pronto para a nossa equipe." },
  { icon: BadgeCheck, title: "2. Meta", text: "Entre com o Facebook da empresa e confirme o número pelo código SMS." },
  { icon: CreditCard, title: "3. Cartão na Meta", text: "Cadastre o cartão no Gerenciador da Meta — é ela que cobra as mensagens." },
  { icon: TrendingUp, title: "4. Pronto", text: "Crie o primeiro modelo e dispare. Leva uns 10 minutos no total." },
];

type PricingCategory = TemplateCategory | "SERVICE";

const PRICING_CATEGORIES: Array<{ id: PricingCategory; label: string; example: string }> = [
  { id: "MARKETING", label: "Marketing", example: "Ofertas, cupons, lançamentos e convites." },
  { id: "UTILITY", label: "Utilidade", example: "Pedido confirmado, boleto, lembrete de agenda." },
  { id: "AUTHENTICATION", label: "Autenticação", example: "Código de acesso e verificação de conta." },
  { id: "SERVICE", label: "Serviço", example: "Responder pelo Chat da ÓRBITA quem te chamou nas últimas 24h." },
];

const CONTACT_STEPS = [100, 250, 500, 1_000, 2_000, 5_000, 10_000, 25_000, 50_000, 100_000];

const FREE_RULES: InfoItem[] = [
  { icon: Gift, title: "Atender pelo Chat é grátis", text: "Responder no Chat da ÓRBITA em até 24h depois da última mensagem do cliente não custa nada." },
  { icon: Megaphone, title: "Anúncio abre 72h grátis", text: "Quem chega por anúncio Click-to-WhatsApp abre uma janela de 72h sem cobrança." },
  { icon: CreditCard, title: "Só paga o que foi entregue", text: "A Meta cobra no seu cartão por mensagem entregue — não por enviada." },
];

export function ConnectNumberIntro() {
  const [activeTab, setActiveTab] = useState<IntroTab>("benefits");

  return (
    <section className="overflow-hidden rounded-[24px] border bg-card">
      <div className="p-4 pb-3 sm:p-5 sm:pb-3">
        <p className="text-base font-semibold">Por que conectar o WhatsApp oficial?</p>
        <p className="text-sm text-muted-foreground">Veja o que muda, quanto custa e o que você precisa fazer.</p>
        <div className="mt-3 grid grid-cols-3 gap-1 rounded-full bg-muted p-1">
          {INTRO_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "h-9 rounded-full text-[13px] font-semibold transition-colors",
                activeTab === tab.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div key={activeTab} className="animate-in fade-in slide-in-from-bottom-1 px-4 pb-4 duration-300 sm:px-5 sm:pb-5">
        {activeTab === "benefits" && <BenefitsTab />}
        {activeTab === "costs" && <CostsTab />}
        {activeTab === "steps" && <StepsTab />}
      </div>

    </section>
  );
}

function InfoGrid({ items }: { items: InfoItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
      {items.map((item) => (
        <div key={item.title} className="rounded-[18px] bg-muted/50 p-3">
          <span className="mb-2 grid size-8 place-items-center rounded-full bg-brand-whatsapp/15 text-brand-whatsapp">
            <item.icon className="size-4" />
          </span>
          <p className="text-[13px] leading-tight font-semibold">{item.title}</p>
          <p className="mt-1 text-[11.5px] leading-snug text-muted-foreground">{item.text}</p>
        </div>
      ))}
    </div>
  );
}

function BenefitsTab() {
  return (
    <div className="space-y-3">
      <InfoGrid items={BENEFITS} />
      <div className="rounded-[18px] border border-dashed p-3">
        <p className="mb-1.5 text-[13px] font-semibold">O que muda no seu número</p>
        <ul className="space-y-1.5">
          {WHAT_CHANGES.map((change) => (
            <li key={change} className="flex items-start gap-2 text-[12.5px] text-muted-foreground">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-whatsapp" />
              {change}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function StepsTab() {
  return (
    <div className="space-y-2">
      {STEPS.map((step) => (
        <div key={step.title} className="flex items-start gap-3 rounded-[18px] bg-muted/50 p-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-whatsapp/15 text-brand-whatsapp">
            <step.icon className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold">{step.title}</p>
            <p className="text-[12px] text-muted-foreground">{step.text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function CostsTab() {
  const [category, setCategory] = useState<PricingCategory>("MARKETING");
  const [contactStepIndex, setContactStepIndex] = useState(3);
  const contacts = CONTACT_STEPS[contactStepIndex];
  const priceTable = metaPriceTable();
  const isService = category === "SERVICE";

  const pricePerMessageBrlCents = isService ? 0 : priceTable.priceUsd[category] * priceTable.usdBrlRate * 100;
  const metaCostBrlCents = isService ? 0 : estimateMetaCost({ recipients: contacts, category }).totalBrlCents;
  const feeQuote = quoteBroadcastFee({ metaCostBrlCents });
  const selectedCategory = PRICING_CATEGORIES.find((item) => item.id === category);

  return (
    <div className="space-y-3">
      <div className="scroll-hidden-x -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {PRICING_CATEGORIES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setCategory(item.id)}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-[13px] font-medium shadow-xs transition-colors",
              category === item.id ? "border-brand-whatsapp/50 bg-brand-whatsapp/10" : "bg-card text-muted-foreground",
            )}
          >
            {item.label}
            <span className={cn("size-2.5 rounded-full", category === item.id ? "bg-brand-whatsapp" : "bg-muted-foreground/30")} />
          </button>
        ))}
      </div>

      <div className="rounded-[20px] bg-brand-whatsapp-deep p-4 text-center text-white">
        <p className="text-[12px] text-white/70">Tarifa por mensagem entregue · Brasil</p>
        <p className="mt-0.5 text-3xl font-bold tabular-nums">
          {isService ? "Grátis" : `R$ ${(pricePerMessageBrlCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`}
        </p>
        <p className="mt-1 text-[11.5px] text-white/70">{selectedCategory?.example}</p>
      </div>

      {!isService && (
        <div className="rounded-[20px] border p-3.5">
          <div className="flex items-baseline justify-between">
            <p className="text-[13px] font-semibold">Simule uma campanha</p>
            <p className="text-sm font-bold tabular-nums">{contacts.toLocaleString("pt-BR")} contatos</p>
          </div>
          <Slider
            value={[contactStepIndex]}
            min={0}
            max={CONTACT_STEPS.length - 1}
            step={1}
            onValueChange={([value]) => setContactStepIndex(value)}
            className="py-4"
            aria-label="Quantidade de contatos"
          />
          <dl className="space-y-1 text-[13px]">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Meta (no seu cartão)</dt>
              <dd className="tabular-nums">{formatBrlCents(metaCostBrlCents)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Taxa ÓRBITA ({feeQuote.feePercent}%{feeQuote.isMinimumApplied ? ", mínimo" : ""})</dt>
              <dd className="tabular-nums">{formatBrlCents(feeQuote.serviceFeeBrlCents)}</dd>
            </div>
            <div className="flex justify-between border-t pt-1.5 text-sm font-bold">
              <dt>Total da campanha</dt>
              <dd className="tabular-nums">{formatBrlCents(feeQuote.totalBrlCents)}</dd>
            </div>
          </dl>
          {category === "MARKETING" && (
            <p className="mt-2 rounded-[14px] bg-brand-whatsapp/10 p-2 text-[11.5px] text-foreground/80">
              Dica: aviso de pedido, boleto ou agenda é <strong>Utilidade</strong> e custa cerca de 9x menos que Marketing.
            </p>
          )}
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-3">
        {FREE_RULES.map((rule) => (
          <div key={rule.title} className="flex items-start gap-2.5 rounded-[18px] bg-muted/50 p-3">
            <rule.icon className="mt-0.5 size-4 shrink-0 text-brand-whatsapp" />
            <div>
              <p className="text-[12.5px] font-semibold">{rule.title}</p>
              <p className="text-[11.5px] text-muted-foreground">{rule.text}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="text-[10.5px] text-muted-foreground">
        Valores de referência da Meta para o Brasil, convertidos para real. O valor final é o da fatura da Meta; a taxa ÓRBITA é cobrada por campanha.
      </p>
    </div>
  );
}
