"use client";

import { useState } from "react";
import {
  useQueryPlatformIntegrations,
  useUpsertPlatformIntegration,
  useDeletePlatformIntegration,
} from "../hooks/use-integrations";
import { useOrgRole } from "@/hooks/use-org-role";
import { IntegrationPlatform } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Globe,
  Info,
  Key,
  Link2Off,
  Loader2,
  Lock,
  Plug,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  ToggleRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FieldDef {
  key: string;
  label: string;
  placeholder: string;
  type?: "text" | "password";
  hint?: string;
}

export interface PlatformDef {
  platform: IntegrationPlatform | "WHATSAPP";
  label: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: React.FC<{ className?: string }>;
  fields: FieldDef[];
  docsUrl: string;
  docsLabel: string;
  steps: string[];
  category: "messaging" | "social" | "maps" | "email" | "ads" | "crm" | "ai";
  visualGuide?: boolean;
}

// ─── Google Calendar Visual Steps ─────────────────────────────────────────────

export const GC_VISUAL_STEPS = [
  {
    step: 1,
    icon: Globe,
    color: "from-blue-500 to-blue-600",
    title: "Criar projeto no Cloud Console",
    description: 'Acesse console.cloud.google.com → clique em "Selecionar projeto" → "Novo projeto"',
    mockup: (
      <div className="mt-2 rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 p-2 text-[10px] space-y-1">
        <div className="flex items-center gap-1.5 bg-[#1a73e8] text-white rounded px-2 py-0.5 w-fit font-medium">
          <span className="text-[9px]">≡</span> Google Cloud
        </div>
        <div className="flex gap-1 items-center text-blue-700 dark:text-blue-300">
          <span className="bg-blue-100 dark:bg-blue-900 px-1.5 py-0.5 rounded border border-blue-300 dark:border-blue-700">Selecionar projeto ▾</span>
          <span className="text-muted-foreground">→</span>
          <span className="bg-white dark:bg-blue-900 px-1.5 py-0.5 rounded border border-blue-300 dark:border-blue-700">+ Novo projeto</span>
        </div>
      </div>
    ),
  },
  {
    step: 2,
    icon: ToggleRight,
    color: "from-green-500 to-green-600",
    title: "Ativar a Google Calendar API",
    description: 'APIs e Serviços → Biblioteca → pesquise "Google Calendar API" → Ativar',
    mockup: (
      <div className="mt-2 rounded-md border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/40 p-2 text-[10px] space-y-1">
        <div className="text-green-700 dark:text-green-300 font-medium">Google Calendar API</div>
        <div className="flex items-center gap-2">
          <div className="bg-[#1a73e8] text-white rounded px-2 py-0.5 font-medium">ATIVAR</div>
          <span className="text-muted-foreground">← clique aqui</span>
        </div>
      </div>
    ),
  },
  {
    step: 3,
    icon: Key,
    color: "from-violet-500 to-violet-600",
    title: "Criar ID do cliente OAuth 2.0",
    description: 'Credenciais → + Criar credenciais → ID do cliente OAuth → tipo "Aplicativo da Web"',
    mockup: (
      <div className="mt-2 rounded-md border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/40 p-2 text-[10px] space-y-1">
        <div className="text-violet-700 dark:text-violet-300">Tipo de aplicativo:</div>
        <div className="flex gap-1">
          <span className="bg-violet-100 dark:bg-violet-900 px-1.5 py-0.5 rounded border-2 border-violet-400 text-violet-700 dark:text-violet-300 font-medium">● Aplicativo da Web</span>
        </div>
        <div className="text-muted-foreground">URIs: http://localhost</div>
      </div>
    ),
  },
  {
    step: 4,
    icon: RefreshCw,
    color: "from-orange-500 to-orange-600",
    title: "Gerar Refresh Token via OAuth Playground",
    description: 'Acesse developers.google.com/oauthplayground → insira seu Client ID/Secret → escopo calendar.events',
    mockup: (
      <div className="mt-2 rounded-md border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/40 p-2 text-[10px] space-y-1">
        <div className="text-orange-700 dark:text-orange-300 font-medium">OAuth 2.0 Playground</div>
        <div className="bg-white dark:bg-orange-950 border border-orange-200 dark:border-orange-700 rounded px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
          https://www.googleapis.com/auth/calendar.events
        </div>
        <div className="bg-[#1a73e8] text-white rounded px-2 py-0.5 w-fit">Exchange tokens →</div>
      </div>
    ),
  },
];

