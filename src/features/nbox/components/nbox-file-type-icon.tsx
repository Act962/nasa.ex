import {
  FileCheckIcon as FileContractIcon,
  FileIcon,
  FilePenIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  ImageIcon,
  Link2Icon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { NBoxItemType } from "@/generated/prisma/enums";

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function FileTypeIcon({
  type,
  mimeType,
  className,
}: {
  type: NBoxItemType;
  mimeType?: string | null;
  className?: string;
}) {
  const iconClassName = cn("shrink-0", className);
  if (type === "IMAGE") return <ImageIcon className={cn(iconClassName, "text-pink-500")} />;
  if (type === "LINK") return <Link2Icon className={cn(iconClassName, "text-blue-500")} />;
  if (type === "CONTRACT") return <FilePenIcon className={cn(iconClassName, "text-emerald-600")} />;
  if (type === "PROPOSAL") return <FileContractIcon className={cn(iconClassName, "text-purple-600")} />;
  if (mimeType?.includes("pdf")) return <FileTextIcon className={cn(iconClassName, "text-red-500")} />;
  if (mimeType?.includes("spreadsheet") || mimeType?.includes("excel") || mimeType?.includes("csv")) {
    return <FileSpreadsheetIcon className={cn(iconClassName, "text-green-600")} />;
  }
  return <FileIcon className={cn(iconClassName, "text-slate-400")} />;
}
