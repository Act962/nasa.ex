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
              ? "border-violet-500 bg-violet-500/10 text-violet-600 dark:text-violet-400"
              : "border-border text-muted-foreground hover:border-violet-300",
          )}
        >
          {FORMAT_DIMENSIONS[fmt].label}
        </button>
      ))}
    </div>
  );
}
