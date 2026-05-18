import { z } from "zod";

// Espelha `Organization` do Prisma do nerp. Mantemos `passthrough` para não
// quebrar quando o nerp adicionar campos novos (plano, status, endereço,
// limites, etc.) — o servidor devolve o objeto inteiro do Prisma.
export const nerpOrgSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    slug: z.string().optional(),
    logo: z.string().optional().nullable(),
    metadata: z.string().optional().nullable(),
    tradeName: z.string().optional().nullable(),
    document: z.string().optional().nullable(),
    email: z.string().email().optional().nullable(),
    phone: z.string().optional().nullable(),
    subdomain: z.string().optional().nullable(),
    customDomain: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    state: z.string().optional().nullable(),
    zipCode: z.string().optional().nullable(),
    country: z.string().optional(),
    primaryColor: z.string().optional(),
    plan: z.string().optional(),
    status: z.string().optional(),
    createdAt: z.union([z.string(), z.date()]).optional(),
    updatedAt: z.union([z.string(), z.date()]).optional(),
  })
  .passthrough();

export type NerpOrg = z.infer<typeof nerpOrgSchema>;

export const getNerpOrgInputSchema = z.object({}).optional();
export const getNerpOrgOutputSchema = z.object({ organization: nerpOrgSchema });

// Subdomínios reservados pelo nerp (espelhamos pra rejeitar localmente antes
// mesmo de chamar o servidor — feedback instantâneo no formulário).
export const RESERVED_NERP_SUBDOMAINS = [
  "www",
  "api",
  "admin",
  "app",
  "mail",
  "ftp",
  "smtp",
  "pop",
  "imap",
  "blog",
  "store",
  "shop",
] as const;

// Regex idêntica à do nerp em `subdomainSchema`. 3-63 chars, começa/termina
// com alfanumérico, hífens permitidos no meio.
export const nerpSubdomainSchema = z
  .string()
  .min(3, "O subdomínio deve ter pelo menos 3 caracteres")
  .max(63, "O subdomínio deve ter no máximo 63 caracteres")
  .regex(
    /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/,
    "Use apenas letras minúsculas, números e hífens (não pode começar ou terminar com hífen)",
  )
  .refine(
    (v) => !RESERVED_NERP_SUBDOMAINS.includes(v as (typeof RESERVED_NERP_SUBDOMAINS)[number]),
    "Este subdomínio está reservado",
  );

export const checkSubdomainInputSchema = z.object({
  subdomain: nerpSubdomainSchema,
});
export const checkSubdomainOutputSchema = z.object({
  available: z.boolean(),
  message: z.string().optional(),
});

export const updateSubdomainInputSchema = z.object({
  subdomain: nerpSubdomainSchema,
});
export const updateSubdomainOutputSchema = z.object({
  organizationId: z.string(),
  subdomain: z.string(),
});
