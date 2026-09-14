"use client";

import { cn } from "@/lib/utils";

/** Campo de formulário do wizard — rótulo, controle e dica, com um só espaçamento. */
export function Field({
  label,
  required,
  hint,
  wide,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(wide && "sm:col-span-2")}>
      <label className="text-xs font-medium text-white/55">
        {label}
        {required && <span className="ml-0.5 text-violet-300">*</span>}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1.5 text-[11px] leading-snug text-white/30">{hint}</p>}
    </div>
  );
}

export const fieldClass =
  "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-violet-400/60";
