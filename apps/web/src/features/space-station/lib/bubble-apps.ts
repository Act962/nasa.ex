/**
 * Lista compartilhada dos apps de comunicação 1:1 no World — usada pela
 * Bolha de conversa (proximity-based, `BubbleAppsPanel`) E pelo popover do
 * Cutucar (click-based, `CutucarPopover`). Mesmo conjunto de ícones e labels
 * pra UX consistente.
 *
 * "Chat" NÃO está aqui — é tratado fora do grid de apps porque tem fluxo
 * próprio (drawer/inline em vez de stub `onOpenApp`).
 */

import {
  FolderOpen,
  ClipboardList,
  Calendar,
  Hammer,
  ScrollText,
  Paperclip,
  Image as ImageIcon,
} from "lucide-react";

export type BubbleApp =
  | "nbox"
  | "forms"
  | "agenda"
  | "forge"
  | "scripts"
  | "file"
  | "image";

export interface BubbleAppDef {
  id: BubbleApp;
  label: string;
  icon: typeof FolderOpen;
  /** Tailwind class pro ícone (cor temática). */
  color: string;
}

export const BUBBLE_APPS: BubbleAppDef[] = [
  { id: "nbox",    label: "N-Box",       icon: FolderOpen,    color: "text-blue-300"    },
  { id: "forms",   label: "Formulários", icon: ClipboardList, color: "text-indigo-300"  },
  { id: "agenda",  label: "Agenda",      icon: Calendar,      color: "text-emerald-300" },
  { id: "forge",   label: "Forge",       icon: Hammer,        color: "text-amber-300"   },
  { id: "scripts", label: "Scripts",     icon: ScrollText,    color: "text-fuchsia-300" },
  { id: "file",    label: "Arquivo",     icon: Paperclip,     color: "text-slate-300"   },
  { id: "image",   label: "Imagem",      icon: ImageIcon,     color: "text-sky-300"     },
];
