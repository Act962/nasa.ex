"use client";

import { forwardRef } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SearchPillProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}

/** Busca em pílula: largura toda no celular, limitada no computador. */
export const SearchPill = forwardRef<HTMLInputElement, SearchPillProps>(function SearchPill(
  { value, onChange, placeholder, className },
  ref,
) {
  return (
    <div className={cn("relative w-full md:max-w-sm", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={ref}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-11 rounded-full pl-10 md:h-10"
      />
    </div>
  );
});
