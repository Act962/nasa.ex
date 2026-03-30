"use client";

import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  ArrowRight, CheckCircle2, Rocket, Star, Users, Globe, Shield,
  Clock, Bot, ChevronRight, Sparkles, Play, Zap,
  MessageSquare, Calendar, Plug2, LayoutGrid, Target, Trophy,
  BarChart2, TrendingUp, FileText, Flame,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── CSS Animations ───────────────────────────────────────────────────────────
const STYLES = `
  @keyframes nasaFloat {
    0%,100% { transform: translateY(0px); }
    50%      { transform: translateY(-14px); }
  }
  @keyframes nasaGlow {
    0%,100% { opacity:.35; transform:scale(1); }
    50%     { opacity:.65; transform:scale(1.06); }
  }
  @keyframes nasaFadeUp {
    from { opacity:0; transform:translateY(24px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes nasaSlideLeft {
    from { opacity:0; transform:translateX(32px); }
    to   { opacity:1; transform:translateX(0); }
  }
  @keyframes nasaMarquee {
    from { transform:translateX(0); }
    to   { transform:translateX(-50%); }
  }
  @keyframes nasaBadge {
    0%,100% { box-shadow:0 0 0 0 rgba(124,58,237,.5); }
    50%     { box-shadow:0 0 0 10px rgba(124,58,237,0); }
  }
  @keyframes nasaShimmer {
    from { background-position:-200% 0; }
    to   { background-position:200% 0; }
  }
  @keyframes nasaSpin {
    from { transform:rotate(0deg); }
    to   { transform:rotate(360deg); }
  }
  @keyframes nasaPing {
    0%   { transform:scale(1); opacity:1; }
    75%, 100% { transform:scale(2); opacity:0; }
  }

  .nasa-float      { animation: nasaFloat 7s ease-in-out infinite; }
  .nasa-float-d2   { animation: nasaFloat 7s ease-in-out infinite 1s; }
  .nasa-glow       { animation: nasaGlow 4s ease-in-out infinite; }
  .nasa-fade-up    { animation: nasaFadeUp .7s ease-out forwards; }
  .nasa-fade-up-d1 { animation: nasaFadeUp .7s ease-out .15s forwards; opacity:0; }
  .nasa-fade-up-d2 { animation: nasaFadeUp .7s ease-out .3s forwards; opacity:0; }
  .nasa-fade-up-d3 { animation: nasaFadeUp .7s ease-out .45s forwards; opacity:0; }
  .nasa-slide-left { animation: nasaSlideLeft .7s ease-out forwards; }
  .nasa-marquee    { animation: nasaMarquee 35s linear infinite; }
  .nasa-badge      { animation: nasaBadge 2.5s ease-in-out infinite; }
  .nasa-spin       { animation: nasaSpin 22s linear infinite; }
  .nasa-ping       { animation: nasaPing 1.5s cubic-bezier(0,0,.2,1) infinite; }

  .nasa-glass {
    background: rgba(255,255,255,.03);
    backdrop-filter: blur(14px);
    border: 1px solid rgba(255,255,255,.07);
  }
  .nasa-glass-hover:hover {
    background: rgba(255,255,255,.055);
    border-color: rgba(124,58,237,.35);
    transform: translateY(-3px);
  }
  .nasa-glow-box {
    box-shadow: 0 0 50px rgba(124,58,237,.25), 0 0 100px rgba(124,58,237,.1);
  }
  .nasa-glow-sm {
    box-shadow: 0 0 24px rgba(124,58,237,.3);
  }
  .text-nasa {
    background: linear-gradient(135deg, #c4b5fd 0%, #a855f7 50%, #7C3AED 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .text-nasa-white {
    background: linear-gradient(135deg, #ffffff 0%, #e0d4ff 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .nasa-border-gradient {
    border: 1px solid transparent;
    background-clip: padding-box;
    position: relative;
  }
  .nasa-border-gradient::before {
    content: '';
    position: absolute;
    inset: -1px;
    border-radius: inherit;
    background: linear-gradient(135deg, #7C3AED44, #a855f722, #7C3AED44);
    z-index: -1;
  }
  .nasa-shimmer {
    background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,.06) 50%, transparent 100%);
    background-size: 200% auto;
    animation: nasaShimmer 3s linear infinite;
  }
  .card-hover {
    transition: all .25s cubic-bezier(.4,0,.2,1);
  }
  .card-hover:hover {
    transform: translateY(-4px);
    box-shadow: 0 20px 60px rgba(124,58,237,.2);
  }
`;

// ─── Accurate Mock UIs ────────────────────────────────────────────────────────

