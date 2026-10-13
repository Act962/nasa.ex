import type { Dispatch, SetStateAction } from "react";
import type { useActiveOrgProjectsByOrg } from "@/features/org-projects/hooks/use-org-projects";

/** Opções, rascunhos e valores iniciais do assistente de campanha. */

export const EVENT_TYPES = [
  { value: "TRAINING", label: "Treinamento", emoji: "📚" },
  { value: "STRATEGIC_MEETING", label: "Reunião Estratégica", emoji: "🤝" },
  { value: "KICKOFF", label: "Kickoff", emoji: "🚀" },
  { value: "REVIEW", label: "Review", emoji: "📊" },
  { value: "PRESENTATION", label: "Apresentação", emoji: "🎤" },
  { value: "DEADLINE", label: "Prazo", emoji: "⏰" },
];

export const ASSET_TYPES = [
  { value: "LOGO", label: "Logo", emoji: "🎨" },
  { value: "COLOR_PALETTE", label: "Paleta de Cores", emoji: "🎭" },
  { value: "FONT", label: "Fonte", emoji: "✍️" },
  { value: "LINK", label: "Link", emoji: "🔗" },
  { value: "IMAGE", label: "Imagem", emoji: "🖼️" },
  { value: "DOCUMENT", label: "Documento", emoji: "📄" },
];

export const CAMPAIGN_TYPES = [
  { value: "captacao",     label: "🎯 Captação de Leads" },
  { value: "vendas",       label: "💰 Vendas Diretas" },
  { value: "trafego",      label: "📈 Tráfego Pago" },
  { value: "lancamento",   label: "🚀 Lançamento de Produto" },
  { value: "retencao",     label: "🔁 Retenção e Fidelização" },
  { value: "marca",        label: "✨ Reconhecimento de Marca" },
  { value: "educativo",    label: "📚 Conteúdo Educativo" },
  { value: "promocao",     label: "🏷️ Promoção / Oferta" },
  { value: "evento",       label: "🎤 Evento / Webinar" },
  { value: "reengajamento",label: "💬 Reengajamento" },
];

export interface EventDraft { eventType: string; title: string; scheduledAt: string; durationMinutes: number; meetingLink: string; workspaceId?: string; columnId?: string }
export interface TaskDraft { title: string; assignedTo: string; priority: string; dueDate: string; workspaceId?: string; columnId?: string }
export interface AssetDraft { assetType: string; name: string; url: string }

export interface CampaignPlanDraft {
  campaignType: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  color: string;
}

export const EMPTY_PLAN: CampaignPlanDraft = { campaignType: "", title: "", description: "", startDate: "", endDate: "", color: "#7c3aed" };
export const EMPTY_EVENT: EventDraft = { eventType: "KICKOFF", title: "", scheduledAt: "", durationMinutes: 60, meetingLink: "" };
export const EMPTY_ASSET: AssetDraft = { assetType: "LOGO", name: "", url: "" };
export const EMPTY_TASK: TaskDraft = { title: "", assignedTo: "", priority: "MEDIUM", dueDate: "" };

export type DraftSetter<Draft> = Dispatch<SetStateAction<Draft>>;

export type WizardProject = ReturnType<typeof useActiveOrgProjectsByOrg>["projects"][number];
