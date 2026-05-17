import { z } from "zod";

export const nerpOrgSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string().optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  document: z.string().optional().nullable(),
  logoUrl: z.string().url().optional().nullable(),
  settings: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type NerpOrg = z.infer<typeof nerpOrgSchema>;

export const getNerpOrgInputSchema = z.object({}).optional();
export const getNerpOrgOutputSchema = z.object({ org: nerpOrgSchema });