function MacWindow({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl overflow-hidden border border-white/10 bg-[#0a0715] shadow-2xl">
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-white/8 bg-[#110d20]">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
        </div>
        <span className="flex-1 text-center text-[10px] text-white/30 truncate">{title}</span>
      </div>
      {children}
    </div>
  );
}

// Full platform dashboard mock (hero)
function DashboardMock() {
  const navItems = [
    { icon: "⬛", label: "Trackings", active: false },
    { icon: "📋", label: "Formulários", active: false },
    { icon: "💬", label: "Chats", active: true },
    { icon: "📅", label: "Agenda", active: false },
    { icon: "👥", label: "Contatos", active: false },
    { icon: "📊", label: "Insights", active: false },
    { icon: "⚡", label: "Integrações", active: false },
    { icon: "🔲", label: "Apps", active: false },
  ];

  const stages = [
    { name: "Lead", count: 23, color: "border-white/20", cards: ["Ana Costa", "Pedro Lima"] },
    { name: "Qualificado", count: 14, color: "border-[#7C3AED]/50", cards: ["Mariana S.", "João F."] },
    { name: "Proposta", count: 8, color: "border-amber-500/50", cards: ["Tech Corp", "StartUp X"] },
    { name: "Negociação", count: 5, color: "border-blue-500/50", cards: ["Alfa Ltda"] },
    { name: "Fechado", count: 12, color: "border-emerald-500/50", cards: ["Beta SA"] },
  ];

  return (
    <MacWindow title="nasa.ex — Tracking • Pipeline Comercial">
      <div className="flex" style={{ height: 320 }}>
        {/* Sidebar */}
        <div className="w-40 flex flex-col bg-[#080613] border-r border-white/5 py-3 shrink-0">
          <div className="px-3 mb-4 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#7C3AED] flex items-center justify-center text-white text-xs font-black">N</div>
            <span className="text-white/60 text-[11px] font-semibold">nasa.ex</span>
          </div>
          {navItems.map((item) => (
            <div
              key={item.label}
              className={cn(
                "mx-2 flex items-center gap-2 px-2 py-1.5 rounded-lg text-[10px] mb-0.5",
                item.active
                  ? "bg-[#7C3AED]/20 text-[#a78bfa] font-medium"
                  : "text-white/30 hover:text-white/50"
              )}
            >
              <span className="text-[11px]">{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>

        {/* Main */}
        <div className="flex-1 overflow-hidden flex flex-col bg-[#0d0a1a]">
          {/* KPI bar */}
          <div className="grid grid-cols-4 gap-2 p-3 border-b border-white/5">
            {[
              { label: "Total Leads", value: "847", delta: "+47", color: "text-white" },
              { label: "Leads Ativos", value: "124", delta: "+12", color: "text-amber-400" },
              { label: "Leads Ganhos", value: "68", delta: "+8", color: "text-emerald-400" },
              { label: "Receita", value: "R$127k", delta: "+23%", color: "text-[#a78bfa]" },
            ].map((k) => (
              <div key={k.label} className="bg-white/4 border border-white/5 rounded-lg p-2">
                <p className="text-white/35 text-[8px] mb-0.5">{k.label}</p>
                <p className={cn("font-bold text-[11px]", k.color)}>{k.value}</p>
                <p className="text-emerald-400 text-[8px]">↑ {k.delta} semana</p>
              </div>
            ))}
          </div>

          {/* Kanban */}
          <div className="flex gap-2 p-3 flex-1 overflow-x-auto">
            {stages.map((stage) => (
              <div key={stage.name} className={cn("shrink-0 w-24 border-t-2 rounded-lg bg-white/3 p-2", stage.color)}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-white/50 text-[8px] font-medium">{stage.name}</span>
                  <span className="bg-white/10 text-white/50 text-[8px] rounded-full w-4 h-4 flex items-center justify-center">{stage.count}</span>
                </div>
                <div className="space-y-1.5">
                  {stage.cards.map((card) => (
                    <div key={card} className="bg-[#1a1530] border border-white/8 rounded-md p-1.5">
                      <div className="flex items-center gap-1 mb-1">
                        <div className="w-3 h-3 rounded-full bg-[#7C3AED]/60 flex items-center justify-center text-[6px] text-white">{card[0]}</div>
                        <span className="text-white/60 text-[8px] truncate">{card}</span>
                      </div>
                      <div className="h-1 bg-[#7C3AED]/20 rounded-full"><div className="h-1 bg-[#7C3AED]/60 rounded-full w-3/4" /></div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MacWindow>
  );
}

function ChatMock() {
  return (
    <MacWindow title="Chat — João Silva • WhatsApp Business">
      <div className="flex" style={{ height: 200 }}>
        {/* Sidebar list */}
        <div className="w-28 border-r border-white/8 bg-[#080613] overflow-hidden">
          {[
            { name: "João Silva", msg: "Quero saber mais...", time: "14:32", unread: 2, active: true },
            { name: "Ana Costa", msg: "Perfeito! Quando...", time: "13:15", unread: 0, active: false },
            { name: "Tech Corp", msg: "Pode enviar a...", time: "12:00", unread: 1, active: false },
          ].map((conv) => (
            <div key={conv.name} className={cn("flex items-start gap-1.5 p-2 border-b border-white/5 cursor-pointer", conv.active && "bg-[#7C3AED]/10")}>
              <div className="w-5 h-5 rounded-full bg-[#7C3AED]/50 flex items-center justify-center text-[8px] text-white shrink-0">{conv.name[0]}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-white/70 text-[8px] font-medium truncate">{conv.name}</span>
                  <span className="text-white/30 text-[7px] shrink-0">{conv.time}</span>
                </div>
                <p className="text-white/30 text-[7px] truncate">{conv.msg}</p>
              </div>
              {conv.unread > 0 && (
                <div className="w-3.5 h-3.5 rounded-full bg-[#7C3AED] flex items-center justify-center text-[7px] text-white shrink-0">{conv.unread}</div>
              )}
            </div>
          ))}
        </div>
        {/* Chat area */}
        <div className="flex-1 flex flex-col bg-[#0d0a1a]">
          <div className="flex items-center gap-2 px-2.5 py-2 border-b border-white/8 bg-[#110d20]">
            <div className="w-5 h-5 rounded-full bg-[#7C3AED]/50 flex items-center justify-center text-[8px] text-white">J</div>
            <div>
              <p className="text-white/80 text-[9px] font-medium">João Silva</p>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                <span className="text-green-400 text-[7px]">Online</span>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-1 bg-[#7C3AED]/15 border border-[#7C3AED]/25 rounded-full px-1.5 py-0.5">
              <span className="text-[#a78bfa] text-[7px]">🤖 ASTRO ativo</span>
            </div>
          </div>
          <div className="flex-1 p-2 space-y-1.5 overflow-hidden">
            <div className="flex gap-1 items-end">
              <div className="w-4 h-4 rounded-full bg-[#7C3AED]/40 flex items-center justify-center text-[6px] text-white shrink-0">J</div>
              <div className="bg-white/8 rounded-xl rounded-bl-sm px-2 py-1 max-w-[70%]">
                <p className="text-white/70 text-[8px]">Olá! Quero saber sobre o plano Enterprise 🚀</p>
              </div>
            </div>
            <div className="flex gap-1 items-end justify-end">
              <div className="bg-[#7C3AED]/25 border border-[#7C3AED]/30 rounded-xl rounded-br-sm px-2 py-1 max-w-[70%]">
                <p className="text-white/80 text-[8px]">Olá João! Nosso plano Enterprise inclui todos os módulos do ecossistema NASA...</p>
              </div>
              <div className="w-4 h-4 rounded-full bg-[#7C3AED] flex items-center justify-center text-[6px] text-white shrink-0">N</div>
            </div>
            <div className="flex gap-1 items-end">
              <div className="w-4 h-4 rounded-full bg-[#7C3AED]/40 flex items-center justify-center text-[6px] text-white shrink-0">J</div>
              <div className="bg-white/8 rounded-xl rounded-bl-sm px-2 py-1 max-w-[70%]">
                <p className="text-white/70 text-[8px]">Quando podemos agendar uma demo?</p>
              </div>
            </div>
          </div>
          <div className="px-2 pb-2">
            <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5">
              <span className="text-white/20 text-[8px] flex-1">Digite uma mensagem...</span>
              <div className="w-4 h-4 rounded-full bg-[#7C3AED] flex items-center justify-center">
                <ArrowRight className="size-2 text-white" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </MacWindow>
  );
}

function InsightsMock() {
  return (
    <MacWindow title="Insights — Geral • Resumo">
      <div className="p-3 space-y-2.5 bg-[#0d0a1a]" style={{ minHeight: 200 }}>
        {/* KPI grid */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Total Leads", value: "847", icon: "👥", color: "text-white" },
            { label: "Leads Ativos", value: "124", icon: "🎯", color: "text-amber-400" },
            { label: "Leads Ganhos", value: "68", icon: "🏆", color: "text-emerald-400" },
            { label: "Tx. Conversão", value: "34%", icon: "%", color: "text-[#a78bfa]" },
          ].map((k) => (
            <div key={k.label} className="bg-white/5 border border-white/8 rounded-lg p-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-white/40 text-[8px]">{k.label}</span>
                <span className="text-[9px]">{k.icon}</span>
              </div>
              <p className={cn("font-black text-sm", k.color)}>{k.value}</p>
            </div>
          ))}
        </div>
        {/* Charts row */}
        <div className="grid grid-cols-2 gap-2">
          {/* Bar chart: leads por status */}
          <div className="bg-white/4 border border-white/6 rounded-lg p-2">
            <p className="text-white/40 text-[8px] mb-1.5 font-medium">Leads por Status</p>
            <div className="space-y-1">
              {[
                { label: "Lead", pct: 60, color: "bg-white/30" },
                { label: "Qualif.", pct: 40, color: "bg-[#7C3AED]/70" },
                { label: "Proposta", pct: 25, color: "bg-amber-500/70" },
                { label: "Fechado", pct: 20, color: "bg-emerald-500/70" },
              ].map((b) => (
                <div key={b.label} className="flex items-center gap-1.5">
                  <span className="text-white/30 text-[7px] w-10 shrink-0">{b.label}</span>
                  <div className="flex-1 bg-white/5 rounded-full h-1.5">
                    <div className={cn("h-full rounded-full", b.color)} style={{ width: `${b.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Bar chart: leads por canal */}
          <div className="bg-white/4 border border-white/6 rounded-lg p-2">
            <p className="text-white/40 text-[8px] mb-1.5 font-medium">Leads por Canal</p>
            <div className="space-y-1">
              {[
                { label: "WhatsApp", pct: 75, color: "bg-green-500/70" },
                { label: "Instagram", pct: 50, color: "bg-pink-500/70" },
                { label: "Formulário", pct: 38, color: "bg-blue-500/70" },
                { label: "Outros", pct: 20, color: "bg-white/20" },
              ].map((b) => (
                <div key={b.label} className="flex items-center gap-1.5">
                  <span className="text-white/30 text-[7px] w-12 shrink-0">{b.label}</span>
                  <div className="flex-1 bg-white/5 rounded-full h-1.5">
                    <div className={cn("h-full rounded-full", b.color)} style={{ width: `${b.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </MacWindow>
  );
}

function IntegrationsMock() {
  const apps = [
    { name: "WhatsApp Business", color: "#25D366", installed: true },
    { name: "Instagram DM", color: "#E1306C", installed: true },
    { name: "Telegram", color: "#229ED9", installed: false },
    { name: "Gmail", color: "#EA4335", installed: false },
    { name: "Typeform", color: "#7C3AED", installed: false },
    { name: "Stripe", color: "#635BFF", installed: false },
  ];
  return (
    <MacWindow title="Integrações — Marketplace">
      <div className="p-3 bg-[#0d0a1a]" style={{ minHeight: 200 }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex gap-1">
            {["Todos", "Mensageiros", "Pagamentos"].map((t, i) => (
              <div key={t} className={cn("text-[8px] px-2 py-0.5 rounded-full", i === 0 ? "bg-[#7C3AED]/30 text-[#a78bfa] border border-[#7C3AED]/40" : "text-white/30 border border-white/10")}>
                {t}
              </div>
            ))}
          </div>
          <div className="text-white/30 text-[8px]">54 apps</div>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {apps.map((app) => (
            <div key={app.name} className={cn(
              "bg-white/5 border rounded-lg p-2 flex flex-col items-center gap-1 transition-colors",
              app.installed ? "border-emerald-500/25 bg-emerald-500/5" : "border-white/8"
            )}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: app.color + "25" }}>
                <div className="w-4 h-4 rounded-md" style={{ backgroundColor: app.color }} />
              </div>
              <span className="text-white/60 text-[7px] text-center leading-tight">{app.name}</span>
              {app.installed ? (
                <span className="text-emerald-400 text-[7px] font-medium">✓ Ativo</span>
              ) : (
                <span className="text-[#a78bfa] text-[7px]">+ Instalar</span>
              )}
            </div>
          ))}
        </div>
        <div className="mt-2 bg-[#7C3AED]/8 border border-[#7C3AED]/20 rounded-lg p-2 flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full bg-[#7C3AED] flex items-center justify-center text-[7px] text-white font-bold">A</div>
          <span className="text-white/40 text-[8px]">ASTRO: "Instalar Google Forms para capturar leads..."</span>
        </div>
      </div>
    </MacWindow>
  );
}

function ForgeMock() {
  return (
    <MacWindow title="FORGE — Proposta #0047 • Tech Corp">
      <div className="bg-[#0d0a1a]" style={{ minHeight: 200 }}>
        {/* Tabs */}
        <div className="flex border-b border-white/8">
          {["📊 Painel", "📦 Produtos", "📄 Propostas", "📋 Contratos"].map((t, i) => (
            <div key={t} className={cn("text-[8px] px-3 py-2 cursor-pointer border-b-2 transition-colors", i === 2 ? "border-[#7C3AED] text-[#a78bfa]" : "border-transparent text-white/30")}>
              {t}
            </div>
          ))}
        </div>
        <div className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/70 text-[9px] font-semibold">João Silva — Tech Corp</p>
              <p className="text-white/30 text-[8px]">Criada em 28 Mar 2026</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="bg-amber-500/15 text-amber-400 text-[8px] border border-amber-500/25 px-2 py-0.5 rounded-full">Aguardando</span>
            </div>
          </div>
          <div className="bg-white/4 border border-white/8 rounded-lg p-2 space-y-1">
            {[
              { desc: "Plano Enterprise Anual", value: "R$ 2.400/mês" },
              { desc: "Onboarding Dedicado", value: "R$ 800" },
              { desc: "Módulo FORGE PRO", value: "R$ 300/mês" },
            ].map((item) => (
              <div key={item.desc} className="flex justify-between items-center">
                <span className="text-white/40 text-[8px]">{item.desc}</span>
                <span className="text-white/70 text-[8px] font-medium">{item.value}</span>
              </div>
            ))}
            <div className="border-t border-white/8 pt-1 flex justify-between">
              <span className="text-white text-[9px] font-bold">Total Mensal</span>
              <span className="text-[#a78bfa] text-[9px] font-black">R$ 3.500</span>
            </div>
          </div>
          {/* Progress steps */}
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { label: "Proposta", status: "✓ Enviada", done: true },
              { label: "Contrato", status: "⏳ Pendente", done: false },
              { label: "Pagamento", status: "⏳ Pendente", done: false },
            ].map((step) => (
              <div key={step.label} className={cn("rounded-md p-1.5 text-center border", step.done ? "bg-[#7C3AED]/15 border-[#7C3AED]/25" : "bg-white/3 border-white/8")}>
                <p className={cn("text-[7px]", step.done ? "text-[#a78bfa]" : "text-white/30")}>{step.label}</p>
                <p className={cn("text-[7px] mt-0.5", step.done ? "text-white/60" : "text-white/20")}>{step.status}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MacWindow>
  );
}

// ─── Landing Sections ─────────────────────────────────────────────────────────

function HeroSection({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-4 pt-28 pb-16 overflow-hidden">
      {/* Background glows */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/3 w-[700px] h-[700px] rounded-full bg-[#7C3AED]/12 blur-[140px] nasa-glow pointer-events-none" />
      <div className="absolute top-1/4 left-1/4 w-[350px] h-[350px] rounded-full bg-[#a855f7]/8 blur-[100px] nasa-glow pointer-events-none" style={{ animationDelay: "2s" }} />

      <div className="relative z-10 flex flex-col items-center text-center max-w-6xl mx-auto w-full">
        {/* Badge */}
        <div className="mb-8 inline-flex items-center gap-2.5 bg-[#7C3AED]/12 border border-[#7C3AED]/30 rounded-full px-5 py-2 nasa-badge nasa-fade-up">
          <Rocket className="size-3.5 text-[#a78bfa]" />
          <span className="text-[#c4b5fd] text-sm font-medium">Powered pelo Método N.A.S.A.® exclusivo</span>
          <ChevronRight className="size-3.5 text-[#7C3AED]" />
        </div>

        {/* Headline */}
        <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tight mb-6 leading-[0.88] nasa-fade-up-d1">
          <span className="text-white">Transforme cada</span>
          <br />
          <span className="text-nasa">conversa em uma</span>
          <br />
          <span className="text-white">venda fechada</span>
        </h1>

        {/* Subtitle */}
        <p className="text-lg sm:text-xl md:text-2xl text-white/45 max-w-2xl mb-3 leading-relaxed nasa-fade-up-d2">
          Descubra um universo de opções para{" "}
          <span className="text-white/75 font-semibold">gestão comercial da sua empresa.</span>
        </p>
        <p className="text-base text-white/30 mb-10 nasa-fade-up-d2">
          Do primeiro contato ao contrato assinado. Tudo em uma única plataforma.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6 nasa-fade-up-d3">
          <Button
            asChild
            size="lg"
            className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold px-9 py-6 text-base rounded-xl nasa-glow-sm card-hover"
          >
            <Link href={isLoggedIn ? "/tracking" : "/sign-up"}>
              Começar gratuitamente
              <Rocket className="size-4 ml-2" />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="border-white/15 bg-white/3 text-white hover:bg-white/8 font-semibold px-9 py-6 text-base rounded-xl card-hover"
          >
            <Link href="/sign-in">
              <Play className="size-4 mr-2 text-[#a78bfa] fill-[#a78bfa]" />
              Ver demonstração
            </Link>
          </Button>
        </div>

        {/* Social proof */}
        <div className="flex items-center gap-4 text-sm text-white/30 mb-14 nasa-fade-up-d3">
          <div className="flex items-center gap-1.5">
            <div className="relative">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <div className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-400 nasa-ping" />
            </div>
            <span>2.300+ empresas ativas</span>
          </div>
          <span className="text-white/10">•</span>
          <span>Sem cartão de crédito</span>
          <span className="text-white/10">•</span>
          <span>Setup em 5 minutos</span>
        </div>

        {/* Hero mock */}
        <div className="w-full max-w-4xl nasa-float">
          <DashboardMock />
        </div>
      </div>
    </section>
  );
}

function StatsSection() {
  const stats = [
    { value: "2.300+", label: "Empresas ativas", icon: "🏢" },
    { value: "847k+", label: "Leads capturados", icon: "🎯" },
    { value: "89%", label: "Mais conversões", icon: "📈" },
    { value: "200+", label: "Integrações", icon: "⚡" },
  ];
  return (
    <section className="py-14 px-4 border-y border-white/5 nasa-glass">
      <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
        {stats.map((s, i) => (
          <div key={s.label} className="text-center" style={{ animationDelay: `${i * 0.1}s` }}>
            <div className="text-3xl mb-2">{s.icon}</div>
            <div className="text-3xl md:text-4xl font-black text-white mb-1">{s.value}</div>
            <div className="text-sm text-white/35">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function NasaMethodSection() {
  const pillars = [
    {
      letter: "N",
      color: "blue",
      title: "Necessidade",
      subtitle: "Chat & Pipeline",
      description: "Capture e qualifique leads de qualquer canal. Pipeline visual Kanban para nunca perder uma oportunidade comercial.",
      features: ["Chat omnichannel unificado", "Pipeline Kanban drag & drop", "IA ASTRO integrada no chat", "Captura automática de leads"],
      mock: <ChatMock />,
      gradFrom: "from-blue-600/15",
      gradTo: "to-[#7C3AED]/15",
      border: "border-blue-500/20",
      letter_color: "text-blue-400",
      accent: "text-blue-400",
    },
    {
      letter: "A",
      color: "emerald",
      title: "Análise",
      subtitle: "Insights & Métricas",
      description: "Dashboards em tempo real. Entenda seu funil, meça o ROI de cada canal e tome decisões baseadas em dados reais.",
      features: ["8 KPIs de conversão", "Gráficos por canal e status", "Performance por atendente", "Relatórios exportáveis"],
      mock: <InsightsMock />,
      gradFrom: "from-emerald-600/15",
      gradTo: "to-[#7C3AED]/15",
      border: "border-emerald-500/20",
      letter_color: "text-emerald-400",
      accent: "text-emerald-400",
    },
    {
      letter: "S",
      color: "amber",
      title: "Sistematização",
      subtitle: "Integrações & Automações",
      description: "Conecte +200 ferramentas ao seu processo comercial. ASTRO instala e configura integrações por comando de texto.",
      features: ["200+ integrações disponíveis", "ASTRO instala por comando", "Automações sem código", "WhatsApp, Instagram, Telegram"],
      mock: <IntegrationsMock />,
      gradFrom: "from-amber-600/15",
      gradTo: "to-[#7C3AED]/15",
      border: "border-amber-500/20",
      letter_color: "text-amber-400",
      accent: "text-amber-400",
    },
    {
      letter: "A",
      color: "purple",
      title: "Ação",
      subtitle: "FORGE — Propostas & Contratos",
      description: "Feche negócios mais rápido. Crie propostas profissionais, contratos digitais e links de pagamento em minutos.",
      features: ["Propostas comerciais", "Contratos com assinatura digital", "Links de pagamento integrados", "Multi-gateway: Stripe, Pix, etc."],
      mock: <ForgeMock />,
      gradFrom: "from-[#7C3AED]/20",
      gradTo: "to-pink-600/10",
      border: "border-[#7C3AED]/30",
      letter_color: "text-[#a78bfa]",
      accent: "text-[#a78bfa]",
    },
  ];

  return (
    <section className="relative py-28 px-4">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#7C3AED]/4 to-transparent pointer-events-none" />

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-[#7C3AED]/12 border border-[#7C3AED]/30 rounded-full px-5 py-2 mb-6">
            <Sparkles className="size-3.5 text-[#a78bfa]" />
            <span className="text-[#c4b5fd] text-sm font-medium">Nossa metodologia exclusiva</span>
          </div>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-black text-white mb-5">
            O Método <span className="text-nasa">N.A.S.A.®</span>
          </h2>
          <p className="text-white/45 text-xl max-w-2xl mx-auto leading-relaxed">
            4 etapas que estruturam seu processo comercial do zero ao fechamento.
            Uma metodologia criada para times de vendas que querem resultados reais.
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {pillars.map((p, i) => (
            <div
              key={p.title}
              className={cn(
                "relative rounded-2xl border p-6 nasa-glass card-hover overflow-hidden",
                p.border
              )}
            >
              <div className={cn("absolute inset-0 bg-gradient-to-br opacity-60 pointer-events-none", p.gradFrom, p.gradTo)} />
              <div className="relative z-10">
                <div className="flex items-start gap-4 mb-4">
                  <div className={cn(
                    "w-16 h-16 rounded-2xl flex items-center justify-center text-4xl font-black border shrink-0 bg-white/5",
                    p.border, p.letter_color
                  )}>
                    {p.letter}
                  </div>
                  <div className="pt-1">
                    <h3 className="text-xl font-bold text-white">{p.title}</h3>
                    <p className={cn("text-sm font-semibold mt-0.5", p.accent)}>{p.subtitle}</p>
                    <p className="text-white/45 text-xs mt-1.5 leading-relaxed max-w-sm">{p.description}</p>
                  </div>
                </div>
                <ul className="grid grid-cols-2 gap-2 mb-5">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-xs text-white/55">
                      <CheckCircle2 className={cn("size-3.5 shrink-0", p.accent)} />
                      {f}
                    </li>
                  ))}
                </ul>
                {p.mock}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AppsSection() {
  const apps = [
    {
      name: "TRACKING",
      tag: "CRM • Multi-pipeline",
      desc: "Pipeline Kanban completo para toda a jornada do cliente, do lead ao fechamento.",
      icon: "⬛",
      installed: true,
    },
    {
      name: "NASACHAT",
      tag: "Atendimento • WhatsApp",
      desc: "WhatsApp organizado com CRM nativo e IA para capturar e nutrir leads automaticamente.",
      icon: "💬",
      installed: true,
    },
    {
      name: "FORGE",
      tag: "Vendas • Multi-gateway",
      desc: "Propostas, contratos e pagamentos em um único lugar. Feche negócios mais rápido.",
      icon: "🔥",
      installed: true,
    },
    {
      name: "SPACETIME",
      tag: "Agenda • CRM integrado",
      desc: "Múltiplos calendários conectados ao seu CRM. Agendamentos que viram leads automaticamente.",
      icon: "📅",
      installed: true,
    },
    {
      name: "COMMENTS",
      tag: "Engajamento • Instagram",
      desc: "Automatize respostas de comentários no Instagram e converta engajamento em vendas.",
      icon: "💬",
      installed: true,
    },
    {
      name: "NERP",
      tag: "Gestão • ERP",
      desc: "ERP integrado com módulo comercial e suporte. Gerencie toda a operação da empresa.",
      icon: "🔲",
      installed: true,
    },
    {
      name: "ASTRO",
      tag: "IA de Vendas",
      desc: "Assistente de IA nativo que guia seu time pelo Método NASA e instala integrações.",
      icon: "✨",
      installed: false,
      soon: true,
    },
    {
      name: "COSMIC",
      tag: "Formulários inteligentes",
      desc: "Formulários com IA que qualificam leads automaticamente e alimentam seu CRM.",
      icon: "🌌",
      installed: false,
      soon: true,
    },
    {
      name: "BOOST",
      tag: "Gamificação de vendas",
      desc: "Ranking, metas e recompensas para o seu time de vendas. Engajamento que gera resultados.",
      icon: "⚡",
      installed: false,
      soon: true,
    },
  ];

  return (
    <section className="py-28 px-4 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#7C3AED]/3 to-transparent pointer-events-none" />
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-[#7C3AED]/12 border border-[#7C3AED]/30 rounded-full px-5 py-2 mb-6">
            <LayoutGrid className="size-3.5 text-[#a78bfa]" />
            <span className="text-[#c4b5fd] text-sm font-medium">Ecossistema completo</span>
          </div>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-black text-white mb-5">
            Universo de Soluções <span className="text-nasa">N.A.S.A.®</span>
          </h2>
          <p className="text-white/45 text-xl max-w-2xl mx-auto">
            Todas as ferramentas que seu time comercial precisa, integradas e prontas para usar.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {apps.map((app) => (
            <div
              key={app.name}
              className={cn(
                "relative rounded-2xl border p-5 nasa-glass card-hover overflow-hidden group",
                app.installed ? "border-white/10" : "border-white/6 opacity-70"
              )}
            >
              {/* Hover gradient top accent */}
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#7C3AED]/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-[#7C3AED]/20 border border-[#7C3AED]/30 flex items-center justify-center text-xl shrink-0">
                  {app.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="text-white font-black text-base tracking-tight">{app.name}</h3>
                    {app.installed ? (
                      <span className="bg-emerald-500/15 text-emerald-400 text-[9px] border border-emerald-500/20 px-1.5 py-0.5 rounded-full font-medium">Disponível</span>
                    ) : (
                      <span className="bg-amber-500/15 text-amber-400 text-[9px] border border-amber-500/20 px-1.5 py-0.5 rounded-full font-medium">Em breve</span>
                    )}
                  </div>
                  <p className="text-[#a78bfa] text-[10px] font-medium mb-2">{app.tag}</p>
                  <p className="text-white/40 text-xs leading-relaxed">{app.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AstroSection() {
  return (
    <section className="py-24 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="relative rounded-3xl border border-[#7C3AED]/25 overflow-hidden nasa-glass p-8 md:p-12">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-[#7C3AED]/12 blur-[120px] pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full bg-[#a855f7]/8 blur-[80px] pointer-events-none" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#7C3AED]/50 to-transparent" />

          <div className="relative z-10 flex flex-col lg:flex-row items-center gap-12">
            {/* Left */}
            <div className="flex-1 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 bg-[#7C3AED]/15 border border-[#7C3AED]/30 rounded-full px-4 py-1.5 mb-6">
                <Bot className="size-3.5 text-[#a78bfa]" />
                <span className="text-[#c4b5fd] text-sm font-medium">IA nativa no NASA</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
                Conheça o <span className="text-nasa">ASTRO</span>
              </h2>
              <p className="text-white/50 text-lg mb-8 leading-relaxed max-w-lg">
                Seu assistente de Inteligência Artificial que domina o Método NASA de ponta a ponta.
                Instala integrações, sugere ações e guia seu time para fechar mais negócios.
              </p>
              <ul className="space-y-3.5 mb-8">
                {[
                  "Instala integrações por texto ou voz",
                  "Conhece todo o Método N.A.S.A.® e guia o usuário",
                  "Sugere ações baseadas nos seus dados reais",
                  "Navega pela plataforma e cria atalhos inteligentes",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-white/65">
                    <CheckCircle2 className="size-4 text-[#a78bfa] shrink-0" />
                    <span className="text-sm">{item}</span>
                  </li>
                ))}
              </ul>
              <Button
                asChild
                className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold px-7 py-5 rounded-xl card-hover nasa-glow-sm"
              >
                <Link href="/sign-up">
                  Testar o ASTRO grátis
                  <ArrowRight className="size-4 ml-2" />
                </Link>
              </Button>
            </div>

            {/* Right: ASTRO chat mock */}
            <div className="w-full lg:w-96 shrink-0 nasa-float-d2">
              <MacWindow title="ASTRO — Assistente de IA">
                <div className="p-3 space-y-2.5 bg-[#0d0a1a]" style={{ minHeight: 280 }}>
                  <div className="bg-[#7C3AED]/10 border border-[#7C3AED]/20 rounded-xl rounded-tl-sm p-3">
                    <p className="text-white/70 text-xs leading-relaxed">
                      👋 Olá! Sou o <strong className="text-[#a78bfa]">ASTRO</strong>, seu assistente de vendas.
                      Como posso ajudar sua equipe hoje?
                    </p>
                  </div>
                  <div className="flex justify-end">
                    <div className="bg-white/6 border border-white/10 rounded-xl rounded-tr-sm p-3 max-w-[80%]">
                      <p className="text-white/60 text-xs">Quero instalar o Telegram no meu painel</p>
                    </div>
                  </div>
                  <div className="bg-[#7C3AED]/10 border border-[#7C3AED]/20 rounded-xl rounded-tl-sm p-3">
                    <p className="text-white/70 text-xs leading-relaxed">
                      🚀 <strong className="text-[#a78bfa]">Telegram</strong> foi habilitado no seu NASA!
                      Acesse a página da integração e insira o token do seu bot. Cada empresa tem suas próprias credenciais.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {["⚙️ Inserir credenciais", "📊 Ver Insights", "🔗 Como criar bot?"].map((label) => (
                      <div key={label} className="bg-[#7C3AED]/15 border border-[#7C3AED]/30 rounded-full px-2.5 py-1 text-[10px] text-[#c4b5fd] cursor-pointer hover:bg-[#7C3AED]/25 transition-colors">
                        {label}
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end">
                    <div className="bg-white/6 border border-white/10 rounded-xl rounded-tr-sm p-3 max-w-[80%]">
                      <p className="text-white/60 text-xs">Me explique o Método NASA</p>
                    </div>
                  </div>
                  <div className="bg-[#7C3AED]/10 border border-[#7C3AED]/20 rounded-xl rounded-tl-sm p-3">
                    <p className="text-white/70 text-xs leading-relaxed">
                      💡 O <strong className="text-[#a78bfa]">Método N.A.S.A.®</strong> tem 4 etapas:
                      <br />N — <span className="text-white/50">Necessidade</span> (Chat & Pipeline)
                      <br />A — <span className="text-white/50">Análise</span> (Insights)
                      <br />S — <span className="text-white/50">Sistematização</span> (Integrações)
                      <br />A — <span className="text-white/50">Ação</span> (FORGE)
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {["🎯 N — Necessidade", "📊 A — Análise", "⚡ S — Sistematizar", "🔥 A — Ação"].map((label) => (
                      <div key={label} className="bg-[#7C3AED]/15 border border-[#7C3AED]/30 rounded-full px-2.5 py-1 text-[10px] text-[#c4b5fd] cursor-pointer hover:bg-[#7C3AED]/25 transition-colors">
                        {label}
                      </div>
                    ))}
                  </div>
                </div>
              </MacWindow>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function IntegrationsMarquee() {
  const items = [
    "WhatsApp Business", "Instagram DM", "Telegram", "Facebook Messenger",
    "Gmail", "Google Forms", "Typeform", "JotForm", "Tally",
    "Stripe", "Mercado Pago", "PagSeguro", "PayPal",
    "Zapier", "Make", "n8n",
    "Slack", "Discord", "Microsoft Teams",
    "LinkedIn", "TikTok", "Meta Ads",
    "RD Station", "HubSpot", "Pipedrive",
    "ClickSign", "DocuSign", "D4Sign",
    "Intercom", "Chatwoot", "Crisp",
  ];
  return (
    <section className="py-16 px-4 border-y border-white/5 overflow-hidden">
      <p className="text-center text-white/20 text-xs font-medium uppercase tracking-widest mb-8">
        +200 integrações disponíveis no marketplace
      </p>
      <div className="relative">
        <div className="flex nasa-marquee whitespace-nowrap gap-3">
          {[...items, ...items].map((name, i) => (
            <div key={i} className="inline-flex items-center gap-2 nasa-glass rounded-full px-4 py-2 shrink-0 border border-white/6">
              <div className="w-1.5 h-1.5 rounded-full bg-[#7C3AED]/70" />
              <span className="text-white/50 text-sm font-medium">{name}</span>
            </div>
          ))}
        </div>
        <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-black to-transparent pointer-events-none z-10" />
        <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-black to-transparent pointer-events-none z-10" />
      </div>
    </section>
  );
}

function FinalCTASection({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <section className="py-32 px-4">
      <div className="max-w-4xl mx-auto text-center relative">
        <div className="absolute inset-0 bg-[#7C3AED]/8 blur-3xl rounded-full scale-150 pointer-events-none" />

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 bg-emerald-500/12 border border-emerald-500/25 rounded-full px-5 py-2 mb-8">
            <Star className="size-3.5 text-emerald-400 fill-emerald-400" />
            <span className="text-emerald-300 text-sm font-medium">Grátis para começar • Sem cartão de crédito</span>
          </div>

          <h2 className="text-5xl sm:text-6xl md:text-7xl font-black text-white mb-6 leading-[0.9]">
            Pronto para decolar
            <br />
            <span className="text-nasa">com o NASA?</span>
          </h2>

          <p className="text-white/40 text-xl mb-12 max-w-xl mx-auto leading-relaxed">
            Junte-se a mais de 2.300 empresas que já transformaram seu processo comercial com o Método N.A.S.A.®
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-14">
            <Button
              asChild
              size="lg"
              className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-black px-12 py-7 text-lg rounded-2xl nasa-glow-sm card-hover"
            >
              <Link href={isLoggedIn ? "/tracking" : "/sign-up"}>
                Começar gratuitamente
                <Rocket className="size-5 ml-2" />
              </Link>
            </Button>
          </div>

          <div className="flex flex-wrap justify-center gap-8">
            {[
              { icon: Shield, label: "LGPD Compliant" },
              { icon: Globe, label: "Hospedagem no Brasil" },
              { icon: Clock, label: "Setup em 5 minutos" },
              { icon: Users, label: "Suporte dedicado" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 text-white/25 text-sm">
                <Icon className="size-4" />
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function NewFooter() {
  return (
    <footer className="border-t border-white/5 py-10 px-4">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#7C3AED] flex items-center justify-center text-white text-sm font-black">N</div>
          <div>
            <p className="text-white/70 font-bold text-sm">nasa.ex</p>
            <p className="text-white/25 text-xs">Powered pelo Método N.A.S.A.®</p>
          </div>
        </div>
        <div className="flex items-center gap-6 text-sm text-white/25">
          <button className="hover:text-white/50 transition-colors">Políticas de Privacidade</button>
          <button className="hover:text-white/50 transition-colors">Termos & Condições</button>
          <span>© 2026 nasa.ex</span>
        </div>
      </div>
    </footer>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function HomePage() {
  const { data: session, isPending } = authClient.useSession();
  const isLoggedIn = !!session?.user && !isPending;

  return (
    <>
      <style>{STYLES}</style>
      <HeroSection isLoggedIn={isLoggedIn} />
      <StatsSection />
      <NasaMethodSection />
      <AppsSection />
      <AstroSection />
      <IntegrationsMarquee />
      <FinalCTASection isLoggedIn={isLoggedIn} />
      <NewFooter />
    </>
  );
}
