import { z } from "zod";
import { AI_CREDIT_PROVIDERS } from "./ai-credit-types";

/** Lançamento de crédito vindo das telas (spec 0055, RF-1). */
export const aiCreditEntryInputSchema = z.object({
  provider: z.enum(AI_CREDIT_PROVIDERS),
  kind: z.enum(["TOPUP", "BALANCE_SNAPSHOT", "FREE_TIER"]),
  amountUsd: z.number().min(0).max(1_000_000),
  effectiveAt: z.string().datetime().optional(),
  note: z.string().trim().max(200).optional(),
});

export type AiCreditEntryInput = z.infer<typeof aiCreditEntryInputSchema>;
