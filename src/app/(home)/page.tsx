"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/lib/orpc";
import { Button } from "@/components/ui/button";
import {
  ArrowRight, CheckCircle2, Rocket, Star, Users, Globe, Shield,
  Clock, Bot, ChevronRight, Sparkles, Play, Zap,
  MessageSquare, Calendar, Plug2, LayoutGrid, Target, Trophy,
  BarChart2, TrendingUp, FileText, Flame,
  Coins, Crown, Medal, Gift, TrendingDown, ChevronUp, ChevronDown, Infinity,
  Cpu, BrainCircuit, Layers, RefreshCw, Lock, Bolt,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PlanDetailModal, type PlanDetail } from "@/components/plan-detail-modal";
import { PlanPurchaseModal } from "@/features/stars/components/plan-purchase-modal";

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

  @keyframes nasaBar {
    from { width: 0; }
    to   { width: var(--bar-w); }
  }
  @keyframes nasaCountUp {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes nasaRankIn {
    from { opacity: 0; transform: translateX(-16px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes nasaStarPop {
    0%   { transform: scale(0) rotate(-30deg); opacity: 0; }
    60%  { transform: scale(1.2) rotate(5deg); }
    100% { transform: scale(1) rotate(0deg); opacity: 1; }
  }
  @keyframes nasaLevelUp {
    0%,100% { box-shadow: 0 0 0 0 rgba(250,204,21,0); }
    50%     { box-shadow: 0 0 0 8px rgba(250,204,21,0); }
  }
  @keyframes nasaSliderGlow {
    0%,100% { box-shadow: 0 0 0 0 rgba(124,58,237,.4); }
    50%     { box-shadow: 0 0 14px 4px rgba(124,58,237,.25); }
  }

  .nasa-bar        { animation: nasaBar 1s ease-out forwards; }
  .nasa-rank-in    { animation: nasaRankIn .5s ease-out forwards; }
  .nasa-star-pop   { animation: nasaStarPop .6s cubic-bezier(.34,1.56,.64,1) forwards; }
  .nasa-level-up   { animation: nasaLevelUp 2.5s ease-in-out infinite; }
  .nasa-slider-glow{ animation: nasaSliderGlow 3s ease-in-out infinite; }

  @keyframes nasaWave {
    0%,100% { transform: scaleY(1); }
    50%     { transform: scaleY(2.5); }
  }
  @keyframes nasaPopIn {
    from { opacity:0; transform:scale(.85) translateY(6px); }
    to   { opacity:1; transform:scale(1) translateY(0); }
  }
  @keyframes nasaTypingDot {
    0%,80%,100% { transform: scale(0); opacity:.3; }
    40%         { transform: scale(1);  opacity:1; }
  }
  @keyframes nasaDataFlow {
    0%   { stroke-dashoffset: 60; opacity:0; }
    20%  { opacity:1; }
    100% { stroke-dashoffset: 0;  opacity:1; }
  }
  @keyframes nasaFadeRight {
    from { opacity:0; transform:translateX(-8px); }
    to   { opacity:1; transform:translateX(0); }
  }
  @keyframes nasaBarRise {
    from { transform: scaleY(0); opacity:0; }
    to   { transform: scaleY(1); opacity:1; }
  }

  .nasa-pop-in    { animation: nasaPopIn .4s cubic-bezier(.34,1.56,.64,1) forwards; }
  .nasa-fade-right{ animation: nasaFadeRight .4s ease-out forwards; }
  .bar-rise       { animation: nasaBarRise .6s ease-out forwards; }
  .wave-bar       { animation: nasaWave 1.1s ease-in-out infinite; }

  .dot-bounce-1 { animation: nasaTypingDot 1.2s ease-in-out infinite; }
  .dot-bounce-2 { animation: nasaTypingDot 1.2s ease-in-out .2s infinite; }
  .dot-bounce-3 { animation: nasaTypingDot 1.2s ease-in-out .4s infinite; }

  .plan-card-highlight {
    background: linear-gradient(145deg, rgba(124,58,237,.12) 0%, rgba(168,85,247,.06) 100%);
    border-color: rgba(124,58,237,.5) !important;
    box-shadow: 0 0 40px rgba(124,58,237,.2), 0 0 80px rgba(124,58,237,.08);
  }
  .stars-card {
    background: linear-gradient(135deg, rgba(250,204,21,.07) 0%, rgba(124,58,237,.05) 100%);
    border: 1px solid rgba(250,204,21,.15);
  }
  .rank-row:nth-child(1) { animation-delay: 0s; }
  .rank-row:nth-child(2) { animation-delay: .06s; }
  .rank-row:nth-child(3) { animation-delay: .12s; }
  .rank-row:nth-child(4) { animation-delay: .18s; }
  .rank-row:nth-child(5) { animation-delay: .24s; }
  .rank-row:nth-child(6) { animation-delay: .30s; }
  .rank-row:nth-child(7) { animation-delay: .36s; }
  .rank-row:nth-child(8) { animation-delay: .42s; }
  input[type=range]::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 22px; height: 22px;
    border-radius: 50%;
    background: #7C3AED;
    cursor: pointer;
    border: 3px solid #fff;
    box-shadow: 0 0 12px rgba(124,58,237,.6);
  }
  input[type=range]::-webkit-slider-runnable-track {
    height: 6px;
    border-radius: 99px;
    background: linear-gradient(to right, #7C3AED var(--track-pct, 50%), rgba(255,255,255,.1) var(--track-pct, 50%));
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

// ─── ASTRO Animated Chat Mock ─────────────────────────────────────────────────

type AstroStep = "idle" | "audio" | "thinking" | "agenda" | "proposal_cmd" | "thinking2" | "proposal";

function AstroAnimatedMock() {
  const [step, setStep] = useState<AstroStep>("idle");

  useEffect(() => {
    const timeline: Array<{ from: AstroStep; to: AstroStep; delay: number }> = [
      { from: "idle", to: "audio", delay: 1200 },
      { from: "audio", to: "thinking", delay: 1800 },
      { from: "thinking", to: "agenda", delay: 2000 },
      { from: "agenda", to: "proposal_cmd", delay: 2800 },
      { from: "proposal_cmd", to: "thinking2", delay: 1500 },
      { from: "thinking2", to: "proposal", delay: 2200 },
    ];

    let t: ReturnType<typeof setTimeout>;
    let cur = 0;

    function run() {
      const entry = timeline[cur];
      t = setTimeout(() => {
        setStep(entry.to);
        cur++;
        if (cur < timeline.length) {
          run();
        } else {
          // loop: reset after 4 s
          t = setTimeout(() => {
            setStep("idle");
            cur = 0;
            run();
          }, 4000);
        }
      }, entry.delay);
    }

    run();
    return () => clearTimeout(t);
  }, []);

  const show = (s: AstroStep) => step === s || (
    s === "audio" && ["audio","thinking","agenda","proposal_cmd","thinking2","proposal"].includes(step)
  );

  const showThinking = step === "thinking";
  const showThinking2 = step === "thinking2";
  const showAgenda = ["agenda","proposal_cmd","thinking2","proposal"].includes(step);
  const showProposalCmd = ["proposal_cmd","thinking2","proposal"].includes(step);
  const showProposal = step === "proposal";

  return (
    <MacWindow title="ASTRO — Assistente de IA">
      <div className="p-3 space-y-2 bg-[#0d0a1a] overflow-hidden" style={{ minHeight: 320 }}>
        {/* Welcome */}
        <div className="bg-[#7C3AED]/10 border border-[#7C3AED]/20 rounded-xl rounded-tl-sm p-3 nasa-pop-in">
          <p className="text-white/70 text-xs leading-relaxed">
            👋 Olá! Sou o <strong className="text-[#a78bfa]">ASTRO</strong>. Como posso ajudar hoje?
          </p>
        </div>

        {/* User: audio message */}
        {show("audio") && (
          <div className="flex justify-end nasa-pop-in">
            <div className="bg-white/6 border border-white/10 rounded-xl rounded-tr-sm p-3 flex items-center gap-2">
              <div className="flex items-end gap-[2px] h-4">
                {[1,2,3,4,5,3,2].map((h, i) => (
                  <div
                    key={i}
                    className="w-[3px] rounded-full bg-[#a78bfa] wave-bar"
                    style={{ height: `${h * 3}px`, animationDelay: `${i * 0.12}s` }}
                  />
                ))}
              </div>
              <span className="text-white/50 text-[10px]">0:04</span>
            </div>
          </div>
        )}

        {/* ASTRO thinking 1 */}
        {showThinking && (
          <div className="nasa-pop-in">
            <div className="bg-[#7C3AED]/10 border border-[#7C3AED]/20 rounded-xl rounded-tl-sm p-3 inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#a78bfa] dot-bounce-1" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#a78bfa] dot-bounce-2" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#a78bfa] dot-bounce-3" />
            </div>
          </div>
        )}

        {/* Agenda created */}
        {showAgenda && (
          <div className="bg-[#7C3AED]/10 border border-[#7C3AED]/20 rounded-xl rounded-tl-sm p-3 nasa-pop-in">
            <p className="text-[#a78bfa] text-[10px] font-semibold mb-1.5">✅ Agenda criada com sucesso</p>
            <div className="bg-black/30 rounded-lg p-2 space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                <span className="text-white/60 text-[10px]">Reunião com João · Amanhã 14h</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 shrink-0" />
                <span className="text-white/60 text-[10px]">Follow-up proposta · Sex 10h</span>
              </div>
            </div>
          </div>
        )}

        {/* User: proposal command */}
        {showProposalCmd && (
          <div className="flex justify-end nasa-pop-in">
            <div className="bg-white/6 border border-white/10 rounded-xl rounded-tr-sm p-3 max-w-[80%]">
              <p className="text-white/60 text-xs">Gera uma proposta para o João — R$2.400/mês</p>
            </div>
          </div>
        )}

        {/* ASTRO thinking 2 */}
        {showThinking2 && (
          <div className="nasa-pop-in">
            <div className="bg-[#7C3AED]/10 border border-[#7C3AED]/20 rounded-xl rounded-tl-sm p-3 inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#a78bfa] dot-bounce-1" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#a78bfa] dot-bounce-2" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#a78bfa] dot-bounce-3" />
            </div>
          </div>
        )}

        {/* Proposal created */}
        {showProposal && (
          <div className="bg-[#7C3AED]/10 border border-[#7C3AED]/20 rounded-xl rounded-tl-sm p-3 nasa-pop-in">
            <p className="text-[#a78bfa] text-[10px] font-semibold mb-2">📄 Proposta gerada — pronta para enviar</p>
            <div className="bg-black/30 rounded-lg p-2.5 border border-white/8">
              <p className="text-white/70 text-[10px] font-medium mb-1">Proposta Comercial — João Silva</p>
              <p className="text-white/40 text-[9px] leading-relaxed">Plano NASA Explore · 3 usuários · WhatsApp + CRM + Insights</p>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-emerald-400 text-[10px] font-bold">R$ 2.400/mês</span>
                <span className="bg-emerald-500/20 text-emerald-400 text-[9px] px-2 py-0.5 rounded-full border border-emerald-500/30">Pronta p/ envio</span>
              </div>
            </div>
            <div className="mt-2 flex gap-1.5">
              {["📤 Enviar por WhatsApp", "📋 Copiar link"].map((l) => (
                <div key={l} className="bg-[#7C3AED]/20 border border-[#7C3AED]/30 rounded-full px-2 py-1 text-[9px] text-[#c4b5fd]">{l}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    </MacWindow>
  );
}

// ─── AI Model Logos ───────────────────────────────────────────────────────────
function AiModelBadge({ name, color, letter }: { name: string; color: string; letter: string }) {
  return (
    <div className="flex items-center gap-2 bg-white/4 border border-white/8 rounded-xl px-3 py-2">
      <div
        className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-xs font-black shrink-0"
        style={{ background: color }}
      >
        {letter}
      </div>
      <span className="text-white/60 text-xs font-medium">{name}</span>
    </div>
  );
}

function AstroSection() {
  return (
    <section className="py-24 px-4 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#7C3AED]/4 to-transparent pointer-events-none" />
      <div className="max-w-6xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-[#7C3AED]/12 border border-[#7C3AED]/30 rounded-full px-5 py-2 mb-6">
            <Bot className="size-3.5 text-[#a78bfa]" />
            <span className="text-[#c4b5fd] text-sm font-medium">IA nativa no NASA</span>
          </div>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-black text-white mb-5">
            Conheça o <span className="text-nasa">ASTRO</span>
          </h2>
          <p className="text-white/45 text-xl max-w-2xl mx-auto">
            A maior IA de vendas do Brasil — une os melhores modelos do mundo em um único assistente nativo.
          </p>
        </div>

        <div className="relative rounded-3xl border border-[#7C3AED]/25 overflow-hidden nasa-glass p-8 md:p-12">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-[#7C3AED]/10 blur-[120px] pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full bg-[#a855f7]/7 blur-[80px] pointer-events-none" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#7C3AED]/50 to-transparent" />

          <div className="relative z-10 flex flex-col lg:flex-row items-start gap-12">
            {/* Left col */}
            <div className="flex-1">
              {/* AI model logos */}
              <p className="text-white/30 text-xs uppercase tracking-widest font-medium mb-3">Movido por</p>
              <div className="flex flex-wrap gap-2 mb-8">
                <AiModelBadge name="Claude · Anthropic" color="#D97757" letter="C" />
                <AiModelBadge name="Gemini · Google" color="#4285F4" letter="G" />
                <AiModelBadge name="GPT-4o · OpenAI" color="#10A37F" letter="O" />
              </div>

              <ul className="space-y-4 mb-8">
                {[
                  { icon: "🎙️", text: "Envia áudio e o ASTRO entende, cria agenda e proposta automaticamente" },
                  { icon: "📄", text: "Gera propostas comerciais personalizadas em segundos" },
                  { icon: "📅", text: "Agenda reuniões e follow-ups direto no calendário" },
                  { icon: "🔌", text: "Instala integrações por comando de voz ou texto" },
                  { icon: "🧭", text: "Conhece o Método N.A.S.A.® e guia seu time passo a passo" },
                  { icon: "📊", text: "Sugere ações baseadas nos seus dados reais de pipeline" },
                ].map((item) => (
                  <li key={item.text} className="flex items-start gap-3 text-white/65">
                    <span className="text-base shrink-0 mt-0.5">{item.icon}</span>
                    <span className="text-sm leading-relaxed">{item.text}</span>
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

            {/* Right col: animated chat mock */}
            <div className="w-full lg:w-[420px] shrink-0">
              <AstroAnimatedMock />
              {/* Live indicator */}
              <div className="mt-3 flex items-center justify-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="nasa-ping absolute inline-flex h-full w-full rounded-full bg-[#a78bfa] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#7C3AED]" />
                </span>
                <span className="text-white/30 text-[10px] font-medium">Demonstração ao vivo</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Insights Feature Section ─────────────────────────────────────────────────

function InsightsAnimatedMock() {
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setAnimKey((k) => k + 1), 5000);
    return () => clearInterval(t);
  }, []);

  const channels = [
    { name: "Meta Ads", color: "#1877F2", value: 82, roas: "4.2x", cpl: "R$18" },
    { name: "Google Ads", color: "#4285F4", value: 67, roas: "3.1x", cpl: "R$24" },
    { name: "TikTok Ads", color: "#69C9D0", value: 45, roas: "2.4x", cpl: "R$31" },
    { name: "Orgânico", color: "#a78bfa", value: 30, roas: "∞", cpl: "R$0" },
  ];

  return (
    <MacWindow title="NASA Insights — Tráfego Pago">
      <div className="bg-[#0d0a1a] p-4">
        {/* KPI row */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { label: "Impressões", value: "142K", delta: "+18%", up: true },
            { label: "Cliques", value: "8.3K", delta: "+12%", up: true },
            { label: "CPL médio", value: "R$21", delta: "-9%", up: true },
            { label: "ROAS", value: "3.8x", delta: "+0.4", up: true },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-white/4 rounded-xl p-2.5 border border-white/6">
              <p className="text-white/35 text-[8px] font-medium mb-0.5">{kpi.label}</p>
              <p className="text-white text-sm font-black">{kpi.value}</p>
              <p className={cn("text-[9px] font-semibold", kpi.up ? "text-emerald-400" : "text-red-400")}>{kpi.delta}</p>
            </div>
          ))}
        </div>

        {/* Bar chart */}
        <div className="bg-black/30 rounded-xl p-3 border border-white/6 mb-3">
          <p className="text-white/40 text-[9px] font-medium uppercase tracking-wider mb-3">Performance por canal</p>
          <div className="space-y-2.5">
            {channels.map((ch, i) => (
              <div key={`${ch.name}-${animKey}`} className="flex items-center gap-2">
                <div className="w-[70px] text-[9px] text-white/50 shrink-0 text-right">{ch.name}</div>
                <div className="flex-1 bg-white/5 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full rounded-full bar-rise"
                    style={{
                      width: `${ch.value}%`,
                      background: ch.color,
                      transformOrigin: "left",
                      animationDelay: `${i * 0.12}s`,
                    }}
                  />
                </div>
                <div className="flex gap-2 shrink-0">
                  <span className="text-[9px] text-emerald-400 font-bold w-8 text-right">{ch.roas}</span>
                  <span className="text-[9px] text-white/40 w-8 text-right">{ch.cpl}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-4 mt-2 pt-2 border-t border-white/5">
            <span className="text-[8px] text-emerald-400 font-medium">ROAS</span>
            <span className="text-[8px] text-white/35 font-medium">CPL</span>
          </div>
        </div>

        {/* Data flow arrow */}
        <div className="flex items-center gap-1.5 justify-center">
          {[
            { logo: "f", color: "#1877F2", label: "Meta" },
            { logo: "G", color: "#4285F4", label: "Google" },
          ].map((src) => (
            <div key={src.label} className="flex items-center gap-1">
              <div
                className="w-5 h-5 rounded-md flex items-center justify-center text-white text-[9px] font-black"
                style={{ background: src.color }}
              >
                {src.logo}
              </div>
              <span className="text-white/30 text-[8px]">{src.label}</span>
            </div>
          ))}
          <div className="flex-1 mx-1 h-px bg-gradient-to-r from-[#4285F4]/50 via-[#7C3AED]/70 to-[#a78bfa]/50 relative">
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 text-[#a78bfa] text-[8px]">→</div>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-5 h-5 rounded-md bg-[#7C3AED]/30 border border-[#7C3AED]/50 flex items-center justify-center">
              <BarChart2 className="size-2.5 text-[#a78bfa]" />
            </div>
            <span className="text-white/50 text-[8px] font-semibold">NASA Insights</span>
          </div>
        </div>
      </div>
    </MacWindow>
  );
}

function InsightsFeatureSection({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <section className="py-24 px-4 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#1877F2]/3 to-transparent pointer-events-none" />
      <div className="max-w-6xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-[#7C3AED]/12 border border-[#7C3AED]/30 rounded-full px-5 py-2 mb-6">
            <BarChart2 className="size-3.5 text-[#a78bfa]" />
            <span className="text-[#c4b5fd] text-sm font-medium">Tráfego pago unificado</span>
          </div>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-black text-white mb-5">
            NASA <span className="text-nasa">Insights</span>
          </h2>
          <p className="text-white/45 text-xl max-w-2xl mx-auto">
            Todos os dados do seu tráfego pago em um único painel. Meta, Google, TikTok — tudo integrado ao seu CRM.
          </p>
        </div>

        <div className="relative rounded-3xl border border-[#7C3AED]/25 overflow-hidden nasa-glass p-8 md:p-12">
          <div className="absolute top-0 left-0 w-[500px] h-[500px] rounded-full bg-[#4285F4]/6 blur-[120px] pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-72 h-72 rounded-full bg-[#1877F2]/6 blur-[80px] pointer-events-none" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#7C3AED]/50 to-transparent" />

          <div className="relative z-10 flex flex-col lg:flex-row items-start gap-12">
            {/* Left: animated mock */}
            <div className="w-full lg:w-[440px] shrink-0">
              <InsightsAnimatedMock />
              {/* Source badges */}
              <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
                {[
                  { name: "Meta Ads", color: "#1877F2" },
                  { name: "Google Ads", color: "#4285F4" },
                  { name: "TikTok Ads", color: "#69C9D0" },
                ].map((s) => (
                  <div key={s.name} className="flex items-center gap-1.5 bg-white/4 border border-white/8 rounded-full px-2.5 py-1">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
                    <span className="text-white/40 text-[9px] font-medium">{s.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: features */}
            <div className="flex-1">
              <ul className="space-y-4 mb-8">
                {[
                  { icon: "📊", text: "ROAS, CPL, CPC, impressões e conversões por canal em tempo real" },
                  { icon: "🎯", text: "Atribua cada lead ao anúncio que o gerou — funil completo" },
                  { icon: "🤖", text: "ASTRO analisa os dados e sugere onde investir mais orçamento" },
                  { icon: "🔁", text: "Dados fluem direto para o pipeline — nenhum lead se perde" },
                  { icon: "📈", text: "Comparativo entre períodos com alertas de queda de performance" },
                  { icon: "🔗", text: "Integração nativa com Meta Business, Google Ads e TikTok Ads" },
                ].map((item) => (
                  <li key={item.text} className="flex items-start gap-3 text-white/65">
                    <span className="text-base shrink-0 mt-0.5">{item.icon}</span>
                    <span className="text-sm leading-relaxed">{item.text}</span>
                  </li>
                ))}
              </ul>

              {/* Mini stat cards */}
              <div className="grid grid-cols-2 gap-3 mb-8">
                {[
                  { label: "Redução de CPL", value: "até 40%", color: "text-emerald-400", bg: "bg-emerald-400/8 border-emerald-400/20" },
                  { label: "ROAS médio", value: "3.8×", color: "text-[#a78bfa]", bg: "bg-[#7C3AED]/10 border-[#7C3AED]/20" },
                  { label: "Canais integrados", value: "3 plats.", color: "text-[#4285F4]", bg: "bg-[#4285F4]/8 border-[#4285F4]/20" },
                  { label: "Atualização", value: "Em tempo real", color: "text-yellow-400", bg: "bg-yellow-400/8 border-yellow-400/20" },
                ].map((stat) => (
                  <div key={stat.label} className={cn("rounded-xl p-3 border", stat.bg)}>
                    <p className="text-white/40 text-[10px] font-medium mb-0.5">{stat.label}</p>
                    <p className={cn("font-black text-sm", stat.color)}>{stat.value}</p>
                  </div>
                ))}
              </div>

              <Button
                asChild
                className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold px-7 py-5 rounded-xl card-hover nasa-glow-sm"
              >
                <Link href={isLoggedIn ? "/insights" : "/sign-up"}>
                  Ver meu painel de Insights
                  <ArrowRight className="size-4 ml-2" />
                </Link>
              </Button>
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

// ─── Stars Info Section ───────────────────────────────────────────────────────

const STARS_CARDS = [
  {
    icon: Gift,
    color: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/20",
    title: "Plano Suit — Gratuito para sempre",
    desc: "Comece sem pagar nada. CRM completo, pipeline de vendas e usuários ilimitados (30★/usuário). Sem expiração.",
  },
  {
    icon: RefreshCw,
    color: "text-yellow-400", bg: "bg-yellow-400/10", border: "border-yellow-400/20",
    title: "Stars nunca se perdem",
    desc: "30% das suas Stars não utilizadas rolam automaticamente para o próximo mês. Seu esforço acumula.",
  },
  {
    icon: Layers,
    color: "text-violet-400", bg: "bg-violet-400/10", border: "border-violet-400/20",
    title: "Acumule e escale no seu ritmo",
    desc: "Compre pacotes avulsos de Stars quando precisar ativar uma integração específica. Sem comprometimento de plano.",
  },
  {
    icon: Bolt,
    color: "text-blue-400", bg: "bg-blue-400/10", border: "border-blue-400/20",
    title: "Cada Star tem poder real",
    desc: "Stars ativam integrações (WhatsApp, Instagram, IA), automações e relatórios avançados conforme você cresce.",
  },
  {
    icon: BrainCircuit,
    color: "text-pink-400", bg: "bg-pink-400/10", border: "border-pink-400/20",
    title: "IA inclusa em todo plano pago",
    desc: "O ASTRO, assistente de IA da plataforma, está disponível em todos os planos pagos para acelerar seu processo comercial.",
  },
  {
    icon: Lock,
    color: "text-orange-400", bg: "bg-orange-400/10", border: "border-orange-400/20",
    title: "Seus dados, sua empresa",
    desc: "LGPD Compliant, hospedagem 100% no Brasil, backups diários. Seu negócio protegido do começo ao fim.",
  },
];

function StarsInfoSection({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <section className="py-28 px-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-yellow-400/4 blur-3xl" />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Badge */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2 bg-yellow-400/10 border border-yellow-400/25 rounded-full px-5 py-2">
            <Star className="size-3.5 text-yellow-400 fill-yellow-400" />
            <span className="text-yellow-300 text-sm font-semibold tracking-wide">★ Stars — A moeda do crescimento</span>
          </div>
        </div>

        <h2 className="text-4xl sm:text-5xl font-black text-white text-center mb-4 leading-tight">
          Para quem está começando,<br />
          <span className="text-nasa">tudo começa de graça</span>
        </h2>
        <p className="text-white/40 text-center text-lg mb-16 max-w-2xl mx-auto leading-relaxed">
          Stars são a moeda interna do NASA. Cada plano inclui um crédito mensal para ativar integrações,
          automações e funcionalidades avançadas. E o melhor: você começa sem gastar nada.
        </p>

        {/* How Stars work visual */}
        <div className="nasa-glass rounded-2xl border border-white/8 p-6 mb-12 max-w-4xl mx-auto">
          <p className="text-white/30 text-xs font-medium uppercase tracking-widest text-center mb-6">Como Stars funcionam</p>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {[
              { emoji: "📋", label: "Assine um plano", sub: "ou use o Suit grátis" },
              { emoji: "→", label: "", sub: "" },
              { emoji: "⭐", label: "Receba Stars mensais", sub: "créditos automáticos" },
              { emoji: "→", label: "", sub: "" },
              { emoji: "🔌", label: "Ative integrações", sub: "WhatsApp, IA, CRM..." },
              { emoji: "→", label: "", sub: "" },
              { emoji: "📈", label: "Escale seu negócio", sub: "com dados e automações" },
            ].map((step, i) => (
              step.label === "" ? (
                <div key={i} className="text-white/15 text-2xl hidden sm:block">→</div>
              ) : (
                <div key={i} className="text-center flex-1">
                  <div className="text-3xl mb-1">{step.emoji}</div>
                  <p className="text-white/80 text-xs font-semibold">{step.label}</p>
                  <p className="text-white/30 text-[10px] mt-0.5">{step.sub}</p>
                </div>
              )
            ))}
          </div>
        </div>

        {/* Benefit cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-14">
          {STARS_CARDS.map(({ icon: Icon, color, bg, border, title, desc }) => (
            <div key={title} className={cn("nasa-glass rounded-xl p-5 border transition-all card-hover", border)}>
              <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center mb-3", bg)}>
                <Icon className={cn("size-4.5", color)} />
              </div>
              <p className="text-white font-bold text-sm mb-1.5">{title}</p>
              <p className="text-white/45 text-xs leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        {/* Rollover visual */}
        <div className="stars-card rounded-2xl p-8 max-w-3xl mx-auto text-center">
          <div className="text-5xl mb-3">♻️</div>
          <h3 className="text-white font-black text-xl mb-2">Stars não utilizadas <span className="text-yellow-400">não desaparecem</span></h3>
          <p className="text-white/50 text-sm mb-6 max-w-lg mx-auto leading-relaxed">
            Uma parte das suas Stars inutilizadas rolam para o próximo ciclo. Quanto melhor seu plano,
            maior o rollover — recompensando quem planeja com inteligência.
          </p>
          <div className="flex justify-center gap-6 flex-wrap">
            {[
              { plan: "Suit",         pct: "0%",  color: "text-zinc-400",   badge: "bg-zinc-700" },
              { plan: "Earth",        pct: "20%", color: "text-blue-400",   badge: "bg-blue-500/20" },
              { plan: "Explore",      pct: "25%", color: "text-violet-400", badge: "bg-violet-500/20" },
              { plan: "Constellation",pct: "30%", color: "text-yellow-400", badge: "bg-yellow-500/20" },
            ].map(({ plan, pct, color, badge }) => (
              <div key={plan} className="text-center">
                <div className={cn("text-2xl font-black mb-1", color)}>{pct}</div>
                <div className={cn("text-xs px-2 py-0.5 rounded-full font-semibold text-white/70", badge)}>{plan}</div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-12">
          <Button asChild size="lg"
            className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-black px-10 py-6 text-base rounded-2xl nasa-glow-sm">
            <Link href={isLoggedIn ? "/tracking" : "/sign-up"}>
              Começar com Suit — Grátis
              <Gift className="size-4 ml-2" />
            </Link>
          </Button>
          <p className="text-white/25 text-xs mt-3">Sem cartão de crédito · Cancele quando quiser</p>
        </div>
      </div>
    </section>
  );
}

// ─── Plans Public Section (estilo admin PlanCard) ────────────────────────────

// Custo de Star por usuário ativo/mês (regra global)
const STAR_PER_USER = 30;

const PUBLIC_PLANS = [
  {
    id: "suit", name: "Suit", slogan: "Para quem está dando os primeiros passos",
    price: 0, billingLabel: "/mês", stars: 0, rollover: 0,
    highlighted: false, ctaLabel: "Começar grátis", ctaHref: "/sign-up",
    badge: null,
    benefits: [
      "CRM completo e pipeline de vendas",
      "Usuários ilimitados — 30★ por usuário/mês",
      "Agenda e agendamentos",
      "Proposta e contratos (FORGE)",
      "N.Box — gerenciamento de arquivos",
      "Compre Stars avulsas para crescer",
      "Suporte por e-mail",
    ],
  },
  {
    id: "earth", name: "Earth", slogan: "Primeiros resultados com automação",
    price: 197, billingLabel: "/mês", stars: 1000, rollover: 20,
    highlighted: false, ctaLabel: "Assinar Earth", ctaHref: "/sign-up",
    badge: null,
    benefits: [
      "Tudo do Suit, mais:",
      "1.000 Stars mensais",
      "20% de rollover de Stars",
      "Suporta ~26 usuários ativos/mês",
      "Relatórios básicos",
      "Suporte prioritário",
    ],
  },
  {
    id: "explore", name: "Explore", slogan: "Para empresas que automatizam e crescem",
    price: 397, billingLabel: "/mês", stars: 3000, rollover: 25,
    highlighted: true, ctaLabel: "Assinar Explore", ctaHref: "/sign-up",
    badge: "MAIS POPULAR",
    benefits: [
      "Tudo do Earth, mais:",
      "3.000 Stars mensais",
      "25% de rollover de Stars",
      "Suporta ~80 usuários ativos/mês",
      "IA ASTRO completo",
      "NASA Planner + Mind Maps",
      "Space Points gamificado",
      "Suporte dedicado",
    ],
  },
  {
    id: "constellation", name: "Constellation", slogan: "Para empresas sem limites",
    price: 797, billingLabel: "/mês", stars: 20000, rollover: 30,
    highlighted: false, ctaLabel: "Falar com vendas", ctaHref: "mailto:vendas@nasaex.com.br",
    badge: "ENTERPRISE",
    benefits: [
      "Tudo do Explore, mais:",
      "20.000 Stars mensais",
      "30% de rollover de Stars",
      "Suporta ~500+ usuários ativos/mês",
      "Gerente de conta dedicado",
      "SLA customizado",
      "Onboarding personalizado",
      "Relatórios avançados",
    ],
  },
];

// PlanCard público — espelha o padrão do /admin > Planos
function PublicPlanCard({
  plan,
  isLoggedIn,
  currentPlanSlug,
  onPurchase,
}: {
  plan:             typeof PUBLIC_PLANS[number] & { planSlug?: string };
  isLoggedIn:       boolean;
  currentPlanSlug?: string;
  onPurchase?:      (planSlug: string) => void;
}) {
  const [showBenefits, setShowBenefits] = useState(false);
  const [detailOpen,   setDetailOpen]   = useState(false);

  const slug          = plan.planSlug ?? plan.id;
  const isCurrentPlan = isLoggedIn && currentPlanSlug === slug;

  const planDetail: PlanDetail = {
    id:          plan.id,
    name:        plan.name,
    slogan:      plan.slogan,
    price:       plan.price,
    stars:       plan.stars,
    rollover:    plan.rollover,
    highlighted: plan.highlighted,
    badge:       plan.badge,
    benefits:    plan.benefits,
    ctaLabel:    plan.ctaLabel,
    ctaHref:     plan.ctaHref,
    starPerUser: STAR_PER_USER,
    planSlug:    slug,
  };

  return (
    <>
      <PlanDetailModal
        plan={planDetail}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        isLoggedIn={isLoggedIn}
        isCurrentPlan={isCurrentPlan}
        onPurchase={() => onPurchase?.(slug)}
      />

    <div className={cn(
      "relative flex flex-col rounded-xl border p-5 space-y-4 transition-all card-hover",
      plan.highlighted
        ? "border-violet-500/50 bg-violet-950/20 shadow-[0_0_40px_rgba(124,58,237,.15)]"
        : plan.id === "constellation"
        ? "border-yellow-500/30 bg-yellow-950/10"
        : plan.price === 0
        ? "border-emerald-700/30 bg-emerald-950/10"
        : "border-zinc-700/50 bg-zinc-900/80"
    )}>
      {/* Badges */}
      {plan.badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
          <span className={cn(
            "text-[10px] font-black px-3 py-1 rounded-full whitespace-nowrap",
            plan.highlighted
              ? "bg-violet-600 text-white shadow-lg shadow-violet-500/40"
              : "bg-gradient-to-r from-yellow-500 to-orange-500 text-black"
          )}>
            {plan.badge}
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setDetailOpen(true)}
              className="font-bold text-white text-lg hover:text-violet-300 transition-colors cursor-pointer underline-offset-2 hover:underline"
            >
              {plan.name}
            </button>
            {plan.highlighted && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-600/30 text-violet-300 border border-violet-700/50">
                ⭐ Destaque
              </span>
            )}
          </div>
          <p className="text-xs text-white/40 mt-0.5">{plan.slogan}</p>
        </div>
        <div className="text-right shrink-0">
          {plan.price === 0 ? (
            <p className="text-xl font-bold text-emerald-400">Grátis</p>
          ) : (
            <p className="text-xl font-bold text-white">
              R$ {plan.price.toLocaleString("pt-BR")}
            </p>
          )}
          <p className="text-[10px] text-white/30">por mês</p>
        </div>
      </div>

      {/* Stats — igual ao admin PlanCard */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="flex flex-col items-center p-2 rounded-lg bg-white/5 border border-white/5">
          <Star className="w-3.5 h-3.5 text-yellow-400 mb-0.5" />
          <span className="font-semibold text-white">
            {plan.stars === 0 ? "—" : plan.stars >= 1000 ? `${plan.stars / 1000}K` : plan.stars}
          </span>
          <span className="text-white/30 text-[9px]">Stars/mês</span>
        </div>
        <div className="flex flex-col items-center p-2 rounded-lg bg-violet-500/8 border border-violet-500/20">
          <Users className="w-3.5 h-3.5 text-violet-400 mb-0.5" />
          <span className="font-semibold text-violet-300">{STAR_PER_USER}★</span>
          <span className="text-violet-400/50 text-[9px]">por usuário</span>
        </div>
        <div className="flex flex-col items-center p-2 rounded-lg bg-white/5 border border-white/5">
          <span className="text-base mb-0.5">🔁</span>
          <span className="font-semibold text-white">{plan.rollover}%</span>
          <span className="text-white/30 text-[9px]">Rollover</span>
        </div>
      </div>

      {/* Usuários ilimitados pill */}
      <div className="flex items-center gap-1.5 bg-violet-500/8 border border-violet-500/15 rounded-lg px-3 py-2">
        <Users className="size-3 text-violet-400 shrink-0" />
        <span className="text-violet-300/80 text-[11px] font-medium">
          Usuários ilimitados — {STAR_PER_USER}★ por usuário/mês
        </span>
      </div>

      {/* Benefits colapsável — igual ao admin */}
      <div>
        <button
          type="button"
          onClick={() => setShowBenefits(!showBenefits)}
          className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition-colors"
        >
          {showBenefits
            ? <ChevronUp className="w-3 h-3" />
            : <ChevronDown className="w-3 h-3" />}
          {plan.benefits.length} benefício(s) incluídos
        </button>
        {showBenefits && (
          <ul className="mt-2 space-y-1.5">
            {plan.benefits.map((b, i) => (
              <li key={i} className={cn(
                "flex items-start gap-1.5 text-xs",
                b.startsWith("Tudo do") ? "text-white/30 font-semibold" : "text-white/55"
              )}>
                {b.startsWith("Tudo do")
                  ? <ChevronUp className="w-3 h-3 shrink-0 mt-0.5 text-white/20" />
                  : <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />}
                {b}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Divisor */}
      <div className="border-t border-white/8" />

      {/* CTA */}
      {isCurrentPlan ? (
        <Button
          disabled
          className={cn(
            "w-full font-bold text-sm rounded-xl opacity-60 cursor-not-allowed",
            plan.price === 0
              ? "bg-emerald-700 text-white"
              : plan.highlighted
              ? "bg-violet-600 text-white"
              : "bg-zinc-700/80 text-white border border-zinc-600/50"
          )}
        >
          Plano atual
        </Button>
      ) : isLoggedIn ? (
        <Button
          onClick={() => onPurchase?.(slug)}
          className={cn(
            "w-full font-bold text-sm rounded-xl",
            plan.highlighted
              ? "bg-violet-600 hover:bg-violet-700 text-white"
              : plan.id === "constellation"
              ? "bg-gradient-to-r from-yellow-500/80 to-orange-500/80 hover:from-yellow-500 hover:to-orange-500 text-black"
              : plan.price === 0
              ? "bg-emerald-700 hover:bg-emerald-600 text-white"
              : "bg-zinc-700/80 hover:bg-zinc-700 text-white border border-zinc-600/50"
          )}
        >
          Adquirir plano
          <ArrowRight className="size-3.5 ml-1.5" />
        </Button>
      ) : (
        <Button
          asChild
          className={cn(
            "w-full font-bold text-sm rounded-xl",
            plan.highlighted
              ? "bg-violet-600 hover:bg-violet-700 text-white"
              : plan.id === "constellation"
              ? "bg-gradient-to-r from-yellow-500/80 to-orange-500/80 hover:from-yellow-500 hover:to-orange-500 text-black"
              : plan.price === 0
              ? "bg-emerald-700 hover:bg-emerald-600 text-white"
              : "bg-zinc-700/80 hover:bg-zinc-700 text-white border border-zinc-600/50"
          )}
        >
          <Link href={plan.ctaHref}>
            {plan.ctaLabel}
            <ArrowRight className="size-3.5 ml-1.5" />
          </Link>
        </Button>
      )}
    </div>
    </>
  );
}

function PlansPublicSection({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [purchaseOpen,    setPurchaseOpen]    = useState(false);
  const [purchasePlanSlug, setPurchasePlanSlug] = useState<string | undefined>(undefined);

  // Fetch plans live from DB (public endpoint, no auth needed)
  const { data: dbData, isLoading: plansLoading } = useQuery(
    orpc.public.listPlans.queryOptions()
  );

  // Fetch current plan slug for logged-in users
  const { data: balanceData } = useQuery({
    ...orpc.stars.getBalance.queryOptions(),
    enabled: isLoggedIn,
  });
  const currentPlanSlug = balanceData?.planSlug;

  const handlePurchase = (planSlug: string) => {
    setPurchasePlanSlug(planSlug);
    setPurchaseOpen(true);
  };

  // Map DB plans → PublicPlanCard shape, fall back to hardcoded
  const plans = (dbData?.plans ?? []).length > 0
    ? dbData!.plans.map((p) => ({
        id:           p.slug,
        planSlug:     p.slug,
        name:         p.name,
        stars:        p.monthlyStars,
        price:        p.priceMonthly,
        billingLabel: "/mês",
        rollover:     p.rolloverPct,
        highlighted:  p.highlighted,
        badge:        p.highlighted ? ("MAIS POPULAR" as string | null) : null,
        slogan:       p.slogan ?? "",
        benefits:     p.benefits,
        ctaLabel:     p.ctaLabel,
        ctaHref:      p.ctaLink ?? "/sign-up",
      }))
    : PUBLIC_PLANS;

  return (
    <section id="planos" className="py-28 px-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#7C3AED]/5 blur-3xl rounded-full" />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2 bg-[#7C3AED]/15 border border-[#7C3AED]/30 rounded-full px-5 py-2">
            <Sparkles className="size-3.5 text-violet-400" />
            <span className="text-violet-300 text-sm font-semibold tracking-wide">Planos NASA</span>
          </div>
        </div>

        <h2 className="text-4xl sm:text-5xl font-black text-white text-center mb-3 leading-tight">
          Escolha seu <span className="text-nasa">ponto de partida</span>
        </h2>
        <p className="text-white/40 text-center text-lg mb-6 max-w-xl mx-auto">
          De startups a operações enterprise — escale flexível com o Método N.A.S.A.®
        </p>

        {/* Regra de Stars por usuário — destaque */}
        <div className="max-w-2xl mx-auto mb-12">
          <div className="flex flex-col sm:flex-row items-center gap-4 bg-gradient-to-r from-violet-950/40 to-blue-950/30 border border-violet-500/25 rounded-2xl px-6 py-5">
            <div className="text-4xl shrink-0">🚀</div>
            <div className="text-center sm:text-left">
              <p className="text-white font-black text-lg leading-tight">
                Empresas e usuários são <span className="text-violet-300">ilimitados</span>
              </p>
              <p className="text-white/50 text-sm mt-1">
                Não existe limite de usuários em nenhum plano. Cada usuário ativo custa{" "}
                <span className="text-yellow-400 font-bold">{STAR_PER_USER} ★/mês</span>.
                Basta ter crédito Star e <span className="text-violet-300 font-semibold">Decole!</span>
              </p>
            </div>
            <div className="shrink-0 text-center bg-violet-600/20 border border-violet-500/30 rounded-xl px-4 py-3">
              <p className="text-violet-300 font-black text-2xl">{STAR_PER_USER}★</p>
              <p className="text-white/30 text-[10px]">por usuário/mês</p>
            </div>
          </div>
        </div>

        {plansLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-72 rounded-xl bg-white/4 animate-pulse border border-white/6" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
            {plans.map((plan) => (
              <PublicPlanCard
                key={plan.id}
                plan={plan}
                isLoggedIn={isLoggedIn}
                currentPlanSlug={currentPlanSlug}
                onPurchase={handlePurchase}
              />
            ))}
          </div>
        )}

        <p className="text-center text-white/15 text-xs mt-8">
          🔒 Pagamento seguro via Stripe e PIX (Asaas) · Cancele quando quiser · LGPD Compliant
        </p>
      </div>

      {/* Modal de compra de plano */}
      <PlanPurchaseModal
        open={purchaseOpen}
        onClose={() => setPurchaseOpen(false)}
        currentPlanSlug={currentPlanSlug}
        initialPlanSlug={purchasePlanSlug}
      />
    </section>
  );
}

// ─── Apps Showcase Section ────────────────────────────────────────────────────

const ALL_APPS: { slug: string; name: string; icon: string; category: string; cost: number; desc: string }[] = [
  // Mensageiros
  { slug: "whatsapp-business",  name: "WhatsApp Business",  icon: "💬", category: "Mensageiros",   cost: 80,  desc: "Capture leads e gerencie conversas WA no CRM" },
  { slug: "instagram-dm",       name: "Instagram DM",       icon: "📸", category: "Mensageiros",   cost: 60,  desc: "DMs do Instagram integradas ao pipeline" },
  { slug: "telegram",           name: "Telegram",           icon: "✈️",  category: "Mensageiros",   cost: 40,  desc: "Bots e canais Telegram → leads automáticos" },
  { slug: "facebook-messenger", name: "Facebook Messenger", icon: "💙", category: "Mensageiros",   cost: 60,  desc: "Messenger do Facebook integrado ao CRM" },
  { slug: "tiktok",             name: "TikTok",             icon: "🎵", category: "Mensageiros",   cost: 50,  desc: "Leads e mensagens TikTok Business no NASA" },
  { slug: "linkedin",           name: "LinkedIn",           icon: "💼", category: "Mensageiros",   cost: 50,  desc: "Conexões e DMs do LinkedIn no pipeline" },
  { slug: "slack",              name: "Slack",              icon: "🟦", category: "Mensageiros",   cost: 30,  desc: "Alertas e notificações no workspace Slack" },
  { slug: "discord",            name: "Discord",            icon: "🎮", category: "Mensageiros",   cost: 30,  desc: "Servidores Discord → captura de leads" },
  // CRM
  { slug: "kommo",              name: "Kommo",              icon: "🤝", category: "CRM & Vendas",  cost: 60,  desc: "Sincronize leads entre Kommo e NASA" },
  { slug: "hubspot",            name: "HubSpot",            icon: "🟠", category: "CRM & Vendas",  cost: 80,  desc: "Contatos, pipelines e automações HubSpot" },
  { slug: "salesforce",         name: "Salesforce",         icon: "☁️",  category: "CRM & Vendas",  cost: 100, desc: "Sync em tempo real Salesforce ↔ NASA" },
  { slug: "pipedrive",          name: "Pipedrive",          icon: "🔵", category: "CRM & Vendas",  cost: 60,  desc: "Negócios do Pipedrive no pipeline NASA" },
  { slug: "rd-station",         name: "RD Station CRM",    icon: "🟢", category: "CRM & Vendas",  cost: 60,  desc: "Leads e funil RD Station sincronizados" },
  { slug: "agendor",            name: "Agendor",            icon: "📋", category: "CRM & Vendas",  cost: 40,  desc: "Migre dados do Agendor para o NASA" },
  { slug: "piperun",            name: "Piperun",            icon: "🔄", category: "CRM & Vendas",  cost: 40,  desc: "Negócios Piperun integrados ao NASA" },
  // Marketing
  { slug: "meta-ads",           name: "Meta Ads",           icon: "📢", category: "Marketing",     cost: 40,  desc: "Leads Facebook/Instagram Ads → pipeline" },
  { slug: "google-ads",         name: "Google Ads",         icon: "🎯", category: "Marketing",     cost: 40,  desc: "Leads Google Ads com rastreamento NASA" },
  { slug: "rd-station-mkt",     name: "RD Station Mkt",     icon: "📣", category: "Marketing",     cost: 50,  desc: "Fluxos de automação de marketing" },
  { slug: "active-campaign",    name: "ActiveCampaign",     icon: "📬", category: "Marketing",     cost: 50,  desc: "E-mail marketing e segmentação integrada" },
  { slug: "mailchimp",          name: "Mailchimp",          icon: "🐒", category: "Marketing",     cost: 30,  desc: "Campanhas Mailchimp → leads NASA" },
  { slug: "leadlovers",         name: "Leadlovers",         icon: "🎣", category: "Marketing",     cost: 40,  desc: "Funis Leadlovers no CRM e pipeline" },
  // IA
  { slug: "openai",             name: "OpenAI / ChatGPT",   icon: "🤖", category: "IA & Automação",cost: 60,  desc: "GPT-4 potencializando o ASTRO" },
  { slug: "google-gemini",      name: "Google Gemini",      icon: "✨", category: "IA & Automação",cost: 50,  desc: "Gemini para análises multimodais" },
  { slug: "anthropic",          name: "Anthropic Claude",   icon: "🧠", category: "IA & Automação",cost: 60,  desc: "Claude para contextos profundos" },
  { slug: "zapier",             name: "Zapier",             icon: "⚡", category: "IA & Automação",cost: 50,  desc: "Automatize entre NASA e +5.000 apps" },
  { slug: "make",               name: "Make",               icon: "🔧", category: "IA & Automação",cost: 50,  desc: "Fluxos complexos entre NASA e centenas de tools" },
  { slug: "n8n",                name: "n8n",                icon: "🔀", category: "IA & Automação",cost: 40,  desc: "Automações self-hosted ilimitadas" },
  // Pagamentos
  { slug: "stripe",             name: "Stripe",             icon: "💳", category: "Pagamentos",    cost: 30,  desc: "Pagamentos internacionais e assinaturas" },
  { slug: "asaas",              name: "Asaas",              icon: "🏦", category: "Pagamentos",    cost: 30,  desc: "PIX, boleto e cartão integrado ao FORGE" },
  { slug: "mercado-pago",       name: "Mercado Pago",       icon: "💰", category: "Pagamentos",    cost: 40,  desc: "Pagamentos Mercado Pago no CRM" },
  { slug: "hotmart",            name: "Hotmart",            icon: "🔥", category: "Pagamentos",    cost: 40,  desc: "Compras Hotmart → leads automáticos" },
  { slug: "pagseguro",          name: "PagSeguro",          icon: "💵", category: "Pagamentos",    cost: 40,  desc: "Cobranças PagSeguro no pipeline NASA" },
  // Formulários
  { slug: "typeform",           name: "Typeform",           icon: "📝", category: "Formulários",   cost: 20,  desc: "Formulários Typeform → leads qualificados" },
  { slug: "google-forms",       name: "Google Forms",       icon: "📋", category: "Formulários",   cost: 20,  desc: "Google Forms → leads no CRM" },
  { slug: "jotform",            name: "JotForm",            icon: "📄", category: "Formulários",   cost: 20,  desc: "Respostas JotForm → funil de vendas" },
  { slug: "tally",              name: "Tally",              icon: "🗂️",  category: "Formulários",   cost: 15,  desc: "Forms Tally → leads automáticos" },
  // Analytics
  { slug: "google-analytics",   name: "Google Analytics",   icon: "📊", category: "Analytics",     cost: 20,  desc: "GA4 correlacionado ao funil de vendas" },
  { slug: "hotjar",             name: "Hotjar",             icon: "🔥", category: "Analytics",     cost: 30,  desc: "Comportamento de usuários × leads gerados" },
  { slug: "looker-studio",      name: "Looker Studio",      icon: "🔭", category: "Analytics",     cost: 20,  desc: "Dashboards NASA no Looker Studio" },
  // E-Commerce
  { slug: "shopify",            name: "Shopify",            icon: "🛍️",  category: "E-Commerce",    cost: 80,  desc: "Pedidos Shopify → leads no CRM" },
  { slug: "woocommerce",        name: "WooCommerce",        icon: "🛒", category: "E-Commerce",    cost: 60,  desc: "Compras WooCommerce no pipeline" },
  { slug: "nuvemshop",          name: "Nuvemshop",          icon: "☁️",  category: "E-Commerce",    cost: 60,  desc: "Pedidos Nuvemshop → funil NASA" },
  { slug: "mercado-livre",      name: "Mercado Livre",      icon: "🟡", category: "E-Commerce",    cost: 60,  desc: "Compradores ML → CRM automático" },
  // Assinatura Digital
  { slug: "docusign",           name: "DocuSign",           icon: "✍️",  category: "Doc. Digital",  cost: 40,  desc: "Contratos DocuSign pelo FORGE" },
  { slug: "clicksign",          name: "ClickSign",          icon: "✅", category: "Doc. Digital",  cost: 40,  desc: "Assinatura digital brasileira no FORGE" },
  { slug: "d4sign",             name: "D4Sign",             icon: "📜", category: "Doc. Digital",  cost: 30,  desc: "Documentos com validade jurídica" },
  { slug: "google-drive",       name: "Google Drive",       icon: "📁", category: "Doc. Digital",  cost: 20,  desc: "Drive sincronizado com o N.Box" },
  // Produtividade
  { slug: "google-workspace",   name: "Google Workspace",   icon: "🏢", category: "Produtividade", cost: 30,  desc: "Gmail, Calendar e Drive integrados" },
  { slug: "microsoft-365",      name: "Microsoft 365",      icon: "💻", category: "Produtividade", cost: 30,  desc: "Outlook, Teams e OneDrive no NASA" },
  { slug: "zoom",               name: "Zoom",               icon: "📹", category: "Produtividade", cost: 30,  desc: "Reuniões Zoom vinculadas a leads" },
  { slug: "calendly",           name: "Calendly",           icon: "📅", category: "Produtividade", cost: 20,  desc: "Agendamentos Calendly na Agenda NASA" },
];

const APP_CATEGORIES = [...new Set(ALL_APPS.map((a) => a.category))];

// ─── Patterns Feature Section ─────────────────────────────────────────────────────

function PatternsFeatureSection({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <section className="py-16 px-4 relative overflow-hidden">
      <div className="max-w-6xl mx-auto relative z-10">
        <Link href="/patterns">
          <div className="rounded-2xl border border-violet-500/30 bg-gradient-to-r from-violet-600/10 via-violet-600/5 to-transparent p-8 hover:border-violet-500/50 transition-all cursor-pointer group">
            <div className="flex items-center justify-between gap-6">
              <div className="flex-1">
                <div className="inline-flex items-center gap-2 bg-violet-500/20 border border-violet-500/30 rounded-full px-4 py-1 mb-3">
                  <Sparkles className="size-3.5 text-violet-400" />
                  <span className="text-violet-300 text-xs font-semibold">Novidade</span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-white mb-2">
                  Padrões NASA
                </h3>
                <p className="text-white/50 text-sm sm:text-base max-w-xl">
                  Explore templates pré-configurados e exemplos prontos para usar. Duplique padrões de Tracking, Workspace, Propostas e Contratos para sua empresa.
                </p>
              </div>
              <div className="hidden sm:flex items-center justify-center">
                <div className="text-5xl">✨</div>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-violet-400 group-hover:text-violet-300 transition-colors">
              <span className="text-sm font-semibold">Ver padrões disponíveis</span>
              <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </Link>
      </div>
    </section>
  );
}

function AppsShowcaseSection({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [activeCategory, setActiveCategory] = useState<string>("Mensageiros");
  const [showAll,        setShowAll]         = useState(false);

  const filtered  = ALL_APPS.filter((a) => a.category === activeCategory);
  const displayed = showAll ? filtered : filtered.slice(0, 8);

  const totalApps = ALL_APPS.length;
  const cheapest  = Math.min(...ALL_APPS.map((a) => a.cost));
  const mostPop   = ALL_APPS.find((a) => a.slug === "whatsapp-business")!;

  return (
    <section className="py-24 px-4 relative overflow-hidden border-t border-white/5">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute bottom-0 left-1/4 w-[600px] h-[400px] bg-[#7C3AED]/4 blur-3xl rounded-full" />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Header */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/25 rounded-full px-5 py-2">
            <Plug2 className="size-3.5 text-blue-400" />
            <span className="text-blue-300 text-sm font-semibold tracking-wide">{totalApps}+ integrações disponíveis</span>
          </div>
        </div>

        <h2 className="text-4xl sm:text-5xl font-black text-white text-center mb-3 leading-tight">
          Todos os apps disponíveis<br />
          <span className="text-nasa">em qualquer plano</span>
        </h2>
        <p className="text-white/40 text-center text-lg mb-4 max-w-2xl mx-auto leading-relaxed">
          Não existe app bloqueado por plano. O único critério é ter Stars suficientes para ativá-los.
          Quanto mais Stars, mais você pode conectar.
        </p>

        {/* Key stats */}
        <div className="flex flex-wrap justify-center gap-4 mb-12">
          {[
            { label: "Apps disponíveis", value: `${totalApps}+`, color: "text-violet-400" },
            { label: "Menor custo", value: `${cheapest} ★/mês`, color: "text-yellow-400" },
            { label: "Bloqueados por plano", value: "0", color: "text-emerald-400" },
            { label: "Categorias", value: `${APP_CATEGORIES.length}`, color: "text-blue-400" },
          ].map(({ label, value, color }) => (
            <div key={label} className="nasa-glass border border-white/8 rounded-xl px-5 py-3 text-center min-w-[120px]">
              <p className={cn("text-xl font-black", color)}>{value}</p>
              <p className="text-white/30 text-[11px] mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Category tabs */}
        <div className="flex flex-wrap gap-2 justify-center mb-8">
          {APP_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => { setActiveCategory(cat); setShowAll(false); }}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
                activeCategory === cat
                  ? "bg-violet-600 border-violet-600 text-white"
                  : "border-white/10 text-white/40 hover:text-white/70 hover:border-white/20"
              )}
            >
              {cat}
              <span className="ml-1.5 text-[10px] opacity-60">
                ({ALL_APPS.filter((a) => a.category === cat).length})
              </span>
            </button>
          ))}
        </div>

        {/* Apps grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {displayed.map((app) => (
            <div
              key={app.slug}
              className="nasa-glass rounded-xl border border-white/8 p-4 flex items-start gap-3 hover:border-violet-500/30 transition-all group"
            >
              <span className="text-2xl shrink-0">{app.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-white/85 font-semibold text-xs group-hover:text-white transition-colors">{app.name}</p>
                <p className="text-white/30 text-[10px] leading-relaxed mt-0.5 line-clamp-2">{app.desc}</p>
                <div className="flex items-center gap-1 mt-1.5">
                  <Star className="size-2.5 text-yellow-400 fill-yellow-400" />
                  <span className="text-yellow-400/80 text-[10px] font-bold">{app.cost} ★/mês</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Show more */}
        {filtered.length > 8 && (
          <div className="text-center mb-10">
            <button
              onClick={() => setShowAll(!showAll)}
              className="text-white/40 hover:text-white/70 text-sm border border-white/10 hover:border-white/20 rounded-full px-5 py-2 transition-all"
            >
              {showAll
                ? "Mostrar menos"
                : `Ver mais ${filtered.length - 8} apps de ${activeCategory}`}
            </button>
          </div>
        )}

        {/* Banner: all plans unlocked */}
        <div className="nasa-glass rounded-2xl border border-violet-500/20 p-6 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
          <div className="text-4xl shrink-0">🔓</div>
          <div className="flex-1">
            <p className="text-white font-bold text-base">Nenhum app bloqueado por plano</p>
            <p className="text-white/40 text-sm mt-0.5">
              No Suit (grátis) você ainda pode comprar Stars avulsas e ativar qualquer integração.
              Upgrade de plano = mais Stars mensais, não mais acesso.
            </p>
          </div>
          <Button asChild className="bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl shrink-0">
            <Link href={isLoggedIn ? "/tracking" : "/sign-up"}>
              Começar agora <ArrowRight className="size-4 ml-1" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

// ─── Simulator Section ────────────────────────────────────────────────────────

const SIM_PLANS = [
  { id: "suit",         label: "Suit",          min: 0,     max: 0,    stars: 0,     price: 0,   color: "#10b981", bgClass: "bg-emerald-500/10", border: "border-emerald-500/30" },
  { id: "earth",        label: "Earth",         min: 1,     max: 1500, stars: 1000,  price: 197, color: "#3b82f6", bgClass: "bg-blue-500/10",    border: "border-blue-500/30" },
  { id: "explore",      label: "Explore",       min: 1501,  max: 4000, stars: 3000,  price: 397, color: "#7C3AED", bgClass: "bg-violet-500/10",  border: "border-violet-500/30" },
  { id: "constellation",label: "Constellation", min: 4001,  max: 20000,stars: 20000, price: 797, color: "#f59e0b", bgClass: "bg-yellow-500/10",  border: "border-yellow-500/30" },
];

// Top 8 apps mais populares para o simulador
const APP_COSTS: { name: string; cost: number; icon: string }[] = ALL_APPS
  .filter((a) => ["whatsapp-business","instagram-dm","openai","meta-ads","google-ads","stripe","zapier","shopify"].includes(a.slug))
  .sort((a, b) => ["whatsapp-business","instagram-dm","openai","meta-ads","google-ads","stripe","zapier","shopify"].indexOf(a.slug) -
                  ["whatsapp-business","instagram-dm","openai","meta-ads","google-ads","stripe","zapier","shopify"].indexOf(b.slug))
  .map((a) => ({ name: a.name, cost: a.cost, icon: a.icon }));

function SimulatorSection({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [userCount,  setUserCount]  = useState(5);
  const [appCount,   setAppCount]   = useState(3);
  const MAX_USERS = 50;
  const MAX_APPS  = APP_COSTS.length;

  // Total Stars needed = users * cost_per_user + sum of selected apps
  const userStars = userCount * STAR_PER_USER;
  const appStars  = APP_COSTS.slice(0, appCount).reduce((s, a) => s + a.cost, 0);
  const totalStars = userStars + appStars;

  const userPct = (userCount / MAX_USERS) * 100;
  const appPct  = (appCount  / MAX_APPS)  * 100;

  const recommended = SIM_PLANS.reduce((acc, p) => {
    if (totalStars >= p.min) return p;
    return acc;
  }, SIM_PLANS[0]);

  const starsBalance  = recommended.stars - totalStars;
  const rolloverPct   = recommended.id === "constellation" ? .30 : recommended.id === "explore" ? .25 : recommended.id === "earth" ? .20 : 0;
  const rolloverNext  = Math.max(0, Math.floor(starsBalance * rolloverPct));

  return (
    <section className="py-28 px-4 relative overflow-hidden border-t border-white/5">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-violet-600/5 blur-3xl rounded-full" />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2 bg-[#7C3AED]/15 border border-[#7C3AED]/30 rounded-full px-5 py-2">
            <BarChart2 className="size-3.5 text-violet-400" />
            <span className="text-violet-300 text-sm font-semibold tracking-wide">Simulador de Stars</span>
          </div>
        </div>

        <h2 className="text-4xl sm:text-5xl font-black text-white text-center mb-4 leading-tight">
          Descubra qual plano <span className="text-nasa">faz sentido para você</span>
        </h2>
        <p className="text-white/40 text-center text-lg mb-12 max-w-xl mx-auto">
          Ajuste usuários e integrações — veja o consumo de Stars em tempo real e qual plano cobre sua operação.
        </p>

        {/* Two sliders */}
        <div className="nasa-glass rounded-2xl border border-white/8 p-6 mb-6 space-y-6">
          {/* Users slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Users className="size-4 text-violet-400" />
                <p className="text-white/60 text-sm font-medium">Usuários ativos</p>
              </div>
              <div className="flex items-center gap-1.5 bg-violet-500/15 border border-violet-500/25 rounded-lg px-3 py-1">
                <span className="text-violet-300 font-black text-base">{userCount}</span>
                <span className="text-violet-400/50 text-xs">usuários × {STAR_PER_USER}★</span>
                <span className="text-yellow-400 font-bold text-sm ml-1">= {userStars}★</span>
              </div>
            </div>
            <input
              type="range" min={1} max={MAX_USERS} step={1}
              value={userCount}
              onChange={(e) => setUserCount(Number(e.target.value))}
              style={{ "--track-pct": `${userPct}%` } as React.CSSProperties}
              className="w-full h-1.5 appearance-none rounded-full cursor-pointer outline-none"
            />
            <div className="flex justify-between text-[10px] text-white/20 mt-1">
              <span>1 usuário</span><span>25 usuários</span><span>50 usuários</span>
            </div>
          </div>

          {/* Apps slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Plug2 className="size-4 text-blue-400" />
                <p className="text-white/60 text-sm font-medium">Integrações ativas</p>
              </div>
              <div className="flex items-center gap-1.5 bg-blue-500/15 border border-blue-500/25 rounded-lg px-3 py-1">
                <span className="text-blue-300 font-black text-base">{appCount}</span>
                <span className="text-blue-400/50 text-xs">apps</span>
                <span className="text-yellow-400 font-bold text-sm ml-1">= {appStars}★</span>
              </div>
            </div>
            <input
              type="range" min={0} max={MAX_APPS} step={1}
              value={appCount}
              onChange={(e) => setAppCount(Number(e.target.value))}
              style={{ "--track-pct": `${appPct}%` } as React.CSSProperties}
              className="w-full h-1.5 appearance-none rounded-full cursor-pointer outline-none"
            />
            <div className="flex justify-between text-[10px] text-white/20 mt-1">
              <span>0 apps</span><span>{Math.floor(MAX_APPS/2)} apps</span><span>{MAX_APPS} apps</span>
            </div>
          </div>

          {/* Total Stars needed */}
          <div className="flex items-center justify-between bg-white/4 rounded-xl px-4 py-3 border border-white/6">
            <div className="flex items-center gap-2 text-white/50 text-sm">
              <Star className="size-3.5 text-yellow-400" />
              Total de Stars necessárias
            </div>
            <div className="flex items-center gap-2">
              <span className="text-white/30 text-xs">{userStars}★ usuários + {appStars}★ apps =</span>
              <span className="text-yellow-400 font-black text-xl">{totalStars.toLocaleString("pt-BR")} ★</span>
            </div>
          </div>
        </div>

        {/* Result */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Recommended plan */}
          <div className={cn("rounded-2xl border p-6 transition-all", recommended.bgClass, recommended.border)}>
            <p className="text-white/40 text-xs font-medium uppercase tracking-wider mb-1">Plano recomendado</p>
            <div className="flex items-start justify-between mb-4">
              <p className="text-white font-black text-3xl">{recommended.label}</p>
              <p className="text-white font-black text-2xl">
                {recommended.price === 0
                  ? <span className="text-emerald-400">Grátis</span>
                  : <>R$ {recommended.price}<span className="text-white/30 text-sm font-normal">/mês</span></>}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: "Stars/mês",  value: recommended.stars === 0 ? "—" : recommended.stars >= 1000 ? `${recommended.stars/1000}K` : String(recommended.stars) },
                { label: "Saldo livre",value: starsBalance >= 0 ? `+${starsBalance.toLocaleString("pt-BR")}★` : `${starsBalance.toLocaleString("pt-BR")}★` },
                { label: "Rollover",   value: recommended.id === "constellation" ? "30%" : recommended.id === "explore" ? "25%" : recommended.id === "earth" ? "20%" : "0%" },
              ].map(({ label, value }) => (
                <div key={label} className="bg-white/5 rounded-xl p-3 text-center">
                  <div className={cn("font-black text-base", label === "Saldo livre" && starsBalance < 0 ? "text-red-400" : "text-white")}>{value}</div>
                  <div className="text-white/30 text-[10px] mt-0.5">{label}</div>
                </div>
              ))}
            </div>

            {starsBalance < 0 ? (
              <div className="bg-red-500/10 border border-red-500/25 rounded-xl p-3 text-center">
                <p className="text-red-400 text-[11px] font-semibold">
                  ⚠️ Faltam {Math.abs(starsBalance).toLocaleString("pt-BR")} ★ — considere o plano acima ou compre Stars avulsas
                </p>
              </div>
            ) : (
              <div className="bg-black/20 rounded-xl p-3 text-center">
                <p className="text-white/40 text-[11px]">
                  Rollover para o próximo mês:
                  <span className="text-emerald-400 font-bold ml-1">{rolloverNext.toLocaleString("pt-BR")} ★</span>
                </p>
              </div>
            )}
          </div>

          {/* Breakdown */}
          <div className="nasa-glass rounded-2xl border border-white/8 p-6 space-y-3">
            <p className="text-white/40 text-xs font-medium uppercase tracking-wider">
              Detalhamento do consumo
            </p>

            {/* Users */}
            <div className="flex items-center justify-between bg-violet-500/8 border border-violet-500/15 rounded-xl px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Users className="size-3.5 text-violet-400 shrink-0" />
                <span className="text-white/70 text-xs">{userCount} usuário{userCount !== 1 ? "s" : ""} × {STAR_PER_USER}★</span>
              </div>
              <span className="text-violet-300 font-bold text-xs">{userStars} ★/mês</span>
            </div>

            {/* Apps list */}
            {APP_COSTS.slice(0, appCount).map((app) => (
              <div key={app.name} className="flex items-center justify-between bg-white/4 border border-white/6 rounded-xl px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-base leading-none">{app.icon}</span>
                  <span className="text-white/60 text-xs">{app.name}</span>
                </div>
                <span className="text-yellow-400/70 text-xs font-semibold">{app.cost} ★/mês</span>
              </div>
            ))}

            {appCount === 0 && (
              <p className="text-white/20 text-xs text-center py-2">Nenhuma integração selecionada</p>
            )}

            <div className="border-t border-white/8 pt-3 flex items-center justify-between">
              <span className="text-white/40 text-xs font-semibold">Total</span>
              <span className="text-yellow-400 font-black text-base">{totalStars} ★/mês</span>
            </div>
          </div>
        </div>

        {/* All plans comparison */}
        <div className="nasa-glass rounded-2xl border border-white/8 p-6">
          <p className="text-white/30 text-xs font-medium uppercase tracking-widest mb-5 text-center">Qual plano cobre sua operação?</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {SIM_PLANS.map((p) => {
              const isRec     = p.id === recommended.id;
              const covers    = p.stars >= totalStars;
              const maxUsers  = p.stars > 0 ? Math.floor(p.stars / STAR_PER_USER) : 0;
              return (
                <div key={p.id} className={cn(
                  "rounded-xl p-4 text-center border transition-all",
                  isRec ? `${p.bgClass} ${p.border} scale-[1.03]` : covers ? "border-white/8 opacity-70" : "border-white/4 opacity-35"
                )}>
                  <p className="text-white font-bold text-sm mb-0.5">{p.label}</p>
                  <p className="text-white font-black text-base">
                    {p.price === 0 ? <span className="text-emerald-400">Grátis</span> : `R$ ${p.price}`}
                  </p>
                  <p className="text-white/30 text-[10px] mt-0.5">
                    {p.stars === 0 ? "sem stars" : `${p.stars >= 1000 ? p.stars/1000+"K" : p.stars} ★/mês`}
                  </p>
                  <p className="text-violet-400/70 text-[10px]">
                    {p.stars > 0 ? `~${maxUsers} usuários` : "0 usuários"}
                  </p>
                  {isRec && (
                    <div className="mt-1.5 text-[10px] font-bold" style={{ color: p.color }}>✓ Recomendado</div>
                  )}
                  {!covers && p.stars > 0 && !isRec && (
                    <div className="mt-1.5 text-[10px] text-white/20">Insuficiente</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="text-center mt-10">
          <Button asChild size="lg"
            className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-black px-10 py-6 text-base rounded-2xl nasa-glow-sm">
            <Link href={isLoggedIn ? "/tracking" : "/sign-up"}>
              Começar com o plano {recommended.label}
              <ArrowRight className="size-4 ml-2" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

// ─── Gamified Ranking Section ─────────────────────────────────────────────────

const FAKE_USERS = [
  { initials: "MF", name: "Mariana F.",     company: "Studio MF Design",        stars: 18_420, pts: 9_810, level: "Orbital",     plan: "Explore",       color: "#a855f7" },
  { initials: "RL", name: "Rafael Lima",    company: "Lima Consultoria",         stars: 15_880, pts: 8_340, level: "Satélite",    plan: "Constellation", color: "#f59e0b" },
  { initials: "AC", name: "Ana Carvalho",   company: "AC Imóveis",               stars: 12_300, pts: 7_120, level: "Astronauta",  plan: "Explore",       color: "#3b82f6" },
  { initials: "JM", name: "João Mendes",    company: "Mendes & Cia",             stars: 10_750, pts: 6_900, level: "Astronauta",  plan: "Explore",       color: "#10b981" },
  { initials: "PS", name: "Patrícia S.",    company: "PS Educação",              stars: 9_200,  pts: 5_600, level: "Explorador",  plan: "Earth",         color: "#f97316" },
  { initials: "GT", name: "Guilherme T.",   company: "GTech Soluções",           stars: 7_800,  pts: 4_920, level: "Explorador",  plan: "Earth",         color: "#ec4899" },
  { initials: "VN", name: "Vitória Nunes",  company: "VN Marketing",             stars: 6_100,  pts: 3_870, level: "Lunar",       plan: "Earth",         color: "#06b6d4" },
  { initials: "BS", name: "Bruno Silva",    company: "Silva Advocacia",          stars: 4_950,  pts: 3_200, level: "Lunar",       plan: "Suit",          color: "#84cc16" },
];

const LEVEL_COLORS: Record<string, string> = {
  "Orbital":     "text-violet-400 bg-violet-400/15 border-violet-400/30",
  "Satélite":    "text-yellow-400 bg-yellow-400/15 border-yellow-400/30",
  "Astronauta":  "text-blue-400   bg-blue-400/15   border-blue-400/30",
  "Explorador":  "text-orange-400 bg-orange-400/15 border-orange-400/30",
  "Lunar":       "text-cyan-400   bg-cyan-400/15   border-cyan-400/30",
  "Terra":       "text-emerald-400 bg-emerald-400/15 border-emerald-400/30",
};

const SPACE_LEVELS = [
  { level: 1,  name: "Terra",       pts: 0,      color: "#10b981", emoji: "🌍" },
  { level: 3,  name: "Lunar",       pts: 1_000,  color: "#06b6d4", emoji: "🌙" },
  { level: 5,  name: "Explorador",  pts: 3_000,  color: "#f97316", emoji: "🚀" },
  { level: 8,  name: "Astronauta",  pts: 6_000,  color: "#3b82f6", emoji: "👨‍🚀" },
  { level: 12, name: "Orbital",     pts: 10_000, color: "#a855f7", emoji: "🛸" },
  { level: 16, name: "Satélite",    pts: 18_000, color: "#f59e0b", emoji: "🛰️" },
  { level: 20, name: "Galáxia",     pts: 30_000, color: "#ff6b6b", emoji: "✨" },
];

const MISSIONS = [
  { icon: "🎯", title: "Primeiro Lead",     desc: "Cadastre seu primeiro lead",         pts: 50  },
  { icon: "📊", title: "Analista Espacial", desc: "Visualize 10 relatórios",            pts: 200 },
  { icon: "🤝", title: "Negociador Estelar",desc: "Feche 5 negócios no FORGE",          pts: 500 },
  { icon: "🤖", title: "Piloto de IA",      desc: "Use o ASTRO 20 vezes",               pts: 300 },
  { icon: "⚡", title: "Mestre das Flows",  desc: "Crie 3 automações ativas",           pts: 400 },
  { icon: "👥", title: "Comandante",        desc: "Adicione 5 membros à organização",   pts: 250 },
];

function GamifiedRankingSection({ isLoggedIn }: { isLoggedIn: boolean }) {
  const topUser  = FAKE_USERS[0];
  const maxPts   = FAKE_USERS[0].pts;

  return (
    <section className="py-28 px-4 relative overflow-hidden border-t border-white/5">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/4 w-[500px] h-[500px] bg-violet-600/4 blur-3xl rounded-full" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-yellow-400/3 blur-3xl rounded-full" />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Header */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2 bg-yellow-400/10 border border-yellow-400/25 rounded-full px-5 py-2">
            <Trophy className="size-3.5 text-yellow-400" />
            <span className="text-yellow-300 text-sm font-semibold tracking-wide">Gamificação NASA — Space Points</span>
          </div>
        </div>

        <h2 className="text-4xl sm:text-5xl font-black text-white text-center mb-4 leading-tight">
          NASA tem <span className="text-nasa">alma de jogo</span>
        </h2>
        <p className="text-white/40 text-center text-lg mb-16 max-w-xl mx-auto">
          Cada ação dentro da plataforma gera pontos. Evolua de nível, desbloqueie conquistas e
          dispute o ranking com outros usuários do NASA.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
          {/* Leaderboard */}
          <div className="nasa-glass rounded-2xl border border-white/8 overflow-hidden">
            {/* Leaderboard header */}
            <div className="bg-[#7C3AED]/15 border-b border-white/8 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="size-4 text-yellow-400" />
                <span className="text-white font-bold text-sm">Ranking Global — Julho 2026</span>
              </div>
              <div className="text-white/30 text-xs">Top 8</div>
            </div>

            {/* Top 3 podium */}
            <div className="flex items-end justify-center gap-3 px-5 pt-6 pb-4 border-b border-white/5">
              {/* 2nd */}
              <div className="text-center flex-1">
                <div className="w-12 h-12 rounded-full border-2 border-blue-400/50 flex items-center justify-center mx-auto mb-2 text-sm font-black"
                     style={{ background: `linear-gradient(135deg, ${FAKE_USERS[1].color}30, ${FAKE_USERS[1].color}10)`, color: FAKE_USERS[1].color }}>
                  {FAKE_USERS[1].initials}
                </div>
                <p className="text-white/70 text-[11px] font-semibold">{FAKE_USERS[1].name}</p>
                <p className="text-blue-400 font-black text-sm">#{2}</p>
                <div className="w-full bg-blue-500/20 rounded-t-lg h-14 mt-2 flex items-center justify-center">
                  <span className="text-blue-400 text-[10px] font-bold">{FAKE_USERS[1].pts.toLocaleString("pt-BR")} pts</span>
                </div>
              </div>
              {/* 1st */}
              <div className="text-center flex-1">
                <div className="relative">
                  <div className="text-xl text-center mb-1">👑</div>
                  <div className="w-14 h-14 rounded-full border-2 border-yellow-400/70 flex items-center justify-center mx-auto mb-2 text-sm font-black nasa-level-up"
                       style={{ background: `linear-gradient(135deg, ${FAKE_USERS[0].color}40, ${FAKE_USERS[0].color}15)`, color: FAKE_USERS[0].color }}>
                    {FAKE_USERS[0].initials}
                  </div>
                </div>
                <p className="text-white/90 text-[11px] font-bold">{FAKE_USERS[0].name}</p>
                <p className="text-yellow-400 font-black text-sm">🥇 #1</p>
                <div className="w-full bg-yellow-500/20 rounded-t-lg h-20 mt-2 flex items-center justify-center">
                  <span className="text-yellow-400 text-[10px] font-bold">{FAKE_USERS[0].pts.toLocaleString("pt-BR")} pts</span>
                </div>
              </div>
              {/* 3rd */}
              <div className="text-center flex-1">
                <div className="w-12 h-12 rounded-full border-2 border-orange-400/50 flex items-center justify-center mx-auto mb-2 text-sm font-black"
                     style={{ background: `linear-gradient(135deg, ${FAKE_USERS[2].color}30, ${FAKE_USERS[2].color}10)`, color: FAKE_USERS[2].color }}>
                  {FAKE_USERS[2].initials}
                </div>
                <p className="text-white/70 text-[11px] font-semibold">{FAKE_USERS[2].name}</p>
                <p className="text-orange-400 font-black text-sm">#{3}</p>
                <div className="w-full bg-orange-500/20 rounded-t-lg h-10 mt-2 flex items-center justify-center">
                  <span className="text-orange-400 text-[10px] font-bold">{FAKE_USERS[2].pts.toLocaleString("pt-BR")} pts</span>
                </div>
              </div>
            </div>

            {/* Remaining users */}
            <div className="divide-y divide-white/4">
              {FAKE_USERS.slice(3).map((user, i) => (
                <div key={user.name} className="rank-row nasa-rank-in flex items-center gap-3 px-5 py-3 hover:bg-white/3 transition-colors">
                  <span className="text-white/25 font-black text-sm w-5 text-center">{i + 4}</span>
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-black shrink-0"
                    style={{ background: `linear-gradient(135deg, ${user.color}30, ${user.color}10)`, color: user.color, border: `1.5px solid ${user.color}40` }}
                  >
                    {user.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white/80 font-semibold text-xs truncate">{user.name}</p>
                    <p className="text-white/25 text-[10px] truncate">{user.company}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-white/60 font-bold text-xs">{user.pts.toLocaleString("pt-BR")} pts</p>
                    <div className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full border mt-0.5 inline-block", LEVEL_COLORS[user.level] || "text-white/30 bg-white/5 border-white/10")}>
                      {user.level}
                    </div>
                  </div>
                  <div className="text-right shrink-0 w-12">
                    <p className="text-yellow-400/70 text-[10px] font-semibold">
                      {(user.stars / 1000).toFixed(1)}K ★
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Stars total banner */}
            <div className="bg-gradient-to-r from-yellow-400/8 to-violet-400/8 border-t border-white/5 px-5 py-3 flex items-center justify-between">
              <span className="text-white/30 text-xs">Total de Stars na plataforma</span>
              <span className="text-yellow-400 font-black text-sm">
                {FAKE_USERS.reduce((s, u) => s + u.stars, 0).toLocaleString("pt-BR")} ★
              </span>
            </div>
          </div>

          {/* Right: Levels + Missions */}
          <div className="flex flex-col gap-5">
            {/* Level progression */}
            <div className="nasa-glass rounded-2xl border border-white/8 p-5">
              <p className="text-white/40 text-xs font-medium uppercase tracking-wider mb-4 flex items-center gap-2">
                <Crown className="size-3.5 text-yellow-400" /> Níveis de Progressão
              </p>
              <div className="space-y-2.5">
                {SPACE_LEVELS.map((lvl, i) => {
                  const nextPts = SPACE_LEVELS[i + 1]?.pts ?? 50_000;
                  const barPct  = Math.min(100, (lvl.pts / 30_000) * 100);
                  return (
                    <div key={lvl.name} className="flex items-center gap-3">
                      <div className="text-xl shrink-0 w-7 text-center">{lvl.emoji}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-white/70 text-xs font-semibold">{lvl.name}</span>
                          <span className="text-white/25 text-[10px]">Nível {lvl.level}</span>
                        </div>
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${barPct}%`, background: lvl.color }}
                          />
                        </div>
                      </div>
                      <span className="text-white/25 text-[10px] shrink-0 w-14 text-right">
                        {lvl.pts >= 1000 ? `${lvl.pts / 1000}K` : lvl.pts} pts
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="text-white/20 text-[10px] text-center mt-4">
                20 níveis no total · De Terra 🌍 a Galáxia 10 ✨
              </p>
            </div>

            {/* Missions */}
            <div className="nasa-glass rounded-2xl border border-white/8 p-5">
              <p className="text-white/40 text-xs font-medium uppercase tracking-wider mb-4 flex items-center gap-2">
                <Target className="size-3.5 text-violet-400" /> Missões Disponíveis
              </p>
              <div className="grid grid-cols-1 gap-2">
                {MISSIONS.map((m) => (
                  <div key={m.title} className="flex items-center gap-3 bg-white/3 rounded-xl px-3 py-2.5 border border-white/5 hover:border-violet-500/20 transition-colors group">
                    <span className="text-lg shrink-0">{m.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white/80 text-xs font-semibold group-hover:text-white/90 transition-colors">{m.title}</p>
                      <p className="text-white/30 text-[10px] truncate">{m.desc}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Star className="size-2.5 text-yellow-400 fill-yellow-400" />
                      <span className="text-yellow-400 text-[10px] font-bold">+{m.pts}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Achievements preview */}
            <div className="nasa-glass rounded-2xl border border-white/8 p-5">
              <p className="text-white/40 text-xs font-medium uppercase tracking-wider mb-3 flex items-center gap-2">
                <Medal className="size-3.5 text-blue-400" /> Conquistas Desbloqueadas
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  { emoji: "🚀", label: "Decolar",       rarity: "comum" },
                  { emoji: "💬", label: "Comunicador",    rarity: "raro" },
                  { emoji: "🎯", label: "Sniper de Leads",rarity: "épico" },
                  { emoji: "🤖", label: "Piloto de IA",   rarity: "raro" },
                  { emoji: "👑", label: "Top 1",          rarity: "lendário" },
                  { emoji: "⚡", label: "Automatizador",  rarity: "épico" },
                  { emoji: "📊", label: "Analista",       rarity: "comum" },
                  { emoji: "🌟", label: "Estrela",        rarity: "lendário" },
                ].map(({ emoji, label, rarity }) => {
                  const cls =
                    rarity === "lendário" ? "border-yellow-400/40 bg-yellow-400/10 text-yellow-300" :
                    rarity === "épico"    ? "border-violet-400/40 bg-violet-400/10 text-violet-300" :
                    rarity === "raro"     ? "border-blue-400/40 bg-blue-400/10 text-blue-300" :
                                           "border-white/10 bg-white/5 text-white/50";
                  return (
                    <div key={label} className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold", cls)}>
                      <span>{emoji}</span> {label}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="text-center">
          <p className="text-white/30 text-sm mb-4">Comece a acumular pontos hoje mesmo</p>
          <Button asChild size="lg"
            className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-black px-10 py-6 text-base rounded-2xl nasa-glow-sm">
            <Link href={isLoggedIn ? "/tracking" : "/sign-up"}>
              Entrar para o jogo
              <Trophy className="size-4 ml-2" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

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
      <InsightsFeatureSection isLoggedIn={isLoggedIn} />
      <IntegrationsMarquee />
      <StarsInfoSection isLoggedIn={isLoggedIn} />
      <PlansPublicSection isLoggedIn={isLoggedIn} />
      <PatternsFeatureSection isLoggedIn={isLoggedIn} />
      <AppsShowcaseSection isLoggedIn={isLoggedIn} />
      <SimulatorSection isLoggedIn={isLoggedIn} />
      <GamifiedRankingSection isLoggedIn={isLoggedIn} />
      <FinalCTASection isLoggedIn={isLoggedIn} />
      <NewFooter />
    </>
  );
}
