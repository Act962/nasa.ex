import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import {
  emitirNfse,
  consultarNfse,
  cancelarNfse,
} from "@/http/focus-nfe/operations";
import {
  buildNfsePayload,
  validateBeforeEmit,
} from "@/http/focus-nfe/build-nfse-payload";
import { FocusNfeHttpError } from "@/http/focus-nfe/client";
import type {
  FiscalEnvironment,
  FiscalInvoiceStatus,
} from "@/generated/prisma/enums";

function focusStatusToDb(focusStatus: string): FiscalInvoiceStatus {
  switch (focusStatus) {
    case "autorizado":
      return "AUTORIZADO";
    case "erro_autorizacao":
      return "ERRO";
    case "cancelado":
      return "CANCELADO";
    default:
      return "PROCESSANDO";
  }
}

export const issueFiscalInvoice = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Issue NFS-e from contract",
    tags: ["Fiscal"],
  })
  .input(
    z.object({
      contractId: z.string(),
      tipoTomador: z.enum(["PF", "PJ"]),
      dataCompetencia: z.string(),
      tomadorCnpj: z.string().optional(),
      tomadorCpf: z.string().optional(),
      tomadorRazaoSocial: z.string().optional(),
      tomadorNome: z.string().optional(),
      tomadorEmail: z.string().optional(),
      tomadorLogradouro: z.string().optional(),
      tomadorNumero: z.string().optional(),
      tomadorComplemento: z.string().optional(),
      tomadorBairro: z.string().optional(),
      tomadorCodigoMunicipio: z.string().optional(),
      tomadorUf: z.string().optional(),
      tomadorCep: z.string().optional(),
      discriminacao: z.string().optional(),
    }),
  )
  .output(
    z.object({ invoiceId: z.string(), status: z.string(), ref: z.string() }),
  )
  .handler(async ({ input, context, errors }) => {
    const contract = await prisma.forgeContract.findUnique({
      where: { id: input.contractId, organizationId: context.org.id },
    });
    if (!contract)
      throw errors.NOT_FOUND({ message: "Contrato não encontrado" });

    const profile = await prisma.fiscalCompanyProfile.findUnique({
      where: { organizationId: context.org.id },
    });
    if (!profile)
      throw errors.BAD_REQUEST({
        message: "Perfil fiscal não configurado para esta organização",
      });

    const activeInvoice = await prisma.fiscalInvoice.findFirst({
      where: {
        contractId: input.contractId,
        status: { in: ["PROCESSANDO", "AUTORIZADO"] },
      },
    });
    if (activeInvoice) {
      throw errors.BAD_REQUEST({
        message: "Já existe uma nota fiscal ativa para este contrato",
      });
    }

    const overrides = {
      tipoTomador: input.tipoTomador as "PF" | "PJ",
      dataCompetencia: new Date(input.dataCompetencia),
      discriminacao: input.discriminacao,
      tomadorCnpj: input.tomadorCnpj,
      tomadorCpf: input.tomadorCpf,
      tomadorRazaoSocial: input.tomadorRazaoSocial,
      tomadorNome: input.tomadorNome,
      tomadorEmail: input.tomadorEmail,
      tomadorLogradouro: input.tomadorLogradouro,
      tomadorNumero: input.tomadorNumero,
      tomadorComplemento: input.tomadorComplemento,
      tomadorBairro: input.tomadorBairro,
      tomadorCodigoMunicipio: input.tomadorCodigoMunicipio,
      tomadorUf: input.tomadorUf,
      tomadorCep: input.tomadorCep,
    };

    const preflight = validateBeforeEmit(contract, profile, overrides);
    if (!preflight.valid) {
      throw errors.BAD_REQUEST({ message: preflight.errors.join("; ") });
    }

    const invoiceCount = await prisma.fiscalInvoice.count({
      where: { contractId: contract.id },
    });
    const ref = `forge-${contract.id}-${invoiceCount + 1}`;

    const payload = buildNfsePayload(contract, profile, overrides);
    let focusResponse;
    try {
      focusResponse = await emitirNfse(
        ref,
        payload,
        profile.environment as FiscalEnvironment,
      );
    } catch (err) {
      if (err instanceof FocusNfeHttpError) {
        throw errors.BAD_REQUEST({ message: `Focus NFe: ${err.message}` });
      }
      throw errors.INTERNAL_SERVER_ERROR;
    }

    const dbStatus = focusStatusToDb(focusResponse.status);
    const isAuthorized = dbStatus === "AUTORIZADO";

    const tomadorSnapshot =
      input.tipoTomador === "PJ"
        ? {
            tipo: "PJ",
            cnpj: input.tomadorCnpj,
            razaoSocial: input.tomadorRazaoSocial,
          }
        : { tipo: "PF", cpf: input.tomadorCpf, nome: input.tomadorNome };

    const invoice = await prisma.fiscalInvoice.create({
      data: {
        organizationId: context.org.id,
        profileId: profile.id,
        contractId: contract.id,
        ref,
        type: "NFSE",
        status: dbStatus,
        environment: profile.environment as FiscalEnvironment,
        valorServicos: contract.value,
        aliquotaIss: profile.defaultAliquotaIss,
        issRetido: profile.defaultIssRetido,
        dataCompetencia: overrides.dataCompetencia,
        requestPayload: payload as never,
        focusResponse: focusResponse as never,
        tomadorSnapshot: tomadorSnapshot as never,
        tipoTomador: input.tipoTomador as "PF" | "PJ",
        issuedById: context.user.id,
        ...(isAuthorized && {
          numero: focusResponse.numero,
          codigoVerificacao: focusResponse.codigo_verificacao,
          urlEspelho: focusResponse.url,
          urlDanfse: focusResponse.url_danfse,
          caminhoXmlFocus: focusResponse.caminho_xml_nota_fiscal,
          authorizedAt: new Date(),
        }),
        errorMessage:
          dbStatus === "ERRO" ? (focusResponse.mensagem_erro ?? null) : null,
      },
    });

    return { invoiceId: invoice.id, status: invoice.status, ref: invoice.ref };
  });

