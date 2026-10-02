import type { LucideIcon } from "lucide-react";
import {
  HistoryIcon,
  UserIcon,
  ClockIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  ArchiveIcon,
  RefreshCcwIcon,
  PlusIcon,
  Settings2Icon,
  ListChecksIcon,
  Edit3Icon,
} from "lucide-react";
import { ActionHistoryType } from "../types";

export const ACTION_TYPE_CONFIG: Record<
  ActionHistoryType,
  { label: string; icon: LucideIcon; color: string }
> = {
  "action.created": {
    label: "Criou a ação",
    icon: PlusIcon,
    color: "text-success",
  },
  "action.updated": {
    label: "Atualizou a ação",
    icon: Settings2Icon,
    color: "text-info",
  },
  "action.moved": {
    label: "Moveu a ação",
    icon: ArrowRightIcon,
    color: "text-info",
  },
  "action.archived": {
    label: "Arquivou a ação",
    icon: ArchiveIcon,
    color: "text-warning",
  },
  "action.unarchived": {
    label: "Restaurou a ação",
    icon: RefreshCcwIcon,
    color: "text-success",
  },
  "action.done_changed": {
    label: "Alterou status",
    icon: CheckCircle2Icon,
    color: "text-info",
  },
  "action.checklist_added": {
    label: "Adicionou item no checklist",
    icon: ListChecksIcon,
    color: "text-success",
  },
  "action.checklist_updated": {
    label: "Editou item do checklist",
    icon: Edit3Icon,
    color: "text-info",
  },
};
export const FIELD_LABELS: Record<string, string> = {
  title: "Título",
  description: "Descrição",
  priority: "Prioridade",
  dueDate: "Data de entrega",
  startDate: "Data de inicial",
  isDone: "Conclusão",
  columnId: "Coluna",
  workspaceId: "Workspace",
  isArchived: "Arquivamento",
  isFavorited: "Favorito",
  attachments: "Anexos",
  links: "Links",
  youtubeUrl: "URL do YouTube",
  finishDate: "Data de conclusão",
};
