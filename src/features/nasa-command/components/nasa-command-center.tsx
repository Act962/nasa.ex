"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  Plus,
  ChevronDown,
  ChevronUp,
  Image,
  LayoutGrid,
  Link2,
  X,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  Bot,
  Sparkles,
  Zap,
  Search,
  FileText,
  Calendar,
  BarChart3,
  MessageSquare,
  Package,
  Users,
  Lightbulb,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { toast } from "sonner";
import { StarsWidget } from "@/features/stars";
import {
  variableCategories,
  allApps,
  nasaApps,
  integrationApps,
} from "../data/variables";
import type { VariableCategory, AppItem } from "../data/variables";

// ─── Types ───────────────────────────────────────────────────────────────────

type DropdownType = "variable" | "app" | "plus" | null;

interface RecentApp {
  id: string;
  name: string;
  gradient: string;
  url: string;
  icon: React.ReactNode;
}

interface ExampleCategory {
  emoji: string;
  label: string;
  examples: string[];
}

interface ResultData {
  title: string;
  description: string;
  url: string;
  appName: string;
}

// ─── Data ────────────────────────────────────────────────────────────────────
// variableCategories, nasaApps, integrationApps, allApps são importados de ../data/variables

const recentApps: RecentApp[] = [
  {
    id: "nasachat",
    name: "NASACHAT",
    gradient: "from-violet-600 to-purple-800",
    url: "/tracking-chat",
    icon: <MessageSquare className="w-5 h-5 text-white" />,
  },
  {
    id: "linnker",
    name: "LINNKER",
    gradient: "from-cyan-500 to-blue-700",
    url: "/integrations",
    icon: <Link2 className="w-5 h-5 text-white" />,
  },
  {
    id: "spacetime",
    name: "SPACETIME",
    gradient: "from-indigo-500 to-violet-700",
    url: "/agendas",
    icon: <Calendar className="w-5 h-5 text-white" />,
  },
  {
    id: "forge",
    name: "FORGE",
    gradient: "from-orange-500 to-red-700",
    url: "/forge",
    icon: <Zap className="w-5 h-5 text-white" />,
  },
  {
    id: "nasa-post",
    name: "NASA POST",
    gradient: "from-pink-500 to-rose-700",
    url: "/nasa-post",
    icon: <Sparkles className="w-5 h-5 text-white" />,
  },
];

const exampleCategories: ExampleCategory[] = [
  // ── Criar Tracking ─────────────────────────────────────────────────────────
  {
    emoji: "📊",
    label: "Criar Tracking (Pipeline)",
    examples: [
      'Crie um tracking chamado "Atendimento X" no #tracking',
      'Crie um novo tracking chamado "Clientes 2026" no #tracking',
      'Crie um tracking chamado "Suporte Técnico" no #tracking',
      '/Add_tracking "Vendas Enterprise" no #tracking',
      'Crie um tracking chamado "Parcerias /YYYY" no #tracking',
    ],
  },
  // ── Criar Agenda & Agendamentos ────────────────────────────────────────────
  {
    emoji: "📅",
    label: "Criar Agenda & Agendamentos",
    examples: [
      'Agende uma reunião no #agenda com /Francisco_Lima para /amanhã às 14h',
      'Agende uma reunião no #agenda com /Maria_Costa para /hoje às 10h sobre /PRODUTX',
      'Marque um follow-up com /João_Silva para /semana_que_vem às 09h e me manda /link_agendamento_criado',
      'Agende reunião no #agenda com /Contato /Astro para /DD.MM.AAAA às /hh:mm:ss',
      'Quais são os compromissos de /hoje no #agenda?',
    ],
  },
  // ── Criar & Gerenciar Leads ────────────────────────────────────────────────
  {
    emoji: "🎯",
    label: "Criar & Gerenciar Leads",
    examples: [
      'Crie um novo lead chamado "João Pereira" no #tracking',
      '/novo_lead /Francisco_Lima no #tracking com /tag VIP /Temperatura Quente /Responsável /Astro',
      '/novo_lead "Empresa ABC" no #tracking com /E-mail contato@abc.com /Responsável /Weydson',
      '/mover_lead /Maria_Costa para /status_tracking "Proposta Enviada" no #tracking',
      '/mover_lead /João_Silva para /Ganho no #tracking',
      'Quantos /lead ativos tenho no #tracking no total?',
    ],
  },
  // ── Empresa & Contatos ─────────────────────────────────────────────────────
  {
    emoji: "🏢",
    label: "Empresa & Contatos",
    examples: [
      '/pesquisar /Empresa — busca todos os registros da empresa',
      '/novo_lead /Empresa "Tech Solutions" /Contato "Ana Lima" /E-mail ana@tech.com no #tracking',
      '/novo_lead /Empresa "Studio Digital" /Responsável /Astro /tag Agência no #tracking',
      '/pesquisar "Studio Digital" — busca empresa, leads e responsáveis',
      'Liste os leads da /Empresa "Tech Solutions" no #tracking',
    ],
  },
  // ── Pesquisa Universal ─────────────────────────────────────────────────────
  {
    emoji: "🔍",
    label: "Pesquisa Universal",
    examples: [
      '/pesquisar /Francisco_Lima — busca em leads, usuários, e-mails e trackings',
      '/pesquisar "Atendimento X" — encontra o tracking pelo nome',
      '/pesquisar /Weydson — todos os registros do /Responsável',
      '/pesquisar contato@empresa.com — busca lead pelo /E-mail',
      '/pesquisar "Clientes 2026" — busca tracking, leads e produtos',
    ],
  },
  // ── Forge ──────────────────────────────────────────────────────────────────
  {
    emoji: "🔥",
    label: "Forge — Propostas e Contratos",
    examples: [
      'Crie uma proposta no #forge para /Francisco_Lima do produto /PRODUTX com validade /amanhã e me manda /link_proposta_criada',
      'Gere um contrato para /João_Silva referente ao /Plano_Pro com assinatura até /semana_que_vem',
      'Crie uma proposta no #forge para /Empresa "Tech Solutions" produto /Consultoria /Responsável /Weydson',
      'Liste todas as propostas abertas no #forge',
    ],
  },
  // ── NASA Post ──────────────────────────────────────────────────────────────
  {
    emoji: "✨",
    label: "NASA Post — Conteúdo",
    examples: [
      'Crie um post para #instagram no #nasa-post sobre o lançamento do /PRODUTX',
      'Gere um carrossel de 5 slides no #nasa-post com os benefícios do /Plano_Pro',
      'Escreva uma legenda para #linkedin anunciando parceria com /Francisco_Lima e me manda /link_post_criado',
      'Crie um post para #tiktok sobre os resultados do mês no #nasa-post',
    ],
  },
  // ── Automações ─────────────────────────────────────────────────────────────
  {
    emoji: "⚡",
    label: "Automações & Gatilhos",
    examples: [
      'Crie /Add_automacao: quando /novo_lead chegar, /Enviar_mensagem via #whatsapp e /Esperar /tempo_duracao 2h',
      'Dispare /gatilho_manual na /Automacao "Boas-vindas" para o /lead /Francisco_Lima',
      'Quando /IA_finalizou a análise, /Enviar_mensagem com resultado para /E-mail /Responsável',
      'Configure /Assistente_chatbot no #nasachat para responder leads com /tag "Qualificado"',
    ],
  },
  // ── Integrações ────────────────────────────────────────────────────────────
  {
    emoji: "🔌",
    label: "Integrações",
    examples: [
      'Envie mensagem via #whatsapp para /Contato /Francisco_Lima: "Sua proposta está pronta!"',
      'Poste no #instagram via #nasa-post o conteúdo do /link_post_criado',
      'Dispare /Enviar_mensagem pelo #telegram para /Responsável /Astro quando /novo_lead entrar',
      'Sincronize /lead /Maria_Costa com #hubspot e atualize /status_tracking para "Integrado"',
    ],
  },
  // ── Consultas Rápidas ──────────────────────────────────────────────────────
  {
    emoji: "💡",
    label: "Consultas Rápidas",
    examples: [
      'Quais são minhas reuniões de /hoje?',
      'Quantos /lead tenho no #tracking no total?',
      'Qual é meu saldo de estrelas atual?',
      'Liste as propostas abertas no #forge',
      '/pesquisar /Astro — todos os registros do usuário Astro',
    ],
  },
];