export const listFiscalInvoicesByContract = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "List fiscal invoices by contract",
    tags: ["Fiscal"],
  })
  .input(z.object({ contractId: z.string() }))
  .output(z.object({ invoices: z.array(z.any()) }))
  .handler(async ({ input, context, errors }) => {
    try {
      const invoices = await prisma.fiscalInvoice.findMany({
        where: { contractId: input.contractId, organizationId: context.org.id },
        orderBy: { createdAt: "desc" },
      });
      return {
        invoices: invoices.map((invoice) => ({
          ...invoice,
          valorServicos: invoice.valorServicos.toString(),
          aliquotaIss: invoice.aliquotaIss.toString(),
        })),
      };
    } catch {
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

export const getFiscalInvoice = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", summary: "Get fiscal invoice", tags: ["Fiscal"] })
  .input(z.object({ id: z.string() }))
  .output(z.object({ invoice: z.any() }))
  .handler(async ({ input, context, errors }) => {
    const invoice = await prisma.fiscalInvoice.findUnique({
      where: { id: input.id, organizationId: context.org.id },
    });
    if (!invoice)
      throw errors.NOT_FOUND({ message: "Nota fiscal não encontrada" });
    return {
      invoice: {
        ...invoice,
        valorServicos: invoice.valorServicos.toString(),
        aliquotaIss: invoice.aliquotaIss.toString(),
      },
    };
  });

export const refreshFiscalInvoiceStatus = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Refresh fiscal invoice status from Focus",
    tags: ["Fiscal"],
  })
  .input(z.object({ id: z.string() }))
  .output(z.object({ status: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const invoice = await prisma.fiscalInvoice.findUnique({
      where: { id: input.id, organizationId: context.org.id },
    });
    if (!invoice)
      throw errors.NOT_FOUND({ message: "Nota fiscal não encontrada" });
    if (invoice.status !== "PROCESSANDO") return { status: invoice.status };

    let focusData;
    try {
      focusData = await consultarNfse(
        invoice.ref,
        invoice.environment as FiscalEnvironment,
      );
    } catch (err) {
      if (err instanceof FocusNfeHttpError) {
        throw errors.BAD_REQUEST({ message: `Focus NFe: ${err.message}` });
      }
      throw errors.INTERNAL_SERVER_ERROR;
    }

    const dbStatus = focusStatusToDb(focusData.status);
    const isAuthorized = dbStatus === "AUTORIZADO";

    await prisma.fiscalInvoice.update({
      where: { id: invoice.id },
      data: {
        status: dbStatus,
        focusResponse: focusData as never,
        ...(isAuthorized && {
          numero: focusData.numero,
          codigoVerificacao: focusData.codigo_verificacao,
          urlEspelho: focusData.url,
          urlDanfse: focusData.url_danfse,
          caminhoXmlFocus: focusData.caminho_xml_nota_fiscal,
          authorizedAt: new Date(),
        }),
        errorMessage:
          dbStatus === "ERRO" ? (focusData.mensagem_erro ?? null) : null,
      },
    });

    return { status: dbStatus };
  });

export const cancelFiscalInvoice = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Cancel fiscal invoice", tags: ["Fiscal"] })
  .input(z.object({ id: z.string(), justificativa: z.string().min(15) }))
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    const invoice = await prisma.fiscalInvoice.findUnique({
      where: { id: input.id, organizationId: context.org.id },
    });
    if (!invoice)
      throw errors.NOT_FOUND({ message: "Nota fiscal não encontrada" });
    if (invoice.status !== "AUTORIZADO") {
      throw errors.BAD_REQUEST({
        message: "Apenas notas autorizadas podem ser canceladas",
      });
    }

    try {
      await cancelarNfse(
        invoice.ref,
        input.justificativa,
        invoice.environment as FiscalEnvironment,
      );
    } catch (err) {
      if (err instanceof FocusNfeHttpError) {
        throw errors.BAD_REQUEST({ message: `Focus NFe: ${err.message}` });
      }
      throw errors.INTERNAL_SERVER_ERROR;
    }

    await prisma.fiscalInvoice.update({
      where: { id: invoice.id },
      data: { status: "CANCELADO" },
    });

    return { ok: true };
  });
