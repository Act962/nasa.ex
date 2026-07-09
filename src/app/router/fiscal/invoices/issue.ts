import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { NfeError } from "nfe-io";
import { describeNfeIoError } from "@/lib/nfe-io";
import { FocusNfeHttpError } from "@/http/focus-nfe/client";
import type { FiscalEnvironment } from "@/generated/prisma/enums";
import {
  resolveGateway,
  type FiscalIssueOverrides,
} from "@/features/fiscal/lib/gateways";

dayjs.extend(utc);
dayjs.extend(timezone);

const TIMEZONE = "America/Sao_Paulo";

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
      tomadorMunicipio: z.string().optional(),
      tomadorUf: z.string().optional(),
      tomadorCep: z.string().optional(),
      discriminacao: z.string().optional(),
      naturezaOperacao: z.string().optional(),
      // enum da doc: 0=Nenhum,1,2,3,4,5,6,9.
      regimeEspecialTributacao: z.number().int().min(0).max(9).optional(),
      ibsCbsSituacaoTributaria: z.string().optional(),
      ibsCbsClassificacaoTributaria: z.string().optional(),
      consumidorFinal: z.boolean().optional(),
      cityServiceCode: z.string().optional(),
      taxationType: z.string().optional(),
      // Overrides financeiros por nota — percentuais (0–100) sobre o valor do serviço.
      issRetido: z.boolean().optional(),
      irPercent: z.number().min(0).max(100).optional(),
      pisPercent: z.number().min(0).max(100).optional(),
      cofinsPercent: z.number().min(0).max(100).optional(),
      csllPercent: z.number().min(0).max(100).optional(),
      inssPercent: z.number().min(0).max(100).optional(),
      outrasRetencoesPercent: z.number().min(0).max(100).optional(),
      deducoesPercent: z.number().min(0).max(100).optional(),
      descontoIncondicionadoPercent: z.number().min(0).max(100).optional(),
      descontoCondicionadoPercent: z.number().min(0).max(100).optional(),
      informacoesAdicionais: z.string().optional(),
      tomadorInscricaoMunicipal: z.string().optional(),
      environment: z.enum(["HOMOLOGACAO", "PRODUCAO"]).default("HOMOLOGACAO"),
    }),
  )
  .output(
    z.object({ invoiceId: z.string(), status: z.string(), ref: z.string() }),
  )
  .handler(async ({ input, context, errors }) => {
    let contract;
    try {
      contract = await prisma.forgeContract.findUnique({
        where: { id: input.contractId, organizationId: context.org.id },
      });
    } catch (err) {
      console.error("[fiscal/invoices/issue] erro ao buscar contrato:", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
    if (!contract)
      throw errors.NOT_FOUND({ message: "Contrato não encontrado" });

    let profile;
    try {
      profile = await prisma.fiscalCompanyProfile.findUnique({
        where: { organizationId: context.org.id },
      });
    } catch (err) {
      console.error(
        "[fiscal/invoices/issue] erro ao buscar perfil fiscal:",
        err,
      );
      throw errors.INTERNAL_SERVER_ERROR;
    }
    if (!profile)
      throw errors.BAD_REQUEST({
        message: "Perfil fiscal não configurado para esta organização",
      });

    let activeInvoice;
    try {
      activeInvoice = await prisma.fiscalInvoice.findFirst({
        where: {
          contractId: input.contractId,
          status: { in: ["PROCESSANDO", "AUTORIZADO"] },
        },
      });
    } catch (err) {
      console.error(
        "[fiscal/invoices/issue] erro ao verificar nota ativa:",
        err,
      );
      throw errors.INTERNAL_SERVER_ERROR;
    }
    if (activeInvoice) {
      throw errors.BAD_REQUEST({
        message: "Já existe uma nota fiscal ativa para este contrato",
      });
    }

    const overrides: FiscalIssueOverrides = {
      tipoTomador: input.tipoTomador as "PF" | "PJ",
      // Data enviada pelo dialog é "YYYY-MM-DD"; ancoramos explicitamente em
      // horário de Brasília em vez de deixar o parser nativo assumir meia-noite
      // UTC, que equivale a 21h do dia anterior em Brasília (data errada ao formatar).
      dataCompetencia: dayjs
        .tz(input.dataCompetencia, TIMEZONE)
        .startOf("day")
        .toDate(),
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
      tomadorMunicipio: input.tomadorMunicipio,
      tomadorUf: input.tomadorUf,
      tomadorCep: input.tomadorCep,
      naturezaOperacao: input.naturezaOperacao,
      regimeEspecialTributacao: input.regimeEspecialTributacao,
      ibsCbsSituacaoTributaria: input.ibsCbsSituacaoTributaria,
      ibsCbsClassificacaoTributaria: input.ibsCbsClassificacaoTributaria,
      consumidorFinal: input.consumidorFinal,
      cityServiceCode: input.cityServiceCode,
      taxationType: input.taxationType,
      issRetido: input.issRetido,
      irPercent: input.irPercent,
      pisPercent: input.pisPercent,
      cofinsPercent: input.cofinsPercent,
      csllPercent: input.csllPercent,
      inssPercent: input.inssPercent,
      outrasRetencoesPercent: input.outrasRetencoesPercent,
      deducoesPercent: input.deducoesPercent,
      descontoIncondicionadoPercent: input.descontoIncondicionadoPercent,
      descontoCondicionadoPercent: input.descontoCondicionadoPercent,
      informacoesAdicionais: input.informacoesAdicionais,
      tomadorInscricaoMunicipal: input.tomadorInscricaoMunicipal,
    };

    const gateway = resolveGateway(profile.fiscalGateway);
    const fiscalEnvironment = input.environment as FiscalEnvironment;

    const preflight = gateway.validateBeforeIssue({
      ref: "",
      contract,
      profile,
      overrides,
      environment: fiscalEnvironment,
    });
    if (!preflight.valid) {
      throw errors.BAD_REQUEST({ message: preflight.errors.join("; ") });
    }

    let invoiceCount;
    try {
      invoiceCount = await prisma.fiscalInvoice.count({
        where: { contractId: contract.id },
      });
    } catch (err) {
      console.error(
        "[fiscal/invoices/issue] erro ao contar notas do contrato:",
        err,
      );
      throw errors.INTERNAL_SERVER_ERROR;
    }
    const ref = `forge-${contract.id}-${invoiceCount + 1}`;

    console.log(
      "[fiscal/issue] gateway:",
      gateway.id,
      "ambiente:",
      fiscalEnvironment,
    );

    let issueResult;
    try {
      issueResult = await gateway.issueInvoice({
        ref,
        contract,
        profile,
        overrides,
        environment: fiscalEnvironment,
      });
    } catch (err) {
      console.error(
        "[fiscal/invoices/issue] erro ao emitir no gateway:",
        err,
      );
      if (err instanceof FocusNfeHttpError) {
        throw errors.BAD_REQUEST({ message: `Focus NFe: ${err.message}` });
      }
      if (err instanceof NfeError) {
        const nfeDetail = describeNfeIoError(err.details ?? err.raw);
        throw errors.BAD_REQUEST({
          message: `NFE.io: ${nfeDetail ?? err.message}`,
        });
      }
      throw errors.INTERNAL_SERVER_ERROR;
    }

    const isAuthorized = issueResult.status === "AUTORIZADO";

    const tomadorSnapshot =
      input.tipoTomador === "PJ"
        ? {
            tipo: "PJ",
            cnpj: input.tomadorCnpj,
            razaoSocial: input.tomadorRazaoSocial,
          }
        : { tipo: "PF", cpf: input.tomadorCpf, nome: input.tomadorNome };

    let invoice;
    try {
      invoice = await prisma.fiscalInvoice.create({
        data: {
          organizationId: context.org.id,
          profileId: profile.id,
          contractId: contract.id,
          ref,
          type: issueResult.invoiceType,
          status: issueResult.status,
          environment: fiscalEnvironment,
          gateway: gateway.id,
          externalId: issueResult.externalId,
          flowStatus: issueResult.rawStatus,
          valorServicos: contract.value,
          aliquotaIss: profile.defaultAliquotaIss,
          issRetido: profile.defaultIssRetido,
          dataCompetencia: overrides.dataCompetencia,
          requestPayload: issueResult.requestPayload as never,
          focusResponse: issueResult.providerResponse as never,
          tomadorSnapshot: tomadorSnapshot as never,
          tipoTomador: input.tipoTomador as "PF" | "PJ",
          issuedById: context.user.id,
          ...(isAuthorized && {
            numero: issueResult.numero,
            codigoVerificacao: issueResult.codigoVerificacao,
            urlEspelho: issueResult.urlEspelho,
            urlDanfse: issueResult.urlDanfse,
            caminhoXmlFocus: issueResult.caminhoXml,
            authorizedAt: new Date(),
          }),
          errorMessage: issueResult.errorMessage,
        },
      });
    } catch (err) {
      console.error(
        "[fiscal/invoices/issue] erro ao salvar nota fiscal no banco:",
        err,
      );
      throw errors.INTERNAL_SERVER_ERROR;
    }

    return { invoiceId: invoice.id, status: invoice.status, ref: invoice.ref };
  });
