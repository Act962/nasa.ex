import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import {
  consultarEmpresa,
  cadastrarEmpresa,
} from "@/http/focus-nfe/operations";
import { FocusNfeHttpError } from "@/http/focus-nfe/client";
import type { FiscalEnvironment } from "@/generated/prisma/enums";

const fiscalProfileShape = z.object({
  id: z.string(),
  organizationId: z.string(),
  cnpj: z.string(),
  razaoSocial: z.string(),
  inscricaoMunicipal: z.string(),
  codigoMunicipio: z.string(),
  optanteSimplesNacional: z.boolean(),
  regimeEspecialTributacao: z.string().nullable(),
  logradouro: z.string(),
  numero: z.string(),
  complemento: z.string().nullable(),
  bairro: z.string(),
  cep: z.string(),
  uf: z.string(),
  defaultItemListaServico: z.string(),
  defaultAliquotaIss: z.string(),
  defaultIssRetido: z.boolean(),
  defaultDiscriminacao: z.string().nullable(),
  environment: z.string(),
  focusEmpresaRegistered: z.boolean(),
  supportedByFocus: z.boolean(),
  focusCertificadoUploadedAt: z.date().nullable(),
});

export const fiscalProfileGet = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", summary: "Get fiscal profile", tags: ["Fiscal"] })
  .input(z.object({}))
  .handler(async ({ context, errors }) => {
    try {
      const profile = await prisma.fiscalCompanyProfile.findUnique({
        where: { organizationId: context.org.id },
      });
      return {
        profile: profile
          ? {
              ...profile,
              defaultAliquotaIss: profile.defaultAliquotaIss.toString(),
            }
          : null,
      };
    } catch {
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

const upsertProfileInput = z.object({
  cnpj: z.string(),
  razaoSocial: z.string(),
  inscricaoMunicipal: z.string(),
  codigoMunicipio: z
    .string()
    .regex(/^\d{7}$/, "Código IBGE deve ter 7 dígitos"),
  optanteSimplesNacional: z.boolean(),
  regimeEspecialTributacao: z.string().nullable().optional(),
  logradouro: z.string(),
  numero: z.string(),
  complemento: z.string().optional(),
  bairro: z.string(),
  cep: z.string(),
  uf: z.string().length(2),
  defaultItemListaServico: z.string(),
  defaultAliquotaIss: z.string(),
  defaultIssRetido: z.boolean(),
  defaultDiscriminacao: z.string().optional(),
  environment: z.enum(["HOMOLOGACAO", "PRODUCAO"]),
  supportedByFocus: z.boolean(),
});

export const fiscalProfileUpsert = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Upsert fiscal profile", tags: ["Fiscal"] })
  .input(upsertProfileInput)
  .output(z.object({ ok: z.boolean(), focusEmpresaRegistered: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    try {
      const environment = input.environment as FiscalEnvironment;
      let focusEmpresaRegistered = false;

      try {
        await consultarEmpresa(input.cnpj, environment);
        focusEmpresaRegistered = true;
      } catch (err) {
        if (err instanceof FocusNfeHttpError && err.status === 404) {
          // Empresa não existe na Focus — cadastrar automaticamente
          try {
            await cadastrarEmpresa(
              {
                cnpj: input.cnpj.replace(/\D/g, ""),
                nome: input.razaoSocial,
                inscricao_municipal: input.inscricaoMunicipal,
                regime_tributario: input.optanteSimplesNacional ? 1 : 3,
                optante_simples_nacional: input.optanteSimplesNacional,
                endereco: {
                  logradouro: input.logradouro,
                  numero: input.numero,
                  complemento: input.complemento,
                  bairro: input.bairro,
                  cep: input.cep.replace(/\D/g, ""),
                  codigo_municipio: input.codigoMunicipio,
                  uf: input.uf,
                },
              },
              environment,
            );
            focusEmpresaRegistered = true;
          } catch (cadastroErr) {
            // Falha no cadastro — não bloqueia o save local, mas reporta
            if (cadastroErr instanceof FocusNfeHttpError) {
              throw errors.BAD_REQUEST({
                message: `Erro ao cadastrar empresa na Focus: ${cadastroErr.message}`,
              });
            }
            throw cadastroErr;
          }
        } else {
          throw err;
        }
      }

      await prisma.fiscalCompanyProfile.upsert({
        where: { organizationId: context.org.id },
        create: {
          organizationId: context.org.id,
          ...input,
          focusEmpresaRegistered,
        },
        update: {
          ...input,
          focusEmpresaRegistered,
        },
      });

      return { ok: true, focusEmpresaRegistered };
    } catch (err) {
      if (err instanceof FocusNfeHttpError) {
        throw errors.BAD_REQUEST({
          message: `Erro ao verificar empresa na Focus: ${err.message}`,
        });
      }
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
