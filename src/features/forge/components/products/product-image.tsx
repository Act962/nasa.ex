"use client";

import { useConstructUrl } from "@/hooks/use-construct-url";
import { cn } from "@/lib/utils";
import { Package } from "lucide-react";

interface ProductImageProps {
  imageKey: string | null;
  className?: string;
  iconClassName?: string;
}

export function ProductImage({ imageKey, className, iconClassName }: ProductImageProps) {
  const url = useConstructUrl(imageKey ?? "");

  if (!imageKey) {
    return (
      <div className={cn("w-8 h-8 rounded bg-muted flex items-center justify-center", className)}>
        <Package className={cn("size-3.5 text-muted-foreground", iconClassName)} />
      </div>
    );
  }

  return <img src={url} alt="" className={cn("w-8 h-8 rounded object-cover border", className)} />;
}
