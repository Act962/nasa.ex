"use client";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Pencil } from "lucide-react";

interface InfoItemProps {
  label: string;
  value: React.ReactNode;
  displayValue?: string;
  isEditing?: boolean;
  onEditClick?: () => void;
  loading?: boolean;
  editable?: boolean;
  editComponent?: React.ReactNode;
}

export function InfoItem({
  label,
  value,
  displayValue,
  isEditing,
  onEditClick,
  loading,
  editable,
  editComponent,
}: InfoItemProps) {
  if (loading) {
    return (
      <div className="flex flex-col w-full gap-1">
        <Skeleton className="w-full h-4 rounded-sm" />
        <Skeleton className="w-20 h-4 rounded-sm" />
      </div>
    );
  }

  const tooltipContent =
    displayValue || (typeof value === "string" ? value : null);

  return (
    <div className="flex flex-col gap-1 w-full group">
      <span className="text-xs font-medium opacity-50">{label}</span>

      {!isEditing ? (
        <div className="flex items-center min-h-8 w-full gap-2">
          <div className="flex-1 min-w-0">
            <Tooltip delayDuration={500}>
              <TooltipTrigger asChild>
                <div className="text-sm font-medium truncate">{value}</div>
              </TooltipTrigger>
              {tooltipContent && (
                <TooltipContent side="right">
                  <p>{tooltipContent}</p>
                </TooltipContent>
              )}
            </Tooltip>
          </div>

          {editable && (
            <Button
              variant="ghost"
              size="icon-xs"
              className="opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              onClick={onEditClick}
            >
              <Pencil className="size-3" />
            </Button>
          )}
        </div>
      ) : (
        <div className="flex items-center min-h-8 w-full">{editComponent}</div>
      )}
    </div>
  );
}
