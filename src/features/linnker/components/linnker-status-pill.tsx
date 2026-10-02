import { cn } from "@/lib/utils";

export function LinnkerStatusPill({ isPublished, className }: { isPublished: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
        isPublished
          ? "border-success/30 bg-success/15 text-success"
          : "border-line bg-background/90 text-muted-foreground",
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", isPublished ? "bg-success" : "bg-muted-foreground")} />
      {isPublished ? "Publicada" : "Rascunho"}
    </span>
  );
}