const rotatingExamples = [
  'Crie um tracking chamado "Atendimento X" no #tracking',
  '/pesquisar /Francisco_Lima — busca em leads, usuários e trackings',
  'Agende reunião no #agenda com /Francisco_Lima para /amanhã às 14h',
  '/novo_lead "João Pereira" no #tracking com /tag VIP /Responsável /Astro',
  'Crie uma proposta no #forge para /Francisco_Lima e me manda /link_proposta_criada',
  '/mover_lead /Maria_Costa para /status_tracking "Proposta Enviada" no #tracking',
  'Gere um post no #nasa-post sobre /PRODUTX para #instagram',
  'Crie /Add_automacao: quando /novo_lead chegar /Enviar_mensagem via #whatsapp',
  '/novo_lead /Empresa "Tech Solutions" /Responsável /Weydson /tag Agência no #tracking',
  '/pesquisar "Atendimento X" — encontra o tracking pelo nome',
];

// ─── Highlight Helper ─────────────────────────────────────────────────────────

function buildHighlightedHTML(text: string): string {
  // Escape HTML first
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Highlight /variables (purple) and #apps (blue)
  return escaped.replace(
    /(\/[\w_ÀÀ-ÿ.]+|#[\w-]+)/g,
    (match) => {
      if (match.startsWith("/")) {
        return `<mark class="bg-transparent text-purple-400 font-medium">${match}</mark>`;
      }
      return `<mark class="bg-transparent text-blue-400 font-medium">${match}</mark>`;
    }
  );
}

// ─── NASA Logo SVG (real brand asset, white paths work on dark bg) ───────────

function NasaLogo({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 810 225"
      className={className}
      aria-label="N.A.S.A."
    >
      {/* White letter paths */}
      <path fill="#ffffff" d="M 209.4375 137.785156 C 213.25 137.785156 216.515625 139.140625 219.230469 141.855469 C 221.945312 144.570312 223.304688 147.835938 223.304688 151.648438 C 223.304688 155.460938 221.945312 158.722656 219.230469 161.4375 C 216.515625 164.152344 213.25 165.511719 209.4375 165.511719 C 205.625 165.511719 202.363281 164.152344 199.648438 161.4375 C 196.933594 158.722656 195.574219 155.460938 195.574219 151.648438 C 195.574219 147.835938 196.933594 144.570312 199.648438 141.855469 C 202.363281 139.140625 205.625 137.785156 209.4375 137.785156 Z" fillOpacity="1" fillRule="nonzero"/>
      <path fill="#ffffff" d="M 310.160156 105.898438 C 312.933594 105.898438 315.5 106.417969 317.871094 107.457031 C 320.238281 108.496094 322.320312 109.910156 324.109375 111.703125 C 325.902344 113.492188 327.316406 115.574219 328.355469 117.941406 C 329.394531 120.308594 329.914062 122.878906 329.914062 125.652344 C 329.914062 128.425781 329.394531 130.996094 328.355469 133.367188 C 327.316406 135.734375 325.902344 137.8125 324.109375 139.605469 C 322.320312 141.394531 320.238281 142.808594 317.871094 143.851562 C 315.5 144.890625 312.933594 145.410156 310.160156 145.410156 C 307.386719 145.410156 304.816406 144.890625 302.445312 143.851562 C 300.078125 142.808594 298 141.394531 296.207031 139.605469 C 294.417969 137.8125 293.003906 135.734375 291.960938 133.367188 C 290.921875 130.996094 290.402344 128.425781 290.402344 125.652344 C 290.402344 122.878906 290.921875 120.308594 291.960938 117.941406 C 293.003906 115.574219 294.417969 113.492188 296.207031 111.703125 C 298 109.914062 300.078125 108.496094 302.445312 107.457031 C 304.816406 106.417969 307.386719 105.898438 310.160156 105.898438 Z" fillOpacity="1" fillRule="evenodd"/>
      <path fill="#ffffff" d="M 385.195312 149.914062 C 386.46875 152.6875 386.554688 155.488281 385.457031 158.320312 C 384.359375 161.148438 382.425781 163.199219 379.652344 164.472656 C 378.265625 165.164062 376.761719 165.511719 375.144531 165.511719 C 373.066406 165.511719 371.101562 164.933594 369.253906 163.777344 C 367.40625 162.625 366.019531 161.0625 365.09375 159.101562 L 326.621094 74.355469 C 325.121094 71.121094 322.867188 68.582031 319.863281 66.730469 C 316.859375 64.882812 313.625 63.960938 310.160156 63.960938 C 306.578125 63.960938 303.3125 64.882812 300.367188 66.730469 C 297.421875 68.582031 295.199219 71.121094 293.695312 74.355469 L 255.050781 159.101562 C 253.777344 161.871094 251.726562 163.777344 248.898438 164.816406 C 246.066406 165.859375 243.265625 165.742188 240.492188 164.472656 C 237.71875 163.199219 235.8125 161.148438 234.773438 158.320312 C 233.734375 155.488281 233.851562 152.6875 235.121094 149.914062 L 273.59375 65.34375 C 276.945312 58.183594 281.882812 52.464844 288.410156 48.1875 C 294.9375 43.914062 302.1875 41.777344 310.160156 41.777344 C 318.015625 41.777344 325.234375 43.914062 331.820312 48.1875 C 338.40625 52.464844 343.316406 58.183594 346.550781 65.34375 Z" fillOpacity="1" fillRule="evenodd"/>
      <path fill="#ffffff" d="M 173.4375 42.988281 C 176.234375 42.988281 178.65625 44.011719 180.699219 46.058594 C 182.746094 48.101562 183.769531 50.523438 183.769531 53.324219 C 183.769531 81.707031 183.769531 110.09375 183.769531 138.476562 C 183.769531 153.902344 174.929688 164.125 156.90625 164.125 C 140.617188 164.125 133.164062 155.808594 128.3125 142.464844 L 94.175781 67.769531 C 92.613281 64.304688 90.535156 62.746094 86.894531 62.746094 C 82.214844 62.746094 79.789062 65.34375 79.789062 69.503906 C 79.789062 97.648438 79.847656 125.652344 79.847656 153.792969 C 79.847656 156.589844 78.824219 159.011719 76.777344 161.058594 C 74.734375 163.101562 72.3125 164.125 69.511719 164.125 C 66.714844 164.125 64.320312 163.101562 62.328125 161.058594 C 60.335938 159.011719 59.339844 156.589844 59.339844 153.792969 C 59.339844 125.347656 59.339844 96.90625 59.339844 68.464844 C 59.339844 53.214844 68.003906 42.988281 86.203125 42.988281 C 102.492188 42.988281 109.769531 51.308594 114.621094 64.652344 L 148.761719 139.34375 C 150.148438 142.117188 152.402344 144.195312 156.214844 144.195312 C 160.546875 144.195312 163.148438 141.597656 163.148438 137.609375 C 163.148438 109.410156 163.261719 81.5 163.261719 53.324219 C 163.261719 50.523438 164.257812 48.101562 166.25 46.058594 C 168.242188 44.011719 170.636719 42.988281 173.4375 42.988281 Z" fillOpacity="1" fillRule="evenodd"/>
      <path fill="#ffffff" d="M 409.601562 137.785156 C 413.414062 137.785156 416.675781 139.140625 419.390625 141.855469 C 422.105469 144.570312 423.464844 147.835938 423.464844 151.648438 C 423.464844 155.460938 422.105469 158.722656 419.390625 161.4375 C 416.675781 164.152344 413.414062 165.511719 409.601562 165.511719 C 405.789062 165.511719 402.523438 164.152344 399.808594 161.4375 C 397.09375 158.722656 395.738281 155.460938 395.738281 151.648438 C 395.738281 147.835938 397.09375 144.570312 399.808594 141.855469 C 402.523438 139.140625 405.789062 137.785156 409.601562 137.785156 Z" fillOpacity="1" fillRule="nonzero"/>
      <path fill="#ffffff" d="M 521.011719 92.726562 C 525.980469 92.726562 530.6875 93.679688 535.136719 95.585938 C 539.585938 97.492188 543.457031 100.09375 546.746094 103.382812 C 550.039062 106.675781 552.640625 110.546875 554.546875 114.996094 C 556.453125 119.445312 557.40625 124.152344 557.40625 129.117188 C 557.40625 134.203125 556.453125 138.941406 554.546875 143.328125 C 552.640625 147.71875 550.039062 151.5625 546.746094 154.855469 C 543.457031 158.148438 539.585938 160.746094 535.136719 162.652344 C 530.6875 164.558594 525.980469 165.511719 521.011719 165.511719 L 445.628906 165.511719 C 442.625 165.511719 440.027344 164.445312 437.832031 162.304688 C 435.636719 160.167969 434.539062 157.539062 434.539062 154.421875 C 434.539062 151.417969 435.636719 148.847656 437.832031 146.707031 C 440.027344 144.570312 442.625 143.503906 445.628906 143.503906 L 521.011719 143.503906 C 525.054688 143.503906 528.464844 142.117188 531.238281 139.34375 C 534.011719 136.570312 535.398438 133.164062 535.398438 129.117188 C 535.398438 125.074219 534.011719 121.667969 531.238281 118.894531 C 528.464844 116.121094 525.054688 114.734375 521.011719 114.734375 L 463.652344 114.734375 C 458.566406 114.734375 453.832031 113.78125 449.441406 111.875 C 445.050781 109.96875 441.210938 107.371094 437.917969 104.078125 C 434.625 100.785156 432.023438 96.914062 430.117188 92.464844 C 428.210938 88.019531 427.257812 83.308594 427.257812 78.34375 C 427.257812 73.375 428.210938 68.667969 430.117188 64.21875 C 432.023438 59.769531 434.625 55.871094 437.917969 52.519531 C 441.210938 49.171875 445.050781 46.542969 449.441406 44.636719 C 453.832031 42.730469 458.566406 41.777344 463.652344 41.777344 L 539.035156 41.777344 C 542.039062 41.777344 544.640625 42.875 546.835938 45.070312 C 549.03125 47.265625 550.128906 49.863281 550.128906 52.867188 C 550.128906 55.871094 549.03125 58.441406 546.835938 60.578125 C 544.640625 62.71875 542.039062 63.785156 539.035156 63.785156 L 463.652344 63.785156 C 459.609375 63.785156 456.199219 65.199219 453.425781 68.03125 C 450.652344 70.863281 449.269531 74.300781 449.269531 78.34375 C 449.269531 82.269531 450.652344 85.648438 453.425781 88.480469 C 456.199219 91.3125 459.609375 92.726562 463.652344 92.726562 Z" fillOpacity="1" fillRule="nonzero"/>
      <path fill="#ffffff" d="M 581.371094 137.785156 C 585.183594 137.785156 588.449219 139.140625 591.164062 141.855469 C 593.878906 144.570312 595.234375 147.835938 595.234375 151.648438 C 595.234375 155.460938 593.878906 158.722656 591.164062 161.4375 C 588.449219 164.152344 585.183594 165.511719 581.371094 165.511719 C 577.558594 165.511719 574.296875 164.152344 571.582031 161.4375 C 568.867188 158.722656 567.507812 155.460938 567.507812 151.648438 C 567.507812 147.835938 568.867188 144.570312 571.582031 141.855469 C 574.296875 139.140625 577.558594 137.785156 581.371094 137.785156 Z" fillOpacity="1" fillRule="nonzero"/>
      {/* A accent paths */}
      <path fill="#ffffff" d="M 666.667969 69.472656 C 669.4375 69.472656 672.007812 69.992188 674.378906 71.03125 C 676.746094 72.070312 678.824219 73.488281 680.617188 75.277344 C 682.40625 77.066406 683.824219 79.148438 684.863281 81.515625 C 685.902344 83.882812 686.421875 86.453125 686.421875 89.226562 C 686.421875 92 685.902344 94.570312 684.863281 96.9375 C 683.824219 99.308594 682.40625 101.386719 680.617188 103.179688 C 678.824219 104.96875 676.746094 106.382812 674.378906 107.425781 C 672.007812 108.464844 669.4375 108.984375 666.667969 108.984375 C 663.894531 108.984375 661.324219 108.464844 658.953125 107.425781 C 656.585938 106.382812 654.507812 104.96875 652.714844 103.179688 C 650.925781 101.386719 649.507812 99.308594 648.46875 96.9375 C 647.429688 94.570312 646.910156 92 646.910156 89.226562 C 646.910156 86.453125 647.429688 83.882812 648.46875 81.515625 C 649.507812 79.148438 650.925781 77.066406 652.714844 75.277344 C 654.507812 73.488281 656.585938 72.070312 658.953125 71.03125 C 661.324219 69.992188 663.894531 69.472656 666.667969 69.472656 Z" fillOpacity="1" fillRule="evenodd"/>
      <path fill="#7a1fe7" d="M 741.703125 113.488281 C 742.972656 116.261719 743.0625 119.0625 741.964844 121.894531 C 740.867188 124.726562 738.929688 126.777344 736.15625 128.046875 C 734.773438 128.738281 733.269531 129.085938 731.652344 129.085938 C 729.574219 129.085938 727.609375 128.507812 725.761719 127.351562 C 723.910156 126.199219 722.523438 124.636719 721.601562 122.675781 L 683.128906 37.929688 C 681.625 34.695312 679.375 32.15625 676.371094 30.304688 C 673.367188 28.457031 670.132812 27.535156 666.664062 27.535156 C 663.085938 27.535156 659.820312 28.457031 656.875 30.304688 C 653.929688 32.15625 651.703125 34.695312 650.203125 37.929688 L 611.554688 122.675781 C 610.285156 125.445312 608.234375 127.351562 605.40625 128.394531 C 602.574219 129.433594 599.773438 129.316406 597 128.046875 C 594.226562 126.773438 592.320312 124.722656 591.28125 121.894531 C 590.242188 119.0625 590.355469 116.261719 591.628906 113.488281 L 630.101562 28.917969 C 633.449219 21.757812 638.390625 16.039062 644.917969 11.765625 C 651.445312 7.488281 658.695312 5.351562 666.664062 5.351562 C 674.523438 5.351562 681.742188 7.488281 688.328125 11.765625 C 694.914062 16.039062 699.824219 21.757812 703.058594 28.917969 Z" fillOpacity="1" fillRule="nonzero"/>
      {/* Oval border */}
      <path fill="#ffffff" d="M 98.597656 5.351562 L 615.609375 5.351562 C 614.695312 6.839844 613.832031 8.378906 613.027344 9.964844 C 612.636719 10.617188 612.277344 11.296875 611.953125 12.003906 L 605.910156 25.289062 L 98.597656 25.289062 C 55.347656 25.289062 19.960938 60.675781 19.960938 103.921875 C 19.960938 147.171875 55.347656 182.558594 98.597656 182.558594 L 689.230469 182.558594 C 732.476562 182.558594 767.863281 147.171875 767.863281 103.921875 C 767.863281 77.046875 754.195312 53.207031 733.464844 39.007812 L 721.636719 13.125 C 721.503906 12.777344 721.359375 12.429688 721.203125 12.082031 C 720.953125 11.527344 720.695312 10.980469 720.429688 10.4375 C 735.058594 15.347656 748.175781 23.605469 758.859375 34.292969 C 776.714844 52.148438 787.800781 76.796875 787.800781 103.921875 C 787.800781 131.050781 776.714844 155.699219 758.859375 173.554688 C 741.003906 191.410156 716.355469 202.496094 689.226562 202.496094 L 98.597656 202.496094 C 71.46875 202.496094 46.820312 191.410156 28.964844 173.554688 C 11.109375 155.699219 0.0234375 131.050781 0.0234375 103.921875 C 0.0234375 76.796875 11.109375 52.148438 28.964844 34.292969 C 46.820312 16.4375 71.46875 5.351562 98.597656 5.351562 Z" fillOpacity="1" fillRule="evenodd"/>
      {/* ® mark */}
      <path fill="#ffffff" d="M 788.175781 28.371094 L 788.175781 11.769531 L 795.535156 11.769531 C 797.015625 11.769531 798.140625 11.917969 798.910156 12.214844 C 799.679688 12.515625 800.292969 13.039062 800.753906 13.792969 C 801.210938 14.546875 801.441406 15.382812 801.441406 16.292969 C 801.441406 17.472656 801.058594 18.464844 800.296875 19.273438 C 799.535156 20.082031 798.359375 20.589844 796.769531 20.8125 C 797.351562 21.089844 797.792969 21.367188 798.09375 21.636719 C 798.734375 22.226562 799.339844 22.964844 799.910156 23.847656 L 802.78125 28.371094 L 800.039062 28.371094 L 797.84375 24.914062 C 797.203125 23.914062 796.675781 23.152344 796.261719 22.625 C 795.84375 22.09375 795.472656 21.726562 795.144531 21.515625 C 794.820312 21.304688 794.484375 21.160156 794.144531 21.074219 C 793.894531 21.023438 793.492188 20.996094 792.921875 20.996094 L 790.378906 20.996094 L 790.378906 28.371094 Z M 790.378906 19.09375 L 795.09375 19.09375 C 796.097656 19.09375 796.878906 18.992188 797.445312 18.78125 C 798.007812 18.578125 798.4375 18.246094 798.726562 17.785156 C 799.019531 17.328125 799.167969 16.835938 799.167969 16.296875 C 799.167969 15.511719 798.886719 14.863281 798.316406 14.359375 C 797.75 13.851562 796.851562 13.601562 795.628906 13.601562 L 790.378906 13.601562 Z" fillOpacity="1" fillRule="nonzero"/>
      <path fill="#ffffff" d="M 794.871094 5.351562 C 799.042969 5.351562 802.820312 7.042969 805.550781 9.773438 C 808.285156 12.507812 809.976562 16.285156 809.976562 20.453125 C 809.976562 24.625 808.285156 28.398438 805.550781 31.132812 C 802.820312 33.863281 799.042969 35.554688 794.871094 35.554688 C 790.703125 35.554688 786.925781 33.863281 784.195312 31.132812 C 781.460938 28.398438 779.769531 24.625 779.769531 20.453125 C 779.769531 16.285156 781.460938 12.507812 784.195312 9.773438 C 786.925781 7.042969 790.703125 5.351562 794.871094 5.351562 Z M 804.042969 11.285156 C 801.695312 8.9375 798.453125 7.488281 794.871094 7.488281 C 791.292969 7.488281 788.050781 8.9375 785.703125 11.285156 C 783.359375 13.628906 781.90625 16.875 781.90625 20.453125 C 781.90625 24.035156 783.359375 27.277344 785.703125 29.621094 C 788.050781 31.96875 791.292969 33.417969 794.871094 33.417969 C 798.453125 31.96875 801.695312 29.621094 804.042969 29.621094 C 806.386719 27.277344 807.839844 24.035156 807.839844 20.453125 C 807.839844 16.871094 806.386719 13.628906 804.042969 11.285156 Z" fillOpacity="1" fillRule="nonzero"/>
    </svg>
  );
}

// ─── Rotating Placeholder ─────────────────────────────────────────────────────

function RotatingExample() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((i) => (i + 1) % rotatingExamples.length);
        setVisible(true);
      }, 400);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-6 flex items-center justify-center overflow-hidden">
      <p
        className={cn(
          "text-xs text-zinc-600 text-center transition-all duration-400 max-w-lg truncate px-4",
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
        )}
      >
        {rotatingExamples[index]}
      </p>
    </div>
  );
}

