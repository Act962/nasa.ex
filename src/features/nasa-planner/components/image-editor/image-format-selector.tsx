"use client";

import { cn } from "@/lib/utils";
import { type ImageFormat, FORMAT_DIMENSIONS } from "./use-image-editor";

interface Props {
  value: ImageFormat;
  onChange: (f: ImageFormat) => void;
}

export function ImageFormatSelector({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {(Object.keys(FORMAT_DIMENSIONS) as ImageFormat[]).map((fmt) => (
        <button
          key={fmt}
          type="button"
          onClick={() => onChange(fmt)}
          className={cn(
            "px-2.5 py-1 text-xs font-medium rounded-full border transition-colors",
            value === fmt
              ? "border-info bg-info/10 text-info"
              : "border-border text-muted-foreground hover:border-info/40",
          )}
        >
          {FORMAT_DIMENSIONS[fmt].label}
        </button>
      ))}
    </div>
  );
}
