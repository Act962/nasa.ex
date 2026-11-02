"use client";

import { ShieldCheck } from "lucide-react";
import { META_AD_TEXT_RULES } from "@/features/trafego/lib/meta-ad-rules";

/** Regras da Meta junto do campo de texto (spec 0130, RF-2). Fixo, sem IA. */
export function MetaAdRulesGuide() {
  return (
    <details className="group rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/60">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 font-medium text-white/75">
        <ShieldCheck className="size-3.5 text-success" />
        Regras da Meta para o texto
        <span className="ml-auto text-white/35 group-open:hidden">ver</span>
      </summary>
      <ul className="mt-2 space-y-1">
        {META_AD_TEXT_RULES.map((rule) => (
          <li key={rule} className="flex gap-2">
            <span className="mt-1.5 size-1 shrink-0 rounded-full bg-white/30" />
            {rule}
          </li>
        ))}
      </ul>
    </details>
  );
}
