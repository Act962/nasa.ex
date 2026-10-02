"use client";

import { useConstructUrl } from "@/hooks/use-construct-url";
import { cn } from "@/lib/utils";

type Variant = "dark" | "light";

interface Person {
  name: string;
  imageKey?: string | null;
}

function Avatar({
  name,
  imageKey,
  variant,
}: {
  name: string;
  imageKey?: string | null;
  variant: Variant;
}) {
  const url = imageKey ? useConstructUrl(imageKey) : null;
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const fallbackCls =
    variant === "dark"
      ? "bg-card text-foreground border-line"
      : "bg-muted text-foreground border-line";

  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className="size-14 rounded-full object-cover border-2 border-white/20 shadow-md"
      />
    );
  }
  return (
    <div
      className={cn(
        "size-14 rounded-full flex items-center justify-center font-bold text-sm border-2 shadow-md",
        fallbackCls,
      )}
    >
      {initials || "?"}
    </div>
  );
}

export function IdentityBlock({
  responsible,
  client,
  variant = "dark",
}: {
  responsible?: Person | null;
  client?: Person | null;
  variant?: Variant;
}) {
  if (!responsible && !client) return null;

  const labelCls =
    variant === "dark"
      ? "text-muted-foreground text-xs uppercase tracking-widest"
      : "text-muted-foreground text-xs uppercase tracking-widest";
  const nameCls =
    variant === "dark" ? "text-white font-semibold" : "text-foreground font-semibold";
  const cardCls =
    variant === "dark"
      ? "bg-card/60 border border-line"
      : "bg-white border border-line";

  return (
    <div className="max-w-3xl mx-auto px-8 pb-8 forge-avoid-break">
      <div
        className={cn(
          "rounded-2xl p-5 grid gap-4 sm:grid-cols-2",
          cardCls,
        )}
      >
        {responsible && (
          <div className="flex items-center gap-3">
            <Avatar
              name={responsible.name}
              imageKey={responsible.imageKey}
              variant={variant}
            />
            <div className="min-w-0">
              <p className={labelCls}>Apresentado por</p>
              <p className={cn("text-base truncate", nameCls)}>
                {responsible.name}
              </p>
            </div>
          </div>
        )}
        {client && (
          <div className="flex items-center gap-3">
            <Avatar
              name={client.name}
              imageKey={client.imageKey}
              variant={variant}
            />
            <div className="min-w-0">
              <p className={labelCls}>Para</p>
              <p className={cn("text-base truncate", nameCls)}>{client.name}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
