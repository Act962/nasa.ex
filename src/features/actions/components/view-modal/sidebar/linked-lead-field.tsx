import Link from "next/link";
import { UserIcon, ArrowUpRightIcon } from "lucide-react";
import { SidebarField } from "./sidebar-field";
import { Action } from "../../../types";
import { phoneMaskFull } from "@/utils/format-phone";

interface LinkedLeadFieldProps {
  lead: NonNullable<Action["lead"]>;
}

// Mostra o lead vinculado à action (1:N via Action.leadId) com atalho para o
// painel do lead. Só é renderizado quando `action.lead` existe.
export function LinkedLeadField({ lead }: LinkedLeadFieldProps) {
  return (
    <SidebarField label="Lead vinculado" icon={<UserIcon className="size-3" />}>
      <Link
        href={`/contatos/${lead.id}`}
        className="group flex items-center gap-2 rounded-md border border-input bg-transparent px-2 py-1.5 transition-colors hover:bg-accent dark:bg-input/30 dark:hover:bg-input/50"
      >
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-xs font-medium">{lead.name}</span>
          {lead.phone && (
            <span className="truncate text-[11px] text-muted-foreground">
              {phoneMaskFull(lead.phone)}
            </span>
          )}
        </div>
        <ArrowUpRightIcon className="ml-auto size-3.5 shrink-0 text-muted-foreground group-hover:text-foreground" />
      </Link>
    </SidebarField>
  );
}
