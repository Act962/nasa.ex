"use client";

import { useConstructUrl } from "@/hooks/use-construct-url";
import { Package } from "lucide-react";

export function ProductImage({ imageKey }: { imageKey: string | null }) {
  const url = useConstructUrl(imageKey ?? "");
  
  if (!imageKey) {
    return (
      <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
        <Package className="size-3.5 text-muted-foreground" />
      </div>
    );
  }
  
  return <img src={url} alt="" className="w-8 h-8 rounded object-cover border" />;
}
