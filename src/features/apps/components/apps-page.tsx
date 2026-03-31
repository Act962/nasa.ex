"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  ExternalLink,
  Users,
  Package,
  Link2,
  Clock,
  Rocket,
  Flame,
} from "lucide-react";
import { StarsWidget } from "@/features/stars";

// ─── App Status ───────────────────────────────────────────────────────────────

type AppStatus = "installed" | "development" | "available";

// ─── Custom SVG Icons ─────────────────────────────────────────────────────────
// Extracted / reproduced from the NASA Apps reference image

const CommentsIcon = () => (
  <svg
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-full h-full"
  >
    <rect width="48" height="48" rx="12" fill="#7C3AED" />
    <path
      d="M10 14C10 11.8 11.8 10 14 10H34C36.2 10 38 11.8 38 14V28C38 30.2 36.2 32 34 32H27L20 38V32H14C11.8 32 10 30.2 10 28V14Z"
      fill="white"
      fillOpacity="0.15"
      stroke="white"
      strokeWidth="1.5"
    />
    <text
      x="24"
      y="26"
      textAnchor="middle"
      fill="white"
      fontSize="12"
      fontWeight="700"
      fontFamily="monospace"
    >
      @@
    </text>
  </svg>
);

const NerpIcon = () => (
  <svg
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-full h-full"
  >
    <rect
      width="48"
      height="48"
      rx="12"
      fill="#0F0F0F"
      stroke="#7C3AED"
      strokeWidth="1.5"
    />
    <text
      x="24"
      y="31"
      textAnchor="middle"
      fill="white"
      fontSize="22"
      fontWeight="900"
      fontFamily="Arial, sans-serif"
    >
      N
    </text>
    <rect
      x="9"
      y="9"
      width="30"
      height="22"
      rx="3"
      fill="none"
      stroke="white"
      strokeWidth="1.2"
      strokeOpacity="0.3"
    />
    <line
      x1="13"
      y1="35"
      x2="35"
      y2="35"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
      strokeOpacity="0.4"
    />
    <line
      x1="19"
      y1="38"
      x2="29"
      y2="38"
      stroke="white"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeOpacity="0.3"
    />
  </svg>
);

const CosmicIcon = () => (
  <svg
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-full h-full"
  >
    <rect width="48" height="48" rx="12" fill="#7C3AED" />
    <circle cx="24" cy="24" r="8" stroke="white" strokeWidth="2" />
    <ellipse
      cx="24"
      cy="24"
      rx="18"
      ry="7"
      stroke="white"
      strokeWidth="1.5"
      strokeOpacity="0.6"
    />
    <circle cx="24" cy="24" r="3" fill="white" />
    <circle cx="39" cy="20" r="2" fill="white" fillOpacity="0.7" />
  </svg>
);

const NasaChatIcon = () => (
  <svg
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-full h-full"
  >
    <rect width="48" height="48" rx="12" fill="#7C3AED" />
    <path
      d="M9 13C9 10.8 10.8 9 13 9H35C37.2 9 39 10.8 39 13V29C39 31.2 37.2 33 35 33H26L19 39V33H13C10.8 33 9 31.2 9 29V13Z"
      fill="white"
      fillOpacity="0.15"
      stroke="white"
      strokeWidth="1.5"
    />
    <text
      x="24"
      y="26"
      textAnchor="middle"
      fill="white"
      fontSize="14"
      fontWeight="900"
      fontFamily="Arial, sans-serif"
    >
      N
    </text>
  </svg>
);

const SpaceTimeIcon = () => (
  <svg
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-full h-full"
  >
    <rect width="48" height="48" rx="12" fill="#7C3AED" />
    <rect
      x="10"
      y="14"
      width="28"
      height="24"
      rx="3"
      stroke="white"
      strokeWidth="1.5"
      fill="white"
      fillOpacity="0.1"
    />
    <line
      x1="10"
      y1="21"
      x2="38"
      y2="21"
      stroke="white"
      strokeWidth="1.5"
      strokeOpacity="0.6"
    />
    <line
      x1="17"
      y1="10"
      x2="17"
      y2="17"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <line
      x1="31"
      y1="10"
      x2="31"
      y2="17"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <text
      x="24"
      y="34"
      textAnchor="middle"
      fill="white"
      fontSize="11"
      fontWeight="700"
      fontFamily="Arial, sans-serif"
    >
      A
    </text>
  </svg>
);

