"use client";

import {
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { DownloadIcon, FileIcon, FileTextIcon } from "lucide-react";
import type { ExportFormat } from "../lib/export-conversation";

interface Props {
  onExport: (format: ExportFormat) => void;
  isPending: boolean;
}

const FORMAT_OPTIONS: {
  value: ExportFormat;
  label: string;
  icon: typeof FileIcon;
}[] = [
  { value: "pdf", label: "PDF", icon: FileIcon },
  { value: "txt", label: "TXT", icon: FileTextIcon },
];

/**
 * Submenu "Exportar conversa" do menu "..." do cabeçalho. Só apresentação —
 * a mutation vive no Header (sempre montado); selecionar um item fecha o menu
 * e desmontaria este componente, e os callbacks do `mutate` não disparariam.
 */
export function ExportConversationMenu({ onExport, isPending }: Props) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger disabled={isPending}>
        <DownloadIcon className="size-4" />
        Exportar conversa
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        {FORMAT_OPTIONS.map((option) => {
          const Icon = option.icon;
          return (
            <DropdownMenuItem
              key={option.value}
              onClick={() => onExport(option.value)}
              disabled={isPending}
            >
              <Icon className="size-4" />
              {option.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