// ─── Variable Dropdown ────────────────────────────────────────────────────────

interface VariableDropdownProps {
  search: string;
  onSelect: (value: string) => void;
}

function VariableDropdown({ search, onSelect }: VariableDropdownProps) {
  const lower = search.toLowerCase();

  const filtered = variableCategories
    .map((cat) => ({
      ...cat,
      items: cat.items.filter(
        (item) =>
          lower === "" ||
          item.label.toLowerCase().includes(lower) ||
          item.value.toLowerCase().includes(lower)
      ),
    }))
    .filter((cat) => cat.items.length > 0);

  return (
    <div className="absolute bottom-full left-0 mb-2 w-72 bg-zinc-900 border border-zinc-700/60 rounded-xl shadow-2xl overflow-hidden z-50">
      <div className="px-3 py-2 border-b border-zinc-800">
        <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
          Variáveis
        </p>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {filtered.map((cat) => (
          <div key={cat.label}>
            <div className="px-3 py-1.5 flex items-center gap-1.5">
              <span className="text-xs">{cat.emoji}</span>
              <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                {cat.label}
              </span>
            </div>
            {cat.items.map((item) => (
              <button
                key={item.value}
                onClick={() => onSelect(item.value)}
                className="w-full text-left px-4 py-2 hover:bg-zinc-800 transition-colors"
              >
                <span className="block text-sm text-purple-300 font-mono">{item.label}</span>
                {item.description && (
                  <span className="block text-[10px] text-zinc-600 mt-0.5">{item.description}</span>
                )}
              </button>
            ))}
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="px-4 py-3 text-sm text-zinc-600">
            Nenhuma variável encontrada.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── App Dropdown ─────────────────────────────────────────────────────────────

interface AppDropdownProps {
  search: string;
  onSelect: (value: string) => void;
}

function AppDropdown({ search, onSelect }: AppDropdownProps) {
  const lower = search.toLowerCase();
  const match = (a: AppItem) =>
    lower === "" ||
    a.label.toLowerCase().includes(lower) ||
    a.id.toLowerCase().includes(lower);

  const filteredNasa = nasaApps.filter(match);
  const filteredIntegration = integrationApps.filter(match);
  const totalFiltered = filteredNasa.length + filteredIntegration.length;

  const renderGroup = (items: AppItem[], groupLabel: string) => {
    if (items.length === 0) return null;
    return (
      <div key={groupLabel}>
        <div className="px-3 py-1.5 flex items-center gap-1.5">
          <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
            {groupLabel}
          </span>
        </div>
        {items.map((app) => (
          <button
            key={app.id}
            onClick={() => onSelect(app.label)}
            className="w-full text-left px-4 py-2 text-sm hover:bg-zinc-800 transition-colors font-mono"
          >
            <span className={app.color}>{app.label}</span>
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="absolute bottom-full left-0 mb-2 w-64 bg-zinc-900 border border-zinc-700/60 rounded-xl shadow-2xl overflow-hidden z-50">
      <div className="px-3 py-2 border-b border-zinc-800">
        <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
          #Apps NASA &amp; Integrações
        </p>
      </div>
      <div className="max-h-72 overflow-y-auto py-1">
        {renderGroup(filteredNasa, "🚀 NASA Apps")}
        {filteredNasa.length > 0 && filteredIntegration.length > 0 && (
          <div className="border-t border-zinc-800 my-1" />
        )}
        {renderGroup(filteredIntegration, "🔌 Integrações")}
        {totalFiltered === 0 && (
          <p className="px-4 py-3 text-sm text-zinc-600">App não encontrado.</p>
        )}
      </div>
    </div>
  );
}

// ─── Plus Menu ────────────────────────────────────────────────────────────────

interface PlusMenuProps {
  onClose: () => void;
}

function PlusMenu({ onClose }: PlusMenuProps) {
  return (
    <div className="absolute bottom-full left-0 mb-2 w-52 bg-zinc-900 border border-zinc-700/60 rounded-xl shadow-2xl overflow-hidden z-50">
      <button
        onClick={onClose}
        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
      >
        <Image className="w-4 h-4 text-zinc-400" />
        Arquivos & Fotos
      </button>
      <button
        onClick={onClose}
        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
      >
        <LayoutGrid className="w-4 h-4 text-zinc-400" />
        Apps
      </button>
      <button
        onClick={onClose}
        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
      >
        <Link2 className="w-4 h-4 text-zinc-400" />
        Links
      </button>
    </div>
  );
}

// ─── Result Overlay ───────────────────────────────────────────────────────────

interface ResultOverlayProps {
  result: ResultData;
  onClose: () => void;
}

function ResultOverlay({ result, onClose }: ResultOverlayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(
      `${window.location.origin}${result.url}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700/60 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-white mb-1">
                {result.title}
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                {result.description}
              </p>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-2">
            <a
              href={result.url}
              className="flex-1 flex items-center justify-center gap-2 bg-white text-black text-sm font-semibold py-2.5 rounded-lg hover:bg-zinc-100 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Abrir agora
            </a>
            <button
              onClick={handleCopy}
              className="flex items-center justify-center gap-2 bg-zinc-800 border border-zinc-700 text-zinc-300 text-sm font-medium py-2.5 px-4 rounded-lg hover:bg-zinc-700 transition-colors"
            >
              <Copy className="w-4 h-4" />
              {copied ? "Copiado!" : "Copiar link"}
            </button>
          </div>
        </div>

        <div className="border-t border-zinc-800 px-6 py-3 flex justify-end">
          <button
            onClick={onClose}
            className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Recent Apps ──────────────────────────────────────────────────────────────

function RecentApps() {
  return (
    <div className="w-full">
      <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3 text-center">
        Recentemente
      </h3>
      <div className="flex flex-wrap gap-3 justify-center">
        {recentApps.map((app) => (
          <a
            key={app.id}
            href={app.url}
            className="flex items-center gap-2.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-xl px-3 py-2.5 transition-all group hover:bg-zinc-800/80"
          >
            <div
              className={cn(
                "w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center flex-shrink-0",
                app.gradient
              )}
            >
              {app.icon}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white tracking-wide group-hover:text-white transition-colors">
                {app.name}
              </p>
              <p className="text-[10px] text-zinc-600">by NASA®</p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

// ─── Example Library ─────────────────────────────────────────────────────────

interface ExampleLibraryProps {
  onSelect: (example: string) => void;
}

function ExampleLibrary({ onSelect }: ExampleLibraryProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="w-full">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider hover:text-zinc-300 transition-colors"
      >
        <Lightbulb className="w-3.5 h-3.5" />
        Biblioteca de Exemplos
        {open ? (
          <ChevronUp className="w-3.5 h-3.5" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5" />
        )}
      </button>

      {open && (
        <div className="mt-4 space-y-5">
          {exampleCategories.map((cat) => (
            <div key={cat.label}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm">{cat.emoji}</span>
                <h4 className="text-xs font-semibold text-zinc-400">
                  {cat.label}
                </h4>
              </div>
              <div className="space-y-1.5">
                {cat.examples.map((example, i) => (
                  <button
                    key={i}
                    onClick={() => onSelect(example)}
                    className="w-full text-left text-xs text-zinc-500 hover:text-zinc-200 bg-zinc-900/50 hover:bg-zinc-800/80 border border-zinc-800/80 hover:border-zinc-700 rounded-lg px-3 py-2 transition-all leading-relaxed"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Model Selector ───────────────────────────────────────────────────────────

type ModelType = "claude" | "astro";

interface ModelSelectorProps {
  value: ModelType;
  onChange: (v: ModelType) => void;
}

function ModelSelector({ value, onChange }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 bg-zinc-800 border border-zinc-700/50 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700 transition-colors"
      >
        {value === "claude" ? (
          <Bot className="w-3.5 h-3.5 text-orange-400" />
        ) : (
          <Sparkles className="w-3.5 h-3.5 text-violet-400" />
        )}
        {value === "claude" ? "Claude" : "Astro"}
        <ChevronDown className="w-3 h-3 text-zinc-500" />
      </button>

      {open && (
        <div className="absolute bottom-full right-0 mb-1 w-36 bg-zinc-900 border border-zinc-700/60 rounded-xl shadow-2xl overflow-hidden z-50">
          <button
            onClick={() => {
              onChange("claude");
              setOpen(false);
            }}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2.5 text-sm transition-colors",
              value === "claude"
                ? "text-white bg-zinc-800"
                : "text-zinc-400 hover:bg-zinc-800"
            )}
          >
            <Bot className="w-4 h-4 text-orange-400" />
            Claude
          </button>
          <button
            onClick={() => {
              onChange("astro");
              setOpen(false);
            }}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2.5 text-sm transition-colors",
              value === "astro"
                ? "text-white bg-zinc-800"
                : "text-zinc-400 hover:bg-zinc-800"
            )}
          >
            <Sparkles className="w-4 h-4 text-violet-400" />
            Astro
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Message Types ────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  command?: string;           // raw text for user messages
  thinking?: string[];        // step labels shown during processing
  result?: ResultData;
  isThinking?: boolean;       // still loading
}

function buildThinkingSteps(cmd: string): string[] {
  const lower = cmd.toLowerCase();
  const steps: string[] = ["Analisando o comando..."];

  if (lower.includes("#forge"))       steps.push("Identificando app: Forge");
  if (lower.includes("#agenda"))      steps.push("Identificando app: Agenda");
  if (lower.includes("#nasa-post"))   steps.push("Identificando app: NASA Post");
  if (lower.includes("#tracking"))    steps.push("Identificando app: Tracking");

  const vars = [...cmd.matchAll(/\/([A-Za-zÀ-ÿ0-9_]+)/g)].map((m) => m[1]);
  vars.forEach((v) => {
    if (!["hoje","amanhã","amanha","semana_que_vem"].includes(v.toLowerCase()) && !v.startsWith("link_") && !/^\d/.test(v)) {
      steps.push(`Resolvendo variável /${v}...`);
    }
  });

  if (lower.includes("proposta"))   steps.push("Criando proposta no Forge...");
  if (lower.includes("contrato"))   steps.push("Criando contrato no Forge...");
  if (lower.includes("reunião") || lower.includes("follow-up") || lower.includes("agende")) steps.push("Criando agendamento...");
  if (lower.includes("post") || lower.includes("carrossel")) steps.push("Criando post no NASA Post...");
  if (lower.includes("tracking") && lower.includes("crie")) steps.push("Criando tracking...");
  if (lower.includes("lead") && lower.includes("crie")) steps.push("Criando lead...");
  if (lower.includes("saldo") || lower.includes("estrelas")) steps.push("Consultando saldo de Stars...");
  if (lower.includes("quantos") || lower.includes("quais") || lower.includes("liste")) steps.push("Buscando dados...");

  steps.push("Finalizando...");
  return steps;
}

// ─── Thinking Display ─────────────────────────────────────────────────────────

function ThinkingDisplay({ steps }: { steps: string[] }) {
  const [visibleCount, setVisibleCount] = useState(1);

  useEffect(() => {
    if (visibleCount >= steps.length) return;
    const t = setTimeout(() => setVisibleCount((c) => c + 1), 420);
    return () => clearTimeout(t);
  }, [visibleCount, steps.length]);

  return (
    <div className="flex items-start gap-3 py-2">
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-600 to-purple-800 flex items-center justify-center shrink-0 shadow-lg shadow-violet-900/40">
        <Sparkles className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 min-w-0 bg-zinc-900/60 border border-zinc-800/80 rounded-xl px-4 py-3">
        <div className="flex items-center gap-2 text-xs text-zinc-400 mb-2">
          <Search className="w-3 h-3 shrink-0" />
          <span className="truncate">
            {steps.slice(0, visibleCount).join(" · ")}
          </span>
          {visibleCount < steps.length && (
            <span className="shrink-0 text-zinc-600">
              {visibleCount}/{steps.length} resultados
            </span>
          )}
          {visibleCount >= steps.length && (
            <span className="shrink-0 text-violet-400">✓ concluído</span>
          )}
        </div>
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── User Message Bubble ──────────────────────────────────────────────────────

function UserBubble({ command }: { command: string }) {
  return (
    <div className="flex justify-center py-2">
      <div
        className="max-w-2xl w-full bg-zinc-800/60 border border-zinc-700/50 rounded-2xl px-5 py-3 text-sm leading-relaxed"
        dangerouslySetInnerHTML={{ __html: buildHighlightedHTML(command) }}
        style={{ color: "#d4d4d8" }}
      />
    </div>
  );
}

// ─── Response Card ────────────────────────────────────────────────────────────

function ResponseCard({ result, onClose }: { result: ResultData; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const fullUrl = `${typeof window !== "undefined" ? window.location.origin : ""}${result.url}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="flex items-start gap-3 py-2">
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-600 to-purple-800 flex items-center justify-center shrink-0 shadow-lg shadow-violet-900/40">
        <Sparkles className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 min-w-0 bg-zinc-900/80 border border-zinc-700/60 rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-zinc-800/60">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-semibold text-white">{result.title}</span>
          </div>
          <button onClick={onClose} className="text-zinc-600 hover:text-zinc-300 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        {/* Body */}
        <div className="px-5 py-4">
          <p className="text-sm text-zinc-400 leading-relaxed whitespace-pre-line">{result.description}</p>
        </div>
        {/* Actions */}
        <div className="flex items-center gap-2 px-5 pb-4">
          <a
            href={result.url}
            className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Abrir no {result.appName}
          </a>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold px-4 py-2 rounded-lg transition-colors border border-zinc-700/50"
          >
            <Copy className="w-3.5 h-3.5" />
            {copied ? "Copiado!" : "Copiar link"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Command Input Box ────────────────────────────────────────────────────────

interface CommandInputProps {
  command: string;
  setCommand: (v: string) => void;
  loading: boolean;
  onSubmit: () => void;
  model: ModelType;
  setModel: (v: ModelType) => void;
  dropdown: DropdownType;
  setDropdown: (v: DropdownType | ((prev: DropdownType) => DropdownType)) => void;
  dropdownSearch: string;
  setDropdownSearch: (v: string) => void;
}

function CommandInput({
  command, setCommand, loading, onSubmit, model, setModel,
  dropdown, setDropdown, dropdownSearch, setDropdownSearch,
}: CommandInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const syncScroll = useCallback(() => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, []);

  useEffect(() => { autoResize(); }, [command, autoResize]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setDropdown(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [setDropdown]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setCommand(val);
    syncScroll();
    const cursor = e.target.selectionStart ?? 0;
    const before = val.slice(0, cursor);
    const slashMatch = before.match(/\/(\w*)$/);
    const hashMatch = before.match(/#(\w[-\w]*)$/);
    if (slashMatch) { setDropdown("variable"); setDropdownSearch(slashMatch[1]); }
    else if (hashMatch) { setDropdown("app"); setDropdownSearch(hashMatch[1]); }
    else if (dropdown === "variable" || dropdown === "app") { setDropdown(null); setDropdownSearch(""); }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") { setDropdown(null); return; }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSubmit(); }
  };

  const insertVariable = (value: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const cursor = el.selectionStart ?? 0;
    const before = command.slice(0, cursor);
    const after = command.slice(cursor);
    const newBefore = before.replace(/[/#][\w-]*$/, "") + value + " ";
    setCommand(newBefore + after);
    setDropdown(null);
    setDropdownSearch("");
    setTimeout(() => { el.focus(); el.selectionStart = el.selectionEnd = newBefore.length; }, 0);
  };

  const highlightedHTML = buildHighlightedHTML(command);

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative bg-zinc-900 border border-zinc-700/60 rounded-2xl shadow-xl overflow-visible transition-all focus-within:border-zinc-600/80">
        {/* Text area with highlight */}
        <div className="relative px-12 pt-4 pb-2">
          <div
            ref={highlightRef}
            aria-hidden="true"
            className="absolute inset-0 px-12 pt-4 pb-2 text-sm leading-relaxed pointer-events-none overflow-hidden whitespace-pre-wrap break-words"
            style={{ fontSize: "0.875rem", lineHeight: "1.625", wordBreak: "break-word" }}
            dangerouslySetInnerHTML={{ __html: highlightedHTML + "\u200b" }}
          />
          <textarea
            ref={textareaRef}
            value={command}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            onScroll={syncScroll}
            disabled={loading}
            rows={1}
            placeholder={`Crie uma proposta no "#forge" do produto "/PRODUTX"...`}
            className="relative w-full bg-transparent text-transparent caret-white resize-none outline-none text-sm leading-relaxed placeholder:text-zinc-600 placeholder:font-sans placeholder:text-xs min-h-[48px] max-h-[200px] overflow-y-auto"
            style={{ caretColor: "white", fontSize: "0.875rem", lineHeight: "1.625", wordBreak: "break-word" }}
          />
        </div>

        {/* Bottom toolbar */}
        <div className="flex items-center justify-between px-3 py-2 border-t border-zinc-800/60">
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setDropdown((d) => (d === "plus" ? null : "plus"))}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/50 text-zinc-400 hover:text-white transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
              {dropdown === "plus" && <PlusMenu onClose={() => setDropdown(null)} />}
            </div>
            <span className="text-[11px] text-zinc-600">
              Adicione{" "}
              <kbd className="bg-zinc-800 text-zinc-500 px-1 py-0.5 rounded text-[10px] font-mono">/</kbd>
              {" "}variáveis e{" "}
              <kbd className="bg-zinc-800 text-zinc-500 px-1 py-0.5 rounded text-[10px] font-mono">#App</kbd>
              {" "}para escolher o app
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ModelSelector value={model} onChange={setModel} />
            <button
              onClick={onSubmit}
              disabled={!command.trim() || loading}
              className={cn(
                "w-8 h-8 flex items-center justify-center rounded-lg transition-all",
                command.trim() && !loading
                  ? "bg-white text-black hover:bg-zinc-100"
                  : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
              )}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Dropdowns */}
        {dropdown === "variable" && (
          <div className="absolute left-3 bottom-full mb-1 z-50">
            <VariableDropdown search={dropdownSearch} onSelect={insertVariable} />
          </div>
        )}
        {dropdown === "app" && (
          <div className="absolute left-3 bottom-full mb-1 z-50">
            <AppDropdown search={dropdownSearch} onSelect={insertVariable} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Welcome Screen ───────────────────────────────────────────────────────────

interface WelcomeScreenProps {
  onSelect: (e: string) => void;
  commandInputProps: CommandInputProps;
}

function WelcomeScreen({ onSelect, commandInputProps }: WelcomeScreenProps) {
  return (
    <div className="flex flex-col items-center w-full min-h-full px-4 py-10 sm:py-14 select-none">
      <div className="w-full max-w-2xl mx-auto flex flex-col items-center gap-6">

        {/* 1. Marca / Logo */}
        <div className="flex flex-col items-center gap-2">
          <NasaLogo className="w-[180px] sm:w-[240px] h-auto opacity-95" />
          <p className="text-[10px] font-bold tracking-[0.35em] text-zinc-500 uppercase">
            Command Center
          </p>
          <RotatingExample />
        </div>

        {/* 2. Campo de comando */}
        <div className="w-full">
          <CommandInput {...commandInputProps} />
        </div>

        {/* 3. Apps recentes */}
        <div className="w-full">
          <RecentApps />
        </div>

        {/* 4. Biblioteca de exemplos */}
        <div className="w-full">
          <ExampleLibrary onSelect={onSelect} />
        </div>

      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function NasaCommandCenter() {
  const [command, setCommand] = useState("");
  const [dropdown, setDropdown] = useState<DropdownType>(null);
  const [dropdownSearch, setDropdownSearch] = useState("");
  const [model, setModel] = useState<ModelType>("claude");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const executeCommand = useMutation(orpc.nasaCommand.execute.mutationOptions());

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async () => {
    if (!command.trim() || loading) return;
    const userText = command.trim();
    setLoading(true);
    setCommand("");
    setDropdown(null);

    const thinkingSteps = buildThinkingSteps(userText);
    const msgId = Math.random().toString(36).slice(2);

    // Add user bubble + thinking placeholder
    setMessages((prev) => [
      ...prev,
      { id: msgId + "-user", role: "user", command: userText },
      { id: msgId + "-think", role: "assistant", isThinking: true, thinking: thinkingSteps },
    ]);

    try {
      const res = await executeCommand.mutateAsync({ command: userText });
      // Replace thinking with real result
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId + "-think"
            ? { ...m, isThinking: false, result: { title: res.title, description: res.description, url: res.url ?? "/home", appName: res.appName } }
            : m,
        ),
      );
    } catch (err: unknown) {
      const message = (err as { message?: string })?.message ?? "Erro ao processar o comando.";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId + "-think"
            ? { ...m, isThinking: false, result: { title: "Erro", description: message, url: "/home", appName: "NASA" } }
            : m,
        ),
      );
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const removeMessage = (id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  };

  const fillExample = (example: string) => {
    setCommand(example);
  };

  const hasMessages = messages.length > 0;

  const commandInputProps: CommandInputProps = {
    command,
    setCommand,
    loading,
    onSubmit: handleSubmit,
    model,
    setModel,
    dropdown,
    setDropdown,
    dropdownSearch,
    setDropdownSearch,
  };

  return (
    <div className="h-full flex flex-col bg-zinc-950">

      {/* ── Top bar: always visible ── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800/60 bg-zinc-950/95 backdrop-blur shrink-0">
        {hasMessages ? (
          <NasaLogo className="w-[100px] sm:w-[130px] h-auto opacity-70" />
        ) : (
          <div /> /* spacer in welcome mode so StarsWidget stays right */
        )}
        <StarsWidget />
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto">
        {!hasMessages ? (
          <WelcomeScreen onSelect={fillExample} commandInputProps={commandInputProps} />
        ) : (
          <div className="max-w-3xl mx-auto px-3 sm:px-4 pt-4 pb-4 space-y-2">
            {messages.map((msg) => (
              <div key={msg.id}>
                {msg.role === "user" && msg.command && (
                  <UserBubble command={msg.command} />
                )}
                {msg.role === "assistant" && msg.isThinking && msg.thinking && (
                  <ThinkingDisplay steps={msg.thinking} />
                )}
                {msg.role === "assistant" && !msg.isThinking && msg.result && (
                  <ResponseCard
                    result={msg.result}
                    onClose={() => removeMessage(msg.id)}
                  />
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* ── Fixed bottom input — only in chat mode ── */}
      {hasMessages && (
        <div className="border-t border-zinc-800/60 bg-zinc-950/90 backdrop-blur px-3 sm:px-4 py-3 shrink-0">
          <div className="max-w-3xl mx-auto">
            <CommandInput {...commandInputProps} />
          </div>
        </div>
      )}
    </div>
  );
}
