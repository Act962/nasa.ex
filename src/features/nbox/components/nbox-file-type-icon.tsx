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
  if (type === "IMAGE") return <ImageIcon className={cn(iconClassName, "text-temp-hot")} />;
  if (type === "LINK") return <Link2Icon className={cn(iconClassName, "text-info")} />;
  if (type === "CONTRACT") return <FilePenIcon className={cn(iconClassName, "text-success")} />;
  if (type === "PROPOSAL") return <FileContractIcon className={cn(iconClassName, "text-chart-4")} />;
  if (mimeType?.includes("pdf")) return <FileTextIcon className={cn(iconClassName, "text-destructive")} />;
  if (mimeType?.includes("spreadsheet") || mimeType?.includes("excel") || mimeType?.includes("csv")) {
    return <FileSpreadsheetIcon className={cn(iconClassName, "text-success")} />;
  }
  return <FileIcon className={cn(iconClassName, "text-muted-foreground")} />;
}