const ForgeIcon = () => (
  <svg
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-full h-full"
  >
    <rect width="48" height="48" rx="12" fill="#7C3AED" />
    <path
      d="M24 8C24 8 30 16 30 22C30 25.3 27.3 28 24 28C20.7 28 18 25.3 18 22C18 16 24 8 24 8Z"
      fill="white"
      fillOpacity="0.9"
    />
    <path
      d="M20 22C20 22 21 18 24 16C24 16 22 21 25 24C25 24 23 24 22 23"
      fill="#7C3AED"
    />
    <path d="M16 30H32L30 40H18L16 30Z" fill="white" fillOpacity="0.7" />
    <line
      x1="20"
      y1="34"
      x2="28"
      y2="34"
      stroke="#7C3AED"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <line
      x1="21"
      y1="37"
      x2="27"
      y2="37"
      stroke="#7C3AED"
      strokeWidth="1.2"
      strokeLinecap="round"
    />
  </svg>
);

const LinnkerIcon = () => (
  <svg
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-full h-full"
  >
    <rect width="48" height="48" rx="12" fill="#7C3AED" />
    <circle
      cx="15"
      cy="24"
      r="6"
      stroke="white"
      strokeWidth="2"
      fill="white"
      fillOpacity="0.1"
    />
    <circle
      cx="33"
      cy="24"
      r="6"
      stroke="white"
      strokeWidth="2"
      fill="white"
      fillOpacity="0.1"
    />
    <rect x="15" y="20" width="18" height="8" fill="#7C3AED" />
    <line
      x1="18"
      y1="24"
      x2="30"
      y2="24"
      stroke="white"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
    <circle cx="15" cy="24" r="3" fill="white" />
    <circle cx="33" cy="24" r="3" fill="white" />
  </svg>
);

const BoostIcon = () => (
  <svg
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-full h-full"
  >
    <rect
      width="48"
      height="48"
      rx="12"
      fill="#0F0F0F"
      stroke="#7C3AED"
      strokeWidth="1.5"
    />
    <path d="M24 10L32 24H24V38L16 24H24V10Z" fill="white" />
    <path
      d="M24 10L32 24H24V38L16 24H24V10Z"
      fill="none"
      stroke="white"
      strokeWidth="0.5"
    />
  </svg>
);

const StarsIcon = () => (
  <svg
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-full h-full"
  >
    <rect width="48" height="48" rx="12" fill="#7C3AED" />
    <path
      d="M24 10L26.5 19H36L28.5 25L31 34L24 28L17 34L19.5 25L12 19H21.5L24 10Z"
      fill="white"
      stroke="white"
      strokeWidth="0.5"
      strokeLinejoin="round"
    />
    <circle cx="24" cy="24" r="3" fill="#7C3AED" />
  </svg>
);

const DemandIcon = () => (
  <svg
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-full h-full"
  >
    <rect width="48" height="48" rx="12" fill="#7C3AED" />
    <rect
      x="10"
      y="10"
      width="12"
      height="12"
      rx="2"
      fill="white"
      fillOpacity="0.9"
    />
    <rect
      x="26"
      y="10"
      width="12"
      height="12"
      rx="2"
      fill="white"
      fillOpacity="0.5"
    />
    <rect
      x="10"
      y="26"
      width="12"
      height="12"
      rx="2"
      fill="white"
      fillOpacity="0.5"
    />
    <rect
      x="26"
      y="26"
      width="12"
      height="12"
      rx="2"
      fill="white"
      fillOpacity="0.9"
    />
    <text
      x="16"
      y="20"
      textAnchor="middle"
      fill="#7C3AED"
      fontSize="8"
      fontWeight="900"
      fontFamily="Arial"
    >
      M
    </text>
  </svg>
);

const AstroIcon = () => (
  <svg
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-full h-full"
  >
    <rect width="48" height="48" rx="12" fill="#7C3AED" />
    <path
      d="M24 8L27 20L38 17L29 24L38 31L27 28L24 40L21 28L10 31L19 24L10 17L21 20L24 8Z"
      fill="white"
      fillOpacity="0.9"
    />
    <circle cx="24" cy="24" r="4" fill="#7C3AED" />
    <circle cx="24" cy="24" r="2" fill="white" />
  </svg>
);