// ─── SVG Icons ────────────────────────────────────────────────────────────────

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);
const InstagramIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
  </svg>
);
const TikTokIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.79 1.52V6.74a4.85 4.85 0 01-1.02-.05z" />
  </svg>
);
const LinkedInIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);
const GmailIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 010 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.907 1.528-1.147C21.69 2.28 24 3.434 24 5.457z" />
  </svg>
);
const GoogleMapsIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C7.802 0 4 3.403 4 7.602 4 11.8 7.469 16.812 12 24c4.531-7.188 8-12.2 8-16.398C20 3.403 16.199 0 12 0zm0 11a3 3 0 110-6 3 3 0 010 6z" />
  </svg>
);
const GoogleCalendarIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.316 5.684H24v12.632h-5.684zM5.684 24h12.632v-5.684H5.684zm12.632-18.316V0H6.316C5.006 0 3.947 1.059 3.947 2.368v15.948L0 19.74 3.947 24v-.013h.013v.013H17.37c1.311 0 2.368-1.059 2.368-2.368V18.32H5.684V5.684h12.632zM21.61 0h-3.292v5.684H24V2.39C24 1.07 22.93 0 21.61 0zm-15.926 8.842H4.737v1.579h1.947v-.79h.79V8.842zm3.158 6.632c0 .432-.353.79-.79.79s-.79-.358-.79-.79V12c0-.432.353-.79.79-.79s.79.358.79.79v3.474zm0-6.632h-.79v1.579h1.58v-.79h.79V8.842H8.842zm3.158 6.632c0 .432-.353.79-.79.79s-.79-.358-.79-.79V12c0-.432.353-.79.79-.79s.79.358.79.79v3.474zm0-6.632h-.79v1.579h1.58v-.79h.79V8.842h-1.58zm3.159 6.632c0 .432-.353.79-.79.79s-.79-.358-.79-.79V12c0-.432.353-.79.79-.79s.79.358.79.79v3.474zm0-6.632h-.79v1.579H16V8.842h-1.58z"/>
  </svg>
);
const MetaIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M6.915 4.03c-1.968 0-3.683 1.28-4.871 3.113C.704 9.208 0 11.883 0 14.449c0 .706.07 1.369.21 1.973a6.624 6.624 0 00.265.86 5.297 5.297 0 00.371.761c.696 1.159 1.818 1.927 3.593 1.927 1.497 0 2.633-.671 3.965-2.444.76-1.012 1.144-1.626 2.663-4.32l.756-1.339.186-.325c.061.1.121.196.18.291l2.308 3.597c.924 1.44 1.977 2.754 3.236 3.66 1.416 1.03 2.92 1.436 4.558 1.436 1.724 0 3.345-.539 4.421-1.57.966-.927 1.548-2.216 1.548-3.793 0-2.89-1.386-5.553-3.5-7.577-2.071-1.982-5.131-3.502-9.063-3.502-3.244 0-5.906.905-7.944 2.362" />
  </svg>
);
const OpenAIIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M22.282 9.821a5.985 5.985 0 00-.516-4.91 6.046 6.046 0 00-6.51-2.9A6.065 6.065 0 004.981 4.18a5.985 5.985 0 00-3.998 2.9 6.046 6.046 0 00.743 7.097 5.98 5.98 0 00.51 4.911 6.051 6.051 0 006.515 2.9A5.985 5.985 0 0013.26 24a6.056 6.056 0 005.772-4.206 5.99 5.99 0 003.997-2.9 6.056 6.056 0 00-.747-7.073zM13.26 22.43a4.476 4.476 0 01-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 00.392-.681v-6.737l2.02 1.168a.071.071 0 01.038.052v5.583a4.504 4.504 0 01-4.494 4.494zM3.6 18.304a4.47 4.47 0 01-.535-3.014l.142.085 4.783 2.759a.771.771 0 00.78 0l5.843-3.369v2.332a.08.08 0 01-.033.062L9.74 19.95a4.5 4.5 0 01-6.14-1.646zM2.34 7.896a4.485 4.485 0 012.366-1.973V11.6a.766.766 0 00.388.676l5.815 3.355-2.02 1.168a.076.076 0 01-.071 0l-4.83-2.786A4.504 4.504 0 012.34 7.896zm16.597 3.855l-5.833-3.387 2.019-1.168a.076.076 0 01.071 0l4.83 2.791a4.494 4.494 0 01-.676 8.105v-5.678a.79.79 0 00-.411-.663zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 00-.785 0L9.409 9.23V6.897a.066.066 0 01.028-.061l4.83-2.787a4.5 4.5 0 016.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 01-.038-.057V6.075a4.5 4.5 0 017.375-3.453l-.142.08-4.778 2.758a.795.795 0 00-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
  </svg>
);
const AnthropicIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M13.827 3.52h3.603L24 20h-3.603l-6.57-16.48zm-7.258 0h3.767L16.906 20h-3.674L9.122 8.32 6.819 14.8H9.9L11.07 18H3.753l-.803 2H0L6.569 3.52z" />
  </svg>
);
const GeminiIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.376 0 0 5.376 0 12s5.376 12 12 12 12-5.376 12-12S18.624 0 12 0zm-.5 18.5l-5-5 1.41-1.41L11.5 15.67l8.09-8.09L21 9l-9.5 9.5z" />
  </svg>
);
const KommoIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
  </svg>
);
const RDStationIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2a10 10 0 100 20A10 10 0 0012 2zm0 3a7 7 0 110 14A7 7 0 0112 5zm0 2a5 5 0 100 10A5 5 0 0012 7zm0 2a3 3 0 110 6 3 3 0 010-6z" />
  </svg>
);
const PipedriveIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M21.385.029C19.654-.206 17.49.683 15.99 2.075c-1.78 1.63-2.641 3.899-2.641 6.21 0 4.08 2.88 7.336 6.959 7.336.6 0 1.2-.06 1.77-.18.15 3.51-1.89 6.089-5.399 6.089-1.471 0-2.581-.451-3.571-1.05L4.921 24l.36-.72 5.849-3.24c-2.07-1.71-3.3-4.17-3.3-6.87C7.83 6.03 12.3 0 18.72 0c.9 0 1.8.03 2.665.029zm-4.214 4.77c-1.65 0-2.909 1.319-2.909 2.969s1.26 2.97 2.909 2.97c1.651 0 2.91-1.32 2.91-2.97s-1.259-2.97-2.91-2.97z" />
  </svg>
);
const HuggingFaceIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm-.75 6.75a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm3 0a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm-4.5 6.75c0-1.5 1.5-3 4.5-3s4.5 1.5 4.5 3c0 1.875-2.016 3-4.5 3s-4.5-1.125-4.5-3zm-2.25-4.5a1.125 1.125 0 110 2.25 1.125 1.125 0 010-2.25zm10.5 0a1.125 1.125 0 110 2.25 1.125 1.125 0 010-2.25z"/>
  </svg>
);
const PollinationsIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2a2 2 0 012 2c0 .74-.4 1.38-1 1.73V8h2a6 6 0 016 6v2a6 6 0 01-6 6H9a6 6 0 01-6-6v-2a6 6 0 016-6h2V5.73A2 2 0 0110 4a2 2 0 012-2zm-3 8a4 4 0 00-4 4v2a4 4 0 004 4h6a4 4 0 004-4v-2a4 4 0 00-4-4H9zm1 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm4 0a1.5 1.5 0 110 3 1.5 1.5 0 010-3z"/>
  </svg>
);

