"use client";

import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function SettingsCard({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{title}</h2>
          {description && (
            <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {action}
      </header>
      <div className="px-5 py-5">{children}</div>
    </section>
  );
}

/** Divisória interna: junta assuntos vizinhos sem separá-los em outro card. */
export function SettingsDivider({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="sm:col-span-2">
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold tracking-wide text-foreground/80 uppercase">
          {title}
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>
      {description && (
        <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  );
}

export function SettingsGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">{children}</div>;
}

export function SettingsField({
  label,
  hint,
  wide,
  action,
  children,
}: {
  label: string;
  hint?: string;
  wide?: boolean;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("min-w-0", wide && "sm:col-span-2")}>
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs font-medium">{label}</Label>
        {action}
      </div>
      <div className="mt-1.5">{children}</div>
      {hint && (
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

export function SettingsNotice({
  tone,
  children,
}: {
  tone: "ok" | "warn" | "info";
  children: React.ReactNode;
}) {
  const Icon = tone === "ok" ? CheckCircle2 : tone === "warn" ? AlertTriangle : Info;

  return (
    <p
      className={cn(
        "flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs leading-relaxed sm:col-span-2",
        tone === "ok" &&
          "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400",
        tone === "warn" &&
          "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400",
        tone === "info" && "bg-muted/40 text-muted-foreground",
      )}
    >
      <Icon className="mt-0.5 size-3.5 shrink-0" />
      <span className="min-w-0">{children}</span>
    </p>
  );
}