const TaskIcon = () => (
  <svg
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-full h-full"
  >
    <rect
      width="48"
      height="48"
      rx="12"
      fill="#0F0F0F"
      stroke="#7C3AED"
      strokeWidth="1.5"
    />
    <path d="M16 12L36 24L16 36V12Z" fill="white" />
    <line
      x1="10"
      y1="24"
      x2="16"
      y2="24"
      stroke="white"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeOpacity="0.5"
    />
  </svg>
);

const NBoxIcon = () => (
  <svg
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-full h-full"
  >
    <rect width="48" height="48" rx="12" fill="#7C3AED" />
    {/* Box outline */}
    <rect
      x="10"
      y="18"
      width="28"
      height="20"
      rx="2"
      fill="white"
      fillOpacity="0.15"
      stroke="white"
      strokeWidth="1.5"
    />
    {/* Box lid top flaps */}
    <path
      d="M10 18L17 10H31L38 18"
      stroke="white"
      strokeWidth="1.5"
      strokeLinejoin="round"
      fill="white"
      fillOpacity="0.1"
    />
    {/* Center line on lid */}
    <line
      x1="24"
      y1="10"
      x2="24"
      y2="18"
      stroke="white"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    {/* N letter inside */}
    <text
      x="24"
      y="34"
      textAnchor="middle"
      fill="white"
      fontSize="12"
      fontWeight="900"
      fontFamily="Arial, sans-serif"
    >
      N
    </text>
  </svg>
);

const TrackingIcon = () => (
  <svg
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-full h-full"
  >
    <rect width="48" height="48" rx="12" fill="#7C3AED" />
    {/* QR-code style tracking icon */}
    <rect
      x="10"
      y="10"
      width="12"
      height="12"
      rx="1"
      fill="white"
      fillOpacity="0.9"
    />
    <rect x="12" y="12" width="8" height="8" rx="0.5" fill="#7C3AED" />
    <rect x="14" y="14" width="4" height="4" fill="white" />
    <rect
      x="26"
      y="10"
      width="12"
      height="12"
      rx="1"
      fill="white"
      fillOpacity="0.9"
    />
    <rect x="28" y="12" width="8" height="8" rx="0.5" fill="#7C3AED" />
    <rect x="30" y="14" width="4" height="4" fill="white" />
    <rect
      x="10"
      y="26"
      width="12"
      height="12"
      rx="1"
      fill="white"
      fillOpacity="0.9"
    />
    <rect x="12" y="28" width="8" height="8" rx="0.5" fill="#7C3AED" />
    <rect x="14" y="30" width="4" height="4" fill="white" />
    {/* Individual dots bottom-right */}
    <rect
      x="26"
      y="26"
      width="4"
      height="4"
      rx="0.5"
      fill="white"
      fillOpacity="0.8"
    />
    <rect
      x="32"
      y="26"
      width="4"
      height="4"
      rx="0.5"
      fill="white"
      fillOpacity="0.8"
    />
    <rect
      x="26"
      y="32"
      width="4"
      height="4"
      rx="0.5"
      fill="white"
      fillOpacity="0.8"
    />
    <rect
      x="32"
      y="32"
      width="4"
      height="4"
      rx="0.5"
      fill="white"
      fillOpacity="0.8"
    />
  </svg>
);

