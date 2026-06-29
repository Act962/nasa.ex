import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Eye, Plus, PenLine, Trash2 } from "lucide-react";

export const ROLE_META: Record<
  string,
  {
    label: string;
    color: string;
    bg: string;
    border: string;
    description: string;
  }
> = {
  owner: {
    label: "Master",
    color: "text-violet-700 dark:text-violet-300",
    bg: "bg-violet-100 dark:bg-violet-900/40",
    border: "border-violet-300 dark:border-violet-700",
    description: "Acesso total. Criador da conta.",
  },
  admin: {
    label: "Adm",
    color: "text-blue-700 dark:text-blue-300",
    bg: "bg-blue-100 dark:bg-blue-900/40",
    border: "border-blue-300 dark:border-blue-700",
    description: "Permissões intermediárias.",
  },
  member: {
    label: "Single",
    color: "text-slate-700 dark:text-slate-300",
    bg: "bg-slate-100 dark:bg-slate-900/40",
    border: "border-slate-300 dark:border-slate-700",
    description: "Acesso limitado ao que o Master autorizar.",
  },
  moderador: {
    label: "Moderador",
    color: "text-orange-700 dark:text-orange-300",
    bg: "bg-orange-100 dark:bg-orange-900/40",
    border: "border-orange-300 dark:border-orange-700",
    description: "Modera usuários e acessa múltiplas contas.",
  },
};

export const PERM_KEYS = ["canView", "canCreate", "canEdit", "canDelete"] as const;

export const PERM_LABELS: Record<
  string,
  { label: string; icon: React.FC<{ className?: string }> }
> = {
  canView: { label: "Ver", icon: Eye },
  canCreate: { label: "Criar", icon: Plus },
  canEdit: { label: "Editar", icon: PenLine },
  canDelete: { label: "Excluir", icon: Trash2 },
};

export function RoleBadge({
  role,
  size = "sm",
}: {
  role: string;
  size?: "xs" | "sm";
}) {
  const meta = ROLE_META[role];
  if (!meta) return <Badge variant="outline">{role}</Badge>;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-semibold",
        meta.color,
        meta.bg,
        meta.border,
        size === "xs" ? "px-1.5 py-0 text-[10px]" : "px-2 py-0.5 text-xs",
      )}
    >
      {meta.label}
    </span>
  );
}

export function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
