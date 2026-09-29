import {
  CalendarDaysIcon,
  ClipboardListIcon,
  FileIcon,
  FileSignatureIcon,
  FilesIcon,
  MegaphoneIcon,
  RouteIcon,
  StarIcon,
} from "lucide-react";
import type { ComponentType } from "react";
import { TriggerIcon } from "@/features/leads/components/lead-triggers/trigger-icon";

// Itens da lateral "Detalhes do Lead" do chat, na ordem da tela.

/** `?leadScreen=<item>` abre a tela do item — usado pelo ícone de gatilho da lista. */
export const LEAD_SCREEN_PARAM = "leadScreen";

export type LeadSidebarItemId =
  | "journey"
  | "files"
  | "forms"
  | "contracts"
  | "documents"
  | "starFriend"
  | "agenda"
  | "campaigns"
  | "leadTriggers";

export interface LeadSidebarItem {
  id: LeadSidebarItemId;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

export const LEAD_SIDEBAR_ITEMS: LeadSidebarItem[] = [
  { id: "journey", label: "Jornada", icon: RouteIcon },
  { id: "files", label: "Arquivos", icon: FileIcon },
  { id: "forms", label: "Formulários", icon: ClipboardListIcon },
  { id: "contracts", label: "Contratos", icon: FileSignatureIcon },
  { id: "documents", label: "Documentos", icon: FilesIcon },
  { id: "starFriend", label: "Star Friend", icon: StarIcon },
  { id: "agenda", label: "Agenda", icon: CalendarDaysIcon },
  { id: "campaigns", label: "Disparo em Massa", icon: MegaphoneIcon },
  { id: "leadTriggers", label: "Gatilho do lead", icon: TriggerIcon },
];
