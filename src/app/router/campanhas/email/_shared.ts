import { z } from "zod";

export const MAX_EMAIL_RECIPIENTS = 5_000;

export const emailTemplateInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  subject: z.string().trim().min(1).max(200),
  previewText: z.string().trim().max(200).nullish(),
  bodyJson: z.record(z.string(), z.unknown()),
});
