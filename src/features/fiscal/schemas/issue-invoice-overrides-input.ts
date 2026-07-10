import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { z } from "zod";
import type { FiscalIssueOverrides } from "@/features/fiscal/lib/gateways";

dayjs.extend(utc);
dayjs.extend(timezone);

const TIMEZONE = "America/Sao_Paulo";

export const issueOverridesInputSchema = z.object({
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
});

export type IssueOverridesInput = z.infer<typeof issueOverridesInputSchema>;

// Data enviada pelo dialog é "YYYY-MM-DD"; ancoramos explicitamente em horário
// de Brasília em vez de deixar o parser nativo assumir meia-noite UTC, que
// equivale a 21h do dia anterior em Brasília (data errada ao formatar).
export function toFiscalIssueOverrides(
  input: IssueOverridesInput,
): FiscalIssueOverrides {
  return {
    tipoTomador: input.tipoTomador,
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
}