// ─── Platform Definitions ─────────────────────────────────────────────────────

export const PLATFORM_DEFS: PlatformDef[] = [
  // ── Messaging ──────────────────────────
  {
    platform: "WHATSAPP",
    label: "WhatsApp",
    description: "Receba e responda mensagens de clientes. Leads gerados automaticamente a partir das conversas via UAZAPI.",
    color: "text-[#25D366]", bgColor: "bg-[#25D366]/10", borderColor: "border-[#25D366]/30",
    icon: WhatsAppIcon, fields: [], steps: [],
    docsUrl: "/settings/integration", docsLabel: "Configurar instância WhatsApp", category: "messaging",
  },
  {
    platform: IntegrationPlatform.INSTAGRAM,
    label: "Instagram DM",
    description: "Centralize mensagens diretas do Instagram no chat do NASA. Identifique leads por origem automaticamente.",
    color: "text-[#E1306C]", bgColor: "bg-gradient-to-br from-[#833AB4]/10 via-[#FD1D1D]/10 to-[#F77737]/10", borderColor: "border-[#E1306C]/30",
    icon: InstagramIcon,
    docsUrl: "https://developers.facebook.com/docs/instagram-api/getting-started", docsLabel: "Meta for Developers",
    category: "messaging",
    steps: [
      "Acesse developers.facebook.com e crie um App do tipo 'Business'",
      "Ative o produto 'Instagram Graph API' no App",
      "Gere um Token de Acesso de Página de longa duração em Ferramentas > Explorador da API",
      "Copie o App ID, App Secret e Token abaixo",
    ],
    fields: [
      { key: "appId", label: "App ID (Meta)", placeholder: "123456789", hint: "Meta for Developers > Seu App > Configurações Básicas" },
      { key: "appSecret", label: "App Secret", placeholder: "abc123...", type: "password", hint: "Configurações Básicas do seu App Meta" },
      { key: "accessToken", label: "Token de Acesso de Página", placeholder: "EAABsb...", type: "password", hint: "Ferramentas > Explorador da API do Graph" },
      { key: "webhookSecret", label: "Webhook Secret (opcional)", placeholder: "meu_secret_webhook" },
    ],
  },
  // ── Ads / Marketing ────────────────────
  {
    platform: IntegrationPlatform.META,
    label: "Meta Ads",
    description: "Puxe dados completos de campanhas Meta (Facebook + Instagram Ads): alcance, CTR, CPL, ROAS, conversões e mais.",
    color: "text-[#0082FB]", bgColor: "bg-[#0082FB]/10", borderColor: "border-[#0082FB]/30",
    icon: MetaIcon,
    docsUrl: "https://developers.facebook.com/docs/marketing-api/get-started", docsLabel: "Meta Marketing API Docs",
    category: "ads",
    steps: [
      "Acesse developers.facebook.com e crie ou use um App existente do tipo 'Business'",
      "Adicione o produto 'Marketing API' ao App",
      "Em 'Ferramentas > Explorador da API do Graph', gere um token com permissões: ads_read, ads_management, business_management",
      "Em sua conta de anúncios, encontre o ID da conta (formato: act_XXXXXXXXX)",
      "Cole o App ID, App Secret, Token e Ad Account ID abaixo",
    ],
    fields: [
      { key: "appId", label: "App ID", placeholder: "123456789", hint: "Meta for Developers > Seu App > Configurações Básicas" },
      { key: "appSecret", label: "App Secret", placeholder: "abc123...", type: "password" },
      { key: "accessToken", label: "Token de Acesso (com ads_read)", placeholder: "EAABsb...", type: "password", hint: "Gere com escopo: ads_read, ads_management" },
      { key: "adAccountId", label: "Ad Account ID", placeholder: "act_123456789", hint: "Gerenciador de Anúncios > Conta > ID da conta" },
      { key: "businessId", label: "Business ID (opcional)", placeholder: "987654321", hint: "Meta Business Suite > Configurações > ID da Empresa" },
    ],
  },
  // ── Social ─────────────────────────────
  {
    platform: IntegrationPlatform.TIKTOK,
    label: "TikTok",
    description: "Monitore métricas de anúncios e interações do TikTok. Identifique leads vindos do seu perfil.",
    color: "text-foreground", bgColor: "bg-muted", borderColor: "border-border",
    icon: TikTokIcon,
    docsUrl: "https://developers.tiktok.com/doc/overview", docsLabel: "TikTok for Developers",
    category: "social",
    steps: [
      "Acesse developers.tiktok.com e crie uma conta de desenvolvedor",
      "Crie um App e obtenha Client Key e Client Secret",
      "Configure os escopos: user.info.basic, video.list, tcm.order.get",
    ],
    fields: [
      { key: "clientKey", label: "Client Key", placeholder: "awxxxxxxxxxxxxxxxx" },
      { key: "clientSecret", label: "Client Secret", placeholder: "xxxxxxxxxxxxxxxx", type: "password" },
      { key: "accessToken", label: "Access Token", placeholder: "act.xxxxxxxx", type: "password" },
    ],
  },
  {
    platform: IntegrationPlatform.LINKEDIN,
    label: "LinkedIn",
    description: "Capture leads B2B do LinkedIn automaticamente. Integre métricas de conteúdo e anúncios.",
    color: "text-[#0A66C2]", bgColor: "bg-[#0A66C2]/10", borderColor: "border-[#0A66C2]/30",
    icon: LinkedInIcon,
    docsUrl: "https://developer.linkedin.com/", docsLabel: "LinkedIn Developers",
    category: "social",
    steps: [
      "Acesse developer.linkedin.com e crie um App vinculado à sua Página",
      "Solicite os produtos 'Marketing Developer Platform'",
      "Gere token OAuth 2.0 com escopos: r_liteprofile, r_emailaddress, rw_ads",
    ],
    fields: [
      { key: "clientId", label: "Client ID", placeholder: "86xxxxxxxx" },
      { key: "clientSecret", label: "Client Secret", placeholder: "xxxxxxxx", type: "password" },
      { key: "accessToken", label: "Access Token", placeholder: "AQXxxx...", type: "password" },
    ],
  },
  // ── Email ──────────────────────────────
  {
    platform: IntegrationPlatform.GMAIL,
    label: "Gmail",
    description: "Centralize e-mails de clientes no NASA. Histórico completo de comunicação por lead.",
    color: "text-[#EA4335]", bgColor: "bg-[#EA4335]/10", borderColor: "border-[#EA4335]/30",
    icon: GmailIcon,
    docsUrl: "https://console.cloud.google.com/", docsLabel: "Google Cloud Console",
    category: "email",
    steps: [
      "Acesse console.cloud.google.com e ative a 'Gmail API'",
      "Crie um ID de Cliente OAuth 2.0 do tipo 'Aplicativo da Web'",
      "Use o OAuth Playground para gerar um Refresh Token",
    ],
    fields: [
      { key: "clientId", label: "Client ID", placeholder: "123456-xxxx.apps.googleusercontent.com" },
      { key: "clientSecret", label: "Client Secret", placeholder: "GOCSPX-xxxxxxxx", type: "password" },
      { key: "refreshToken", label: "Refresh Token", placeholder: "1//0xxxxxxx...", type: "password" },
    ],
  },
  // ── Maps ───────────────────────────────
  {
    platform: IntegrationPlatform.GOOGLE_MAPS,
    label: "Google Maps",
    description: "Exiba localização de clientes, filtre leads por região e integre avaliações do Google Business.",
    color: "text-[#4285F4]", bgColor: "bg-[#4285F4]/10", borderColor: "border-[#4285F4]/30",
    icon: GoogleMapsIcon,
    docsUrl: "https://console.cloud.google.com/", docsLabel: "Google Cloud Console",
    category: "maps",
    steps: [
      "Ative 'Maps JavaScript API' e 'Places API' no Google Cloud Console",
      "Crie uma Chave de API em 'Credenciais'",
      "Restrinja a chave ao domínio do NASA",
    ],
    fields: [
      { key: "apiKey", label: "Chave de API do Google", placeholder: "AIzaSy...", type: "password" },
      { key: "placeId", label: "Place ID (Google Business)", placeholder: "ChIJ..." },
    ],
  },
  {
    platform: IntegrationPlatform.GOOGLE_CALENDAR,
    label: "Google Calendar",
    description: "Crie e sincronize eventos de campanhas diretamente no Google Calendar. Ao adicionar um evento em 'Planejar Campanha', o link será gerado automaticamente.",
    color: "text-[#4285F4]", bgColor: "bg-[#4285F4]/10", borderColor: "border-[#4285F4]/30",
    icon: GoogleCalendarIcon,
    docsUrl: "https://console.cloud.google.com/", docsLabel: "Google Cloud Console",
    category: "maps",
    visualGuide: true,
    steps: [
      "Acesse console.cloud.google.com e ative a 'Google Calendar API'",
      "Crie um ID de Cliente OAuth 2.0 do tipo 'Aplicativo da Web'",
      "Use o OAuth Playground (oauth2.googleapis.com/tokeninfo) para gerar um Refresh Token com escopo calendar.events",
      "Cole o Client ID, Client Secret e Refresh Token abaixo",
    ],
    fields: [
      { key: "clientId", label: "Client ID", placeholder: "123456-xxxx.apps.googleusercontent.com" },
      { key: "clientSecret", label: "Client Secret", placeholder: "GOCSPX-xxxxxxxx", type: "password" },
      { key: "refreshToken", label: "Refresh Token", placeholder: "1//0xxxxxxx...", type: "password", hint: "Escopo necessário: https://www.googleapis.com/auth/calendar.events" },
      { key: "calendarId", label: "Calendar ID (opcional)", placeholder: "primary ou email@gmail.com", hint: "Deixe em branco para usar o calendário principal" },
    ],
  },
  // ── AI ─────────────────────────────────
  {
    platform: IntegrationPlatform.OPENAI,
    label: "OpenAI",
    description: "Use modelos GPT-4o no NASA para resumos de conversas, sugestões de resposta e automações inteligentes.",
    color: "text-foreground", bgColor: "bg-muted", borderColor: "border-border",
    icon: OpenAIIcon,
    docsUrl: "https://platform.openai.com/api-keys", docsLabel: "OpenAI Platform",
    category: "ai",
    steps: [
      "Acesse platform.openai.com e faça login",
      "Vá em API Keys > Create new secret key",
      "Copie a chave (só aparece uma vez)",
    ],
    fields: [
      { key: "apiKey", label: "API Key", placeholder: "sk-proj-...", type: "password", hint: "platform.openai.com/api-keys" },
      { key: "orgId", label: "Organization ID (opcional)", placeholder: "org-xxxxxxxx" },
    ],
  },
  {
    platform: IntegrationPlatform.ANTHROPIC,
    label: "Anthropic (Claude)",
    description: "Integre Claude ao NASA para análise de leads, automações e respostas mais precisas em português.",
    color: "text-[#D97757]", bgColor: "bg-[#D97757]/10", borderColor: "border-[#D97757]/30",
    icon: AnthropicIcon,
    docsUrl: "https://console.anthropic.com/settings/keys", docsLabel: "Anthropic Console",
    category: "ai",
    steps: [
      "Acesse console.anthropic.com e faça login",
      "Vá em Settings > API Keys > Create Key",
      "Copie a chave e cole abaixo",
    ],
    fields: [
      { key: "apiKey", label: "API Key", placeholder: "sk-ant-api03-...", type: "password", hint: "console.anthropic.com/settings/keys" },
    ],
  },
  {
    platform: IntegrationPlatform.GEMINI,
    label: "Gemini (Google AI)",
    description: "Use Gemini 2.5 Flash para análise de dados, geração de relatórios e automações baseadas em IA.",
    color: "text-[#4285F4]", bgColor: "bg-gradient-to-br from-[#4285F4]/10 to-[#EA4335]/10", borderColor: "border-[#4285F4]/30",
    icon: GeminiIcon,
    docsUrl: "https://aistudio.google.com/app/apikey", docsLabel: "Google AI Studio",
    category: "ai",
    steps: [
      "Acesse aistudio.google.com e faça login com sua conta Google",
      "Clique em 'Get API Key' > 'Create API Key'",
      "Copie a chave e cole abaixo",
    ],
    fields: [
      { key: "apiKey", label: "API Key", placeholder: "AIzaSy...", type: "password", hint: "aistudio.google.com/app/apikey" },
    ],
  },
  {
    platform: IntegrationPlatform.HUGGING_FACE,
    label: "Hugging Face",
    description: "Gere imagens gratuitamente com modelos open-source como FLUX.1-schnell. Use sua chave gratuita do Hugging Face para geração de imagens no NASA Planner.",
    color: "text-[#FF9A00]", bgColor: "bg-[#FF9A00]/10", borderColor: "border-[#FF9A00]/30",
    icon: HuggingFaceIcon,
    docsUrl: "https://huggingface.co/settings/tokens", docsLabel: "Hugging Face Tokens",
    category: "ai",
    steps: [
      "Acesse huggingface.co e crie uma conta gratuita",
      "Vá em Settings > Access Tokens > New token",
      "Crie um token com permissão 'read' (gratuito)",
      "Cole a chave abaixo — será usada para geração de imagens no NASA Planner",
    ],
    fields: [
      { key: "apiKey", label: "Access Token", placeholder: "hf_xxxxxxxxxx", type: "password", hint: "huggingface.co/settings/tokens — plano gratuito disponível" },
    ],
  },
  {
    platform: IntegrationPlatform.POLLINATIONS,
    label: "Pollinations.ai",
    description: "Geração de imagens 100% gratuita e sem necessidade de chave de API. Usa modelos como FLUX para criar imagens para posts no NASA Planner automaticamente.",
    color: "text-[#22c55e]", bgColor: "bg-[#22c55e]/10", borderColor: "border-[#22c55e]/30",
    icon: PollinationsIcon,
    docsUrl: "https://pollinations.ai", docsLabel: "Pollinations.ai",
    category: "ai",
    steps: [
      "Nenhuma configuração necessária!",
      "Pollinations.ai é totalmente gratuito e não exige chave de API",
      "Basta ativar a integração — imagens serão geradas automaticamente",
      "Usa o modelo FLUX para imagens de alta qualidade",
    ],
    fields: [],
  },
  // ── CRM ────────────────────────────────
  {
    platform: IntegrationPlatform.KOMMO,
    label: "Kommo (amoCRM)",
    description: "Sincronize leads, negócios e contatos do Kommo com o NASA. Fluxo bidirecional de dados de vendas.",
    color: "text-[#339DFF]", bgColor: "bg-[#339DFF]/10", borderColor: "border-[#339DFF]/30",
    icon: KommoIcon,
    docsUrl: "https://www.kommo.com/developers/", docsLabel: "Kommo Developers",
    category: "crm",
    steps: [
      "Acesse seu painel Kommo e vá em Configurações > Integrações",
      "Crie uma nova integração e obtenha o Client ID e Client Secret",
      "Configure o domínio da sua conta (ex: suaempresa.kommo.com)",
      "Gere um token de acesso OAuth 2.0",
    ],
    fields: [
      { key: "domain", label: "Domínio da conta", placeholder: "suaempresa.kommo.com", hint: "Ex: empresa.kommo.com" },
      { key: "clientId", label: "Client ID", placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" },
      { key: "clientSecret", label: "Client Secret", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", type: "password" },
      { key: "accessToken", label: "Access Token", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", type: "password" },
    ],
  },
  {
    platform: IntegrationPlatform.RD_STATION,
    label: "RD Station",
    description: "Sincronize leads e oportunidades do RD Station Marketing e CRM automaticamente no NASA.",
    color: "text-[#00C4A0]", bgColor: "bg-[#00C4A0]/10", borderColor: "border-[#00C4A0]/30",
    icon: RDStationIcon,
    docsUrl: "https://developers.rdstation.com/", docsLabel: "RD Station Developers",
    category: "crm",
    steps: [
      "Acesse app.rdstation.com e vá em Configurações > Integrações > API",
      "Crie um novo App em developers.rdstation.com",
      "Obtenha o Client ID e Client Secret",
      "Autorize a integração via OAuth 2.0",
    ],
    fields: [
      { key: "clientId", label: "Client ID", placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" },
      { key: "clientSecret", label: "Client Secret", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", type: "password" },
      { key: "accessToken", label: "Access Token", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", type: "password" },
      { key: "refreshToken", label: "Refresh Token", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", type: "password" },
    ],
  },
  {
    platform: IntegrationPlatform.PIPEDRIVE,
    label: "Pipedrive",
    description: "Importe negócios, pessoas e atividades do Pipedrive para o NASA. Unifique seu pipeline de vendas.",
    color: "text-[#172B4D]", bgColor: "bg-[#172B4D]/10 dark:bg-white/5", borderColor: "border-[#172B4D]/20 dark:border-white/10",
    icon: PipedriveIcon,
    docsUrl: "https://developers.pipedrive.com/", docsLabel: "Pipedrive Developers",
    category: "crm",
    steps: [
      "Acesse seu Pipedrive e vá em Configurações > Ferramentas pessoais > API",
      "Copie o seu API Token pessoal",
      "Informe também o subdomínio da sua conta (ex: suaempresa.pipedrive.com)",
    ],
    fields: [
      { key: "apiToken", label: "API Token", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", type: "password", hint: "Pipedrive > Configurações > Ferramentas pessoais > API" },
      { key: "domain", label: "Subdomínio da conta", placeholder: "suaempresa", hint: "Ex: 'suaempresa' de suaempresa.pipedrive.com" },
    ],
  },
];

// ─── Integration Card ────────────────────────────────────────────────────────

function IntegrationCard({
  def, isConnected, onConfigure, onDisconnect,
}: {
  def: PlatformDef; isConnected: boolean;
  onConfigure: () => void; onDisconnect: () => void;
}) {
  const Icon = def.icon;
  const { isSingle } = useOrgRole();
  return (
    <div className={cn(
      "relative flex flex-col rounded-2xl border-2 p-5 transition-all hover:shadow-md bg-card",
      isConnected ? def.borderColor : "border-border hover:border-muted-foreground/40",
    )}>
      {isConnected && (
        <div className="absolute top-4 right-4">
          <Badge variant="outline" className="border-green-500/40 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 gap-1 text-[11px]">
            <CheckCircle2 className="size-3" /> Conectado
          </Badge>
        </div>
      )}
      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center mb-3", def.bgColor)}>
        <Icon className={cn("w-6 h-6", def.color)} />
      </div>
      <h3 className="font-semibold text-sm mb-1">{def.label}</h3>
      <p className="text-xs text-muted-foreground leading-relaxed mb-4 flex-1">{def.description}</p>
      <div className="flex gap-2 mt-auto">
        {isSingle ? (
          <Button size="sm" variant="outline" className="w-full gap-1.5 text-xs text-slate-400 cursor-not-allowed" disabled>
            <Lock className="size-3.5" /> Sem permissão
          </Button>
        ) : def.platform === "WHATSAPP" ? (
          <Button size="sm" variant="outline" className="w-full gap-1.5 text-xs" asChild>
            <a href={def.docsUrl}><ExternalLink className="size-3.5" />{def.docsLabel}</a>
          </Button>
        ) : isConnected ? (
          <>
            <Button size="sm" variant="outline" className="flex-1 text-xs gap-1" onClick={onConfigure}>
              <Plug className="size-3.5" /> Reconfigurar
            </Button>
            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive text-xs" onClick={onDisconnect}>
              <Link2Off className="size-3.5" />
            </Button>
          </>
        ) : (
          <Button size="sm" className="w-full gap-1.5 text-xs" onClick={onConfigure}>
            <Plug className="size-3.5" /> Conectar
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Config Dialog ────────────────────────────────────────────────────────────

export function ConfigDialog({
  def, existing, open, onClose, onSave, isSaving,
}: {
  def: PlatformDef; existing: Record<string, string>; open: boolean;
  onClose: () => void; onSave: (c: Record<string, string>) => void; isSaving: boolean;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    def.fields.forEach((f) => { init[f.key] = existing[f.key] ?? ""; });
    return init;
  });
  const [astroOpen, setAstroOpen] = useState(false);
  const [astroGuide, setAstroGuide] = useState<string | null>(null);
  const [astroLoading, setAstroLoading] = useState(false);
  const Icon = def.icon;

  async function handleGenerateGuide() {
    setAstroLoading(true);
    setAstroGuide(null);
    try {
      const res = await fetch("/api/ai/generate-guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integration: def.label }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro desconhecido");
      setAstroGuide(data.guide);
    } catch (e: any) {
      setAstroGuide(`❌ ${e.message}`);
    } finally {
      setAstroLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-2", def.bgColor)}>
            <Icon className={cn("w-5 h-5", def.color)} />
          </div>
          <DialogTitle>Conectar {def.label}</DialogTitle>
          <DialogDescription>Configure as credenciais da API para ativar a integração.</DialogDescription>
        </DialogHeader>

        {def.steps.length > 0 && (
          <div className="rounded-xl border border-border overflow-hidden">
            {/* Header */}
            <div className="bg-muted/60 px-4 py-3 flex items-center justify-between">
              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Info className="size-3.5 text-muted-foreground" /> Como obter as credenciais
              </p>
              {def.visualGuide && (
                <button
                  type="button"
                  onClick={() => { setAstroOpen((v) => !v); if (!astroGuide && !astroOpen) handleGenerateGuide(); }}
                  className="flex items-center gap-1.5 text-[11px] font-semibold text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
                >
                  <Sparkles className="size-3.5" />
                  Gerar com Astro
                  <ChevronDown className={cn("size-3.5 transition-transform", astroOpen && "rotate-180")} />
                </button>
              )}
            </div>

            {/* Visual step cards (Google Calendar) */}
            {def.visualGuide ? (
              <div className="p-4 space-y-3">
                {GC_VISUAL_STEPS.map((s) => {
                  const StepIcon = s.icon;
                  return (
                    <div key={s.step} className="flex gap-3">
                      <div className={cn("shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br flex items-center justify-center text-white shadow-sm mt-0.5", s.color)}>
                        <StepIcon className="size-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground">{s.step}. {s.title}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{s.description}</p>
                        {s.mockup}
                      </div>
                    </div>
                  );
                })}
                <a href={def.docsUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-primary hover:underline pt-1">
                  <ExternalLink className="size-3" />{def.docsLabel}
                </a>
              </div>
            ) : (
              <div className="p-4">
                <ol className="space-y-1.5">
                  {def.steps.map((step, i) => (
                    <li key={i} className="flex gap-2 text-xs text-muted-foreground">
                      <span className="shrink-0 w-4 h-4 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold mt-0.5">{i + 1}</span>
                      {step}
                    </li>
                  ))}
                </ol>
                <a href={def.docsUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-primary hover:underline mt-3">
                  <ExternalLink className="size-3" />{def.docsLabel}
                </a>
              </div>
            )}

            {/* Astro-generated guide */}
            {def.visualGuide && astroOpen && (
              <div className="border-t border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20 px-4 py-3">
                {astroLoading ? (
                  <div className="flex items-center gap-2 text-xs text-violet-600 dark:text-violet-400">
                    <Loader2 className="size-3.5 animate-spin" /> Astro está gerando o guia...
                  </div>
                ) : astroGuide ? (
                  <div className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">{astroGuide}</div>
                ) : null}
              </div>
            )}
          </div>
        )}

        {def.fields.length > 0 ? (
          <div className="space-y-4">
            {def.fields.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label htmlFor={field.key} className="text-sm font-medium">{field.label}</Label>
                <Input id={field.key} type={field.type ?? "text"} placeholder={field.placeholder}
                  value={values[field.key] ?? ""}
                  onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  autoComplete="off" />
                {field.hint && <p className="text-[11px] text-muted-foreground">{field.hint}</p>}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-emerald-500" />
            <span>Nenhuma credencial necessária. Clique em <strong>Ativar integração</strong> para conectar.</span>
          </div>
        )}

        <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/30 border text-xs text-muted-foreground">
          <ShieldCheck className="size-4 shrink-0 text-green-500 mt-0.5" />
          <span>Credenciais armazenadas com segurança. O NASA nunca compartilha seus tokens com terceiros.</span>
        </div>

        <div className="flex gap-2 pt-1">
          <Button variant="outline" onClick={onClose} className="flex-1" disabled={isSaving}>Cancelar</Button>
          <Button
            onClick={() => onSave(values)}
            disabled={isSaving || (def.fields.length > 0 && !Object.values(values).some(v => v.trim()))}
            className="flex-1 gap-1.5"
          >
            {isSaving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            {def.fields.length === 0 ? "Ativar integração" : "Salvar integração"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export const CATEGORY_META: Record<string, { label: string; order: number }> = {
  messaging: { label: "💬 Mensagens & Chat", order: 1 },
  ads:       { label: "📊 Anúncios & Marketing", order: 2 },
  social:    { label: "📱 Redes Sociais", order: 3 },
  email:     { label: "📧 E-mail", order: 4 },
  maps:      { label: "🗺️ Localização & Mapas", order: 5 },
  ai:        { label: "🤖 Inteligência Artificial", order: 6 },
  crm:       { label: "🏢 CRM & Vendas", order: 7 },
};

export function IntegrationsPage() {
  const { data, isLoading } = useQueryPlatformIntegrations();
  const upsert = useUpsertPlatformIntegration();
  const remove = useDeletePlatformIntegration();
  const [configuring, setConfiguring] = useState<PlatformDef | null>(null);
  const [disconnecting, setDisconnecting] = useState<IntegrationPlatform | null>(null);

  const connectedMap = new Map(
    (data?.integrations ?? []).map((i) => [i.platform, i.config as Record<string, string>]),
  );

  const handleSave = (config: Record<string, string>) => {
    if (!configuring || configuring.platform === "WHATSAPP") return;
    upsert.mutate(
      { platform: configuring.platform as IntegrationPlatform, config, isActive: true },
      { onSuccess: () => setConfiguring(null) },
    );
  };

  const categories = Object.entries(CATEGORY_META).sort((a, b) => a[1].order - b[1].order).map(([k]) => k);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Integrações</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Conecte suas ferramentas ao NASA para centralizar dados, mensagens e leads em um único lugar.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Integrações disponíveis", value: PLATFORM_DEFS.length },
          { label: "Conectadas", value: isLoading ? "—" : connectedMap.size + 1 },
          { label: "Fontes de lead rastreadas", value: isLoading ? "—" : connectedMap.size + 2 },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border bg-card p-4">
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Cards by category */}
      {categories.map((cat) => {
        const defs = PLATFORM_DEFS.filter((d) => d.category === cat);
        if (!defs.length) return null;
        return (
          <section key={cat}>
            <h2 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
              {CATEGORY_META[cat].label}
              <ChevronRight className="size-3.5" />
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {defs.map((def) => (
                <IntegrationCard key={def.platform} def={def}
                  isConnected={def.platform === "WHATSAPP" ? true : connectedMap.has(def.platform as IntegrationPlatform)}
                  onConfigure={() => setConfiguring(def)}
                  onDisconnect={() => def.platform !== "WHATSAPP" && setDisconnecting(def.platform as IntegrationPlatform)}
                />
              ))}
            </div>
          </section>
        );
      })}

      {/* Lead origin info */}
      <div className="rounded-2xl border bg-card p-5">
        <h2 className="font-semibold text-sm mb-1">🎯 Rastreamento automático de origem de leads</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Com as integrações ativas, o NASA identifica automaticamente de qual plataforma cada lead veio.
          O ícone da fonte aparece no card do lead, no chat e nos Insights.
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            { icon: WhatsAppIcon, label: "WhatsApp", color: "text-[#25D366]", bg: "bg-[#25D366]/10" },
            { icon: MetaIcon, label: "Meta Ads", color: "text-[#0082FB]", bg: "bg-[#0082FB]/10" },
            { icon: InstagramIcon, label: "Instagram", color: "text-[#E1306C]", bg: "bg-[#E1306C]/10" },
            { icon: TikTokIcon, label: "TikTok", color: "text-foreground", bg: "bg-muted" },
            { icon: LinkedInIcon, label: "LinkedIn", color: "text-[#0A66C2]", bg: "bg-[#0A66C2]/10" },
            { icon: GmailIcon, label: "Gmail", color: "text-[#EA4335]", bg: "bg-[#EA4335]/10" },
            { icon: GoogleMapsIcon, label: "Google Maps", color: "text-[#4285F4]", bg: "bg-[#4285F4]/10" },
          ].map(({ icon: Icon, label, color, bg }) => (
            <div key={label} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border", bg)}>
              <Icon className={cn("w-3.5 h-3.5", color)} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {configuring && configuring.platform !== "WHATSAPP" && (
        <ConfigDialog def={configuring}
          existing={connectedMap.get(configuring.platform as IntegrationPlatform) ?? {}}
          open onClose={() => setConfiguring(null)}
          onSave={handleSave} isSaving={upsert.isPending}
        />
      )}

      <AlertDialog open={!!disconnecting} onOpenChange={(o) => !o && setDisconnecting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desconectar integração</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja desconectar esta integração? Os leads já capturados serão mantidos, mas novos dados não serão sincronizados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (disconnecting) remove.mutate({ platform: disconnecting }, { onSuccess: () => setDisconnecting(null) }); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Desconectar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Embedded section (used inside the marketplace) ───────────────────────────

export function PlatformIntegrationsSection() {
  const { data, isLoading } = useQueryPlatformIntegrations();
  const upsert = useUpsertPlatformIntegration();
  const remove = useDeletePlatformIntegration();
  const [configuring, setConfiguring] = useState<PlatformDef | null>(null);
  const [disconnecting, setDisconnecting] = useState<IntegrationPlatform | null>(null);

  const connectedMap = new Map(
    (data?.integrations ?? []).map((i) => [i.platform, i.config as Record<string, string>]),
  );

  const handleSave = (config: Record<string, string>) => {
    if (!configuring || configuring.platform === "WHATSAPP") return;
    upsert.mutate(
      { platform: configuring.platform as IntegrationPlatform, config, isActive: true },
      { onSuccess: () => setConfiguring(null) },
    );
  };

  const categories = Object.entries(CATEGORY_META).sort((a, b) => a[1].order - b[1].order).map(([k]) => k);

  if (isLoading) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold tracking-tight">📡 Canais & Plataformas</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Conecte Meta Ads, Instagram, TikTok e outros para puxar métricas em Insights → Canais.
        </p>
      </div>

      {categories.map((cat) => {
        const defs = PLATFORM_DEFS.filter((d) => d.category === cat);
        if (!defs.length) return null;
        return (
          <section key={cat}>
            <h3 className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
              {CATEGORY_META[cat].label}
              <ChevronRight className="size-3.5" />
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {defs.map((def) => (
                <IntegrationCard key={def.platform} def={def}
                  isConnected={def.platform === "WHATSAPP" ? true : connectedMap.has(def.platform as IntegrationPlatform)}
                  onConfigure={() => setConfiguring(def)}
                  onDisconnect={() => def.platform !== "WHATSAPP" && setDisconnecting(def.platform as IntegrationPlatform)}
                />
              ))}
            </div>
          </section>
        );
      })}

      {configuring && configuring.platform !== "WHATSAPP" && (
        <ConfigDialog def={configuring}
          existing={connectedMap.get(configuring.platform as IntegrationPlatform) ?? {}}
          open onClose={() => setConfiguring(null)}
          onSave={handleSave} isSaving={upsert.isPending}
        />
      )}

      <AlertDialog open={!!disconnecting} onOpenChange={(o) => !o && setDisconnecting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desconectar integração</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja desconectar esta integração? Os dados já coletados serão mantidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (disconnecting) remove.mutate({ platform: disconnecting }, { onSuccess: () => setDisconnecting(null) }); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Desconectar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
