"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LeadFull } from "@/types/lead";
import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";

interface LeadInfoProps extends React.ComponentProps<"div"> {
  initialData: LeadFull;
}

export function LeadInfo({ initialData, className, ...rest }: LeadInfoProps) {
  const router = useRouter();

  return (
    <div
      className={cn("w-64 h-full bg-sidebar border-r px-4", className)}
      {...rest}
    >
      <div className="hidden sm:flex items-center gap-2 mt-3">
        <Button
          size={"icon-xs"}
          variant={"outline"}
          onClick={() => router.back()}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-xs font-medium">Voltar</span>
      </div>

      <div>Lead Info</div>
    </div>
  );
}