const NasaPlannerIcon = () => (
  <svg
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-full h-full"
  >
    <defs>
      <linearGradient
        id="npGrad"
        x1="0"
        y1="0"
        x2="48"
        y2="48"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0%" stopColor="#7C3AED" />
        <stop offset="100%" stopColor="#EC4899" />
      </linearGradient>
    </defs>
    <rect width="48" height="48" rx="12" fill="url(#npGrad)" />
    {/* Sparkle / magic wand */}
    <path
      d="M10 38L22 18"
      stroke="white"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
    <circle cx="22" cy="18" r="3" fill="white" />
    {/* Small stars */}
    <path
      d="M30 10L31.2 13.8L35 15L31.2 16.2L30 20L28.8 16.2L25 15L28.8 13.8L30 10Z"
      fill="white"
      fillOpacity="0.9"
    />
    <path
      d="M38 22L38.8 24.4L41 25L38.8 25.6L38 28L37.2 25.6L35 25L37.2 24.4L38 22Z"
      fill="white"
      fillOpacity="0.7"
    />
    {/* Image frame */}
    <rect
      x="22"
      y="24"
      width="18"
      height="14"
      rx="2"
      fill="white"
      fillOpacity="0.2"
      stroke="white"
      strokeWidth="1.2"
    />
    <circle cx="26" cy="29" r="2" fill="white" fillOpacity="0.8" />
    <path
      d="M22 34L27 30L31 33L34 30L40 34"
      stroke="white"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// ─── App Definitions ──────────────────────────────────────────────────────────

interface AppDef {
  id: string;
  name: string;
  byline: string;
  status: AppStatus;
  icon: React.FC;
  shortDesc: string;
  fullDesc: string;
  category: string;
  integration: string;
  action: "external" | "internal" | "modal";
  href?: string;
  activeUsers?: number | null;
  theme: "purple" | "dark";
}

const APPS: AppDef[] = [
  {
    id: "comments",
    name: "COMMENTS",
    byline: "by NASA®",
    status: "installed",
    icon: CommentsIcon,
    shortDesc: "Automatize respostas nos comentários do Instagram",
    fullDesc:
      "Automatize respostas nos comentários do Instagram e leve o cliente direto para o atendimento certo. Simples, rápido e sem complicação. Mais barato, mais inteligente e integrado ao resto da operação.",
    category: "Engajamento",
    integration: "Instagram",
    action: "external",
    href: "https://comments.nasaex.com/",
    activeUsers: null,
    theme: "purple",
  },
  {
    id: "nerp",
    name: "NERP",
    byline: "by NASA®",
    status: "installed",
    icon: NerpIcon,
    shortDesc: "ERP inteligente integrado ao comercial e atendimento",
    fullDesc:
      "Controle financeiro, loja online, sistema de frente de caixa e dados do negócio no mesmo lugar. Tudo integrado ao comercial e ao atendimento.",
    category: "Gestão",
    integration: "ERP",
    action: "external",
    href: "https://www.nasaerp.com/",
    activeUsers: null,
    theme: "dark",
  },
  {
    id: "cosmic",
    name: "COSMIC",
    byline: "by NASA®",
    status: "development",
    icon: CosmicIcon,
    shortDesc: "Formulários inteligentes que viram dados estratégicos no CRM",
    fullDesc:
      "Sistema de formulários inteligentes. Cada resposta do cliente vira informação estratégica. O sistema entende o interesse e organiza automaticamente no CRM.",
    category: "CRM",
    integration: "—",
    action: "modal",
    theme: "purple",
  },
  {
    id: "nasachat",
    name: "NASACHAT",
    byline: "by NASA®",
    status: "installed",
    icon: NasaChatIcon,
    shortDesc: "WhatsApp organizado com histórico, CRM e IA integrados",
    fullDesc:
      "O WhatsApp organizado do jeito que deveria ser. Sistema de conversas interno offline. Atenda sem perder histórico, contexto ou oportunidade. Totalmente integrado ao CRM e ao Astro IA.",
    category: "Atendimento",
    integration: "WhatsApp",
    action: "internal",
    href: "/tracking-chat",
    activeUsers: null,
    theme: "purple",
  },
  {
    id: "spacetime",
    name: "SPACETIME",
    byline: "by NASA®",
    status: "installed",
    icon: SpaceTimeIcon,
    shortDesc: "Múltiplas agendas conectadas ao CRM e equipe",
    fullDesc:
      "Quem controla o tempo, controla a venda. Múltiplas agendas conectadas ao atendimento, CRM e equipe. Nada de cliente esquecido ou horário perdido.",
    category: "Agenda",
    integration: "—",
    action: "internal",
    href: "/agendas",
    activeUsers: null,
    theme: "purple",
  },
  {
    id: "forge",
    name: "FORGE",
    byline: "by NASA®",
    status: "installed",
    icon: ForgeIcon,
    shortDesc: "Propostas comerciais e contratos com assinatura digital",
    fullDesc:
      "Crie propostas profissionais, envie contratos digitais e feche negócios mais rápido. Tudo integrado ao CRM.",
    category: "Vendas",
    integration: "Multi-gateway",
    action: "internal",
    href: "/forge",
    activeUsers: null,
    theme: "purple",
  },
  {
    id: "linnker",
    name: "LINNKER",
    byline: "by NASA®",
    status: "development",
    icon: LinnkerIcon,
    shortDesc: "Links personalizados que direcionam, organizam e viram dados",
    fullDesc:
      "Links personalizados que direcionam, organizam e viram dados. Cada clique vira dado. Cada acesso vira oportunidade.",
    category: "Marketing",
    integration: "—",
    action: "modal",
    theme: "purple",
  },
  {
    id: "boost",
    name: "BOOST",
    byline: "by NASA®",
    status: "development",
    icon: BoostIcon,
    shortDesc: "Gamificação de vendas com ranking e metas para o time",
    fullDesc:
      "Acompanhe resultados, crie ranking e motive o time. Venda vira jogo. O jogo com regra gera resultado.",
    category: "Vendas",
    integration: "—",
    action: "modal",
    theme: "dark",
  },
  {
    id: "stars",
    name: "STARS",
    byline: "by NASA®",
    status: "development",
    icon: StarsIcon,
    shortDesc: "Programa de pontos e fidelidade direto no atendimento",
    fullDesc:
      "Cliente lembrado, cliente que volta. Crie programas de pontos direto no atendimento. O cliente acompanha tudo em um painel próprio.",
    category: "Fidelização",
    integration: "—",
    action: "modal",
    theme: "purple",
  },
  {
    id: "demand",
    name: "DEMAND",
    byline: "by NASA®",
    status: "development",
    icon: DemandIcon,
    shortDesc:
      "Painel de controle com tarefas, equipe, clientes e treinamentos",
    fullDesc:
      "O painel de controle da sua operação. Organize tarefas, equipe, clientes e treinamentos em um único lugar. Kanban, listas, automações e mensagens integradas.",
    category: "Gestão",
    integration: "—",
    action: "modal",
    theme: "purple",
  },
  {
    id: "astro",
    name: "ASTRO",
    byline: "by NASA®",
    status: "development",
    icon: AstroIcon,
    shortDesc: "IA treinada para informar, preparar e quebrar objeções",
    fullDesc:
      "IA treinada para informar, preparar, quebrar objeções e sair de cena. Sem invadir a venda do humano. Sem parecer robô.",
    category: "Inteligência Artificial",
    integration: "—",
    action: "modal",
    theme: "purple",
  },
  {
    id: "task",
    name: "TASK",
    byline: "by NASA®",
    status: "development",
    icon: TaskIcon,
    shortDesc: "Centralize pedidos, tarefas e chamados com rastreamento",
    fullDesc:
      "Centralize pedidos, tarefas e chamados com rastreamento. Cliente acompanha. Equipe executa.",
    category: "Produtividade",
    integration: "—",
    action: "modal",
    theme: "dark",
  },
  {
    id: "nbox",
    name: "N-BOX",
    byline: "by NASA®",
    status: "installed",
    icon: NBoxIcon,
    shortDesc: "Gestão de documentos, arquivos e links da organização",
    fullDesc:
      "Centralize todos os arquivos, documentos, imagens e links da sua organização em um único lugar. Organize por pastas, busque rapidamente e monitore o uso de armazenamento por plano.",
    category: "Documentos",
    integration: "S3",
    action: "internal",
    href: "/nbox",
    activeUsers: null,
    theme: "purple",
  },
  {
    id: "nasa-planner",
    name: "NASA PLANNER",
    byline: "by NASA®",
    status: "installed",
    icon: NasaPlannerIcon,
    shortDesc:
      "Planeje, crie e execute estratégias de marketing com IA e Mapas Mentais",
    fullDesc:
      "Planejamento estratégico de marketing com IA e Mapas Mentais. Crie múltiplos planners com identidade de marca, Voz & Tom, SWOT e IA integrados. Gere posts para redes sociais, organize ações em mapas mentais (Gantt, diagrama, checklist), acompanhe no calendário e compartilhe com clientes via link. Conectado a todos os apps do NASA.",
    category: "Marketing",
    integration: "Demand · Tracking · N-Box · Spacetime · Nasachat · Insights",
    action: "internal",
    href: "/nasa-planner",
    activeUsers: null,
    theme: "purple",
  },
  {
    id: "tracking",
    name: "TRACKING",
    byline: "by NASA®",
    status: "installed",
    icon: TrackingIcon,
    shortDesc: "Rota completa do cliente do primeiro contato à venda",
    fullDesc:
      "Organize atendimentos, vendas, projetos e setores em múltiplos CRMs conectados. Rastreie de onde o cliente veio, o que quer e quando agir.",
    category: "CRM",
    integration: "Multi-CRM",
    action: "internal",
    href: "/tracking",
    activeUsers: null,
    theme: "purple",
  },
];

// ─── Status Helpers ───────────────────────────────────────────────────────────

type Filter = "all" | "installed" | "development" | "available";

function StatusBadge({ status }: { status: AppStatus }) {
  if (status === "installed")
    return (
      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 text-[11px] gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
        Instalado
      </Badge>
    );
  if (status === "development")
    return (
      <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border-amber-200 dark:border-amber-800 text-[11px] gap-1">
        🔧 Em construção
      </Badge>
    );
  return (
    <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 border-blue-200 dark:border-blue-800 text-[11px] gap-1">
      + Disponível
    </Badge>
  );
}

// ─── App Card ─────────────────────────────────────────────────────────────────

function AppCard({
  app,
  onAction,
}: {
  app: AppDef;
  onAction: (app: AppDef) => void;
}) {
  const Icon = app.icon;

  return (
    <div
      className={cn(
        "group relative flex flex-col rounded-2xl border-2 bg-card transition-all duration-200 overflow-hidden cursor-pointer",
        "hover:border-[#7C3AED] hover:shadow-lg hover:shadow-[#7C3AED]/10 hover:-translate-y-0.5",
        app.status === "installed" ? "border-border" : "border-border",
      )}
      onClick={() => onAction(app)}
    >
      {/* Purple accent top bar on hover */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-linear-to-r from-[#7C3AED] to-[#a855f7] opacity-0 group-hover:opacity-100 transition-opacity" />

      {/* Header */}
      <div className="flex items-start gap-3 p-5 pb-3">
        <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 shadow-sm">
          <Icon />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-black text-sm tracking-wide leading-tight">
                {app.name}
              </h3>
              <p className="text-[10px] text-muted-foreground">{app.byline}</p>
            </div>
            <StatusBadge status={app.status} />
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="px-5 pb-4 flex-1">
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
          {app.shortDesc}
        </p>
      </div>

      {/* Metadata */}
      <div className="px-5 pb-4 grid grid-cols-2 gap-2">
        {app.activeUsers !== undefined && (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Users className="size-3 shrink-0" />
            <span>{app.activeUsers ?? "—"}</span>
          </div>
        )}
        {app.status === "development" && (
          <div className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
            <Clock className="size-3 shrink-0" />
            <span>Em breve</span>
          </div>
        )}
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Package className="size-3 shrink-0" />
          <span>{app.category}</span>
        </div>
        {app.integration && app.integration !== "—" && (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Link2 className="size-3 shrink-0" />
            <span>{app.integration}</span>
          </div>
        )}
      </div>

      {/* Action Button */}
      <div className="px-5 pb-5">
        {app.status === "installed" ? (
          <Button
            size="sm"
            className="w-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white gap-1.5 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              onAction(app);
            }}
          >
            {app.action === "external" && <ExternalLink className="size-3.5" />}
            Abrir App
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="w-full gap-1.5 text-xs text-muted-foreground cursor-default"
            disabled
          >
            <Clock className="size-3.5" />
            Em Breve
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Coming Soon Modal ────────────────────────────────────────────────────────

function ComingSoonModal({
  app,
  open,
  onClose,
}: {
  app: AppDef | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!app) return null;
  const Icon = app.icon;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md text-center">
        <DialogHeader>
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-lg">
              <Icon />
            </div>
          </div>
          <DialogTitle className="text-xl font-black tracking-wide flex items-center justify-center gap-2">
            <Rocket className="size-5 text-[#7C3AED]" />
            {app.name} está chegando!
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground leading-relaxed mt-2 mb-6">
          {app.fullDesc}
        </p>
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-medium">
            <Package className="size-3" /> {app.category}
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#7C3AED]/10 text-[#7C3AED] text-xs font-medium">
            🔧 Em construção
          </div>
        </div>
        <Button
          onClick={onClose}
          className="w-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white"
        >
          Entendido
        </Button>
      </DialogContent>
    </Dialog>
  );
}

// ─── Filter Bar ───────────────────────────────────────────────────────────────

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "installed", label: "Instalados" },
  { value: "development", label: "Em Construção" },
  { value: "available", label: "Disponíveis" },
];

// ─── Main Page ────────────────────────────────────────────────────────────────

export function AppsPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [modalApp, setModalApp] = useState<AppDef | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const filteredApps = APPS.filter((app) => {
    if (filter === "all") return true;
    if (filter === "installed") return app.status === "installed";
    if (filter === "development") return app.status === "development";
    if (filter === "available") return app.status === "available";
    return true;
  });

  const handleAction = (app: AppDef) => {
    if (app.action === "external" && app.href) {
      window.open(app.href, "_blank", "noopener,noreferrer");
    } else if (app.action === "internal" && app.href) {
      router.push(app.href);
    } else {
      setModalApp(app);
      setModalOpen(true);
    }
  };

  const installedCount = APPS.filter((a) => a.status === "installed").length;
  const devCount = APPS.filter((a) => a.status === "development").length;

  return (
    <div className="min-h-full bg-background">
      {/* Hero Header */}
      <div className="relative overflow-hidden border-b bg-linear-to-br from-[#7C3AED]/5 via-background to-background">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-[#7C3AED]/5 blur-3xl" />
          <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full bg-[#7C3AED]/3 blur-2xl" />
        </div>

        <div className="relative px-6 py-10 max-w-5xl mx-auto">
          <div className="flex items-center justify-end mb-4">
            <StarsWidget />
          </div>
          <div className="flex items-center gap-2 mb-1">
            <div className="flex gap-1">
              {["#7C3AED", "#a855f7", "#c084fc"].map((c, i) => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <span className="text-xs text-muted-foreground font-medium tracking-widest uppercase">
              Ecossistema NASA
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black tracking-tight mt-2">
            Universo de Soluções{" "}
            <span className="text-[#7C3AED]">N.A.S.A®</span>
          </h1>
          <p className="text-muted-foreground mt-2 text-sm sm:text-base">
            Todas as ferramentas do ecossistema NASA em um só lugar
          </p>

          {/* Stats */}
          <div className="flex gap-4 mt-6">
            <div className="flex items-center gap-1.5 text-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="font-semibold">{installedCount}</span>
              <span className="text-muted-foreground">instalados</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="font-semibold">{devCount}</span>
              <span className="text-muted-foreground">em desenvolvimento</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <span className="w-2 h-2 rounded-full bg-[#7C3AED]" />
              <span className="font-semibold">{APPS.length}</span>
              <span className="text-muted-foreground">total</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="px-6 py-4 max-w-5xl mx-auto">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const count =
              f.value === "all"
                ? APPS.length
                : f.value === "installed"
                  ? installedCount
                  : f.value === "development"
                    ? devCount
                    : 0;
            return (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all border",
                  filter === f.value
                    ? "bg-[#7C3AED] text-white border-[#7C3AED] shadow-sm"
                    : "bg-card text-muted-foreground border-border hover:border-[#7C3AED]/50 hover:text-foreground",
                )}
              >
                {f.label}
                <span
                  className={cn(
                    "text-[11px] px-1.5 py-0.5 rounded-full",
                    filter === f.value
                      ? "bg-white/20 text-white"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid */}
      <div className="px-6 pb-10 max-w-5xl mx-auto">
        {filteredApps.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
              <Package className="size-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-sm">
              Nenhum app encontrado nesta categoria.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredApps.map((app) => (
              <AppCard key={app.id} app={app} onAction={handleAction} />
            ))}
          </div>
        )}
      </div>

      {/* Coming Soon Modal */}
      <ComingSoonModal
        app={modalApp}
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setModalApp(null);
        }}
      />
    </div>
  );
}
