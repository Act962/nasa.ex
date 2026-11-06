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
  onSelectFormat: (format: ExportFormat) => void;
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
 * Submenu "Exportar" do menu "..." do cabeçalho. Escolher o formato abre o
 * dialog de opções (ExportConversationDialog), montado no Header.
 */
export function ExportConversationMenu({ onSelectFormat }: Props) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <DownloadIcon className="size-4" />
        Exportar
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        {FORMAT_OPTIONS.map((option) => {
          const Icon = option.icon;
          return (
            <DropdownMenuItem
              key={option.value}
              onClick={() => onSelectFormat(option.value)}
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
