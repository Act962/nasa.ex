import type { CSSProperties } from "react";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { instructionChecklist } from "../lib/guide-helpers";
import { GuideTermsText } from "./guide-terms-text";

const SHINE_STEP_SECONDS = 0.9;

/** Instrução do passo em ações curtas, com uma luz que desce de item em item. */
export function InstructionChecklist({ instruction, className }: { instruction: string; className?: string }) {
  const items = instructionChecklist(instruction);
  const cycleSeconds = Math.max(7, items.length * SHINE_STEP_SECONDS + 3.5);
  const timing = (index: number): CSSProperties => ({
    animationDelay: `${index * SHINE_STEP_SECONDS}s`,
    animationDuration: `${cycleSeconds}s`,
  });
  return (
    <ul className={cn("space-y-2.5", className)}>
      {items.map((item, index) => (
        <li key={`${index}-${item}`} className="flex items-start gap-2.5 text-sm leading-relaxed">
          <CheckCircle2 className="guide-shine-icon mt-0.5 size-4 shrink-0 text-success" style={timing(index)} />
          <span className="guide-shine-text" style={timing(index)}>
            <GuideTermsText text={item} />
          </span>
        </li>
      ))}
    </ul>
  );
}
