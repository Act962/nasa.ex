import {
  CalendarDaysIcon,
  ClipboardListIcon,
  FileIcon,
  FileSignatureIcon,
  FilesIcon,
  MegaphoneIcon,
  RouteIcon,
  StarIcon,
  TerminalSquareIcon,
  type LucideIcon,
} from "lucide-react";

// Itens da lateral "Detalhes do Lead" do chat, na ordem da tela.

export type LeadSidebarItemId =
  | "journey"
  | "files"
  | "forms"
  | "contracts"
  | "documents"
  | "starFriend"
  | "agenda"
  | "campaigns"
  | "commands";

export interface LeadSidebarItem {
  id: LeadSidebarItemId;
  label: string;
  icon: LucideIcon;
}

export const LEAD_SIDEBAR_ITEMS: LeadSidebarItem[] = [
  { id: "journey", label: "Jornada", icon: RouteIcon },
  { id: "files", label: "Arquivos", icon: FileIcon },
  { id: "forms", label: "Formulários", icon: ClipboardListIcon },
  { id: "contracts", label: "Contratos", icon: FileSignatureIcon },
  { id: "documents", label: "Documentos", icon: FilesIcon },
  { id: "starFriend", label: "Star Friend", icon: StarIcon },
  { id: "agenda", label: "Agenda", icon: CalendarDaysIcon },
  { id: "campaigns", label: "Campanhas", icon: MegaphoneIcon },
  { id: "commands", label: "Comandos", icon: TerminalSquareIcon },
];
