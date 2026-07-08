import { z } from "zod";

export const issueInvoiceSchema = z
  .object({
    tipoTomador: z.enum(["PF", "PJ"]),
    environment: z.enum(["HOMOLOGACAO", "PRODUCAO"]),
    nfseStandard: z.enum(["MUNICIPAL", "NACIONAL"]).optional(),
    // Flag derivada do registry de requisitos do município do prestador
    // (resolveMunicipioRequirements) — setada pelo dialog, não pelo usuário.
    requiresTomadorEndereco: z.boolean().optional(),
    dataCompetencia: z.string().min(1, "Competência obrigatória"),
    discriminacao: z.string().optional(),
    naturezaOperacao: z.string(),
    regimeEspecialTributacao: z.string().optional(),
    // Reforma Tributária (IBS/CBS)
    ibsCbsSituacaoTributaria: z.string().optional(),
    ibsCbsClassificacaoTributaria: z.string().optional(),
    consumidorFinal: z.boolean().optional(),
    // PJ
    tomadorCnpj: z.string().optional(),
    tomadorRazaoSocial: z.string().optional(),
    tomadorEmail: z.string().optional(),
    tomadorLogradouro: z.string().optional(),
    tomadorNumero: z.string().optional(),
    tomadorComplemento: z.string().optional(),
    tomadorBairro: z.string().optional(),
    tomadorCodigoMunicipio: z.string().optional(),
    tomadorUf: z.string().optional(),
    tomadorCep: z.string().optional(),
    // PF
    tomadorCpf: z.string().optional(),
    tomadorNome: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    if (values.tipoTomador === "PJ") {
      const cnpj = (values.tomadorCnpj ?? "").replace(/\D/g, "");
      if (cnpj.length !== 14)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "CNPJ do tomador inválido",
          path: ["tomadorCnpj"],
        });
      if (!values.tomadorRazaoSocial)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Razão social obrigatória",
          path: ["tomadorRazaoSocial"],
        });
    } else {
      const cpf = (values.tomadorCpf ?? "").replace(/\D/g, "");
      if (cpf.length !== 11)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "CPF do tomador inválido",
          path: ["tomadorCpf"],
        });
      if (!values.tomadorNome)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Nome obrigatório",
          path: ["tomadorNome"],
        });
    }

    // NFS-e Nacional dispensa o endereço completo do tomador (basta o CNPJ/CPF);
    // no padrão municipal, a exigência vem do registry de requisitos do município.
    // Vale para PF e PJ — o endereço agora é coletado nos dois fluxos.
    const shouldValidateEndereco =
      values.nfseStandard !== "NACIONAL" &&
      (values.requiresTomadorEndereco ?? values.nfseStandard !== "NACIONAL");
    if (shouldValidateEndereco) {
      if (!values.tomadorCodigoMunicipio)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Código do município obrigatório",
          path: ["tomadorCodigoMunicipio"],
        });
      if (!values.tomadorUf)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "UF obrigatória",
          path: ["tomadorUf"],
        });
      if (!values.tomadorLogradouro)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Logradouro obrigatório",
          path: ["tomadorLogradouro"],
        });
      if (!values.tomadorNumero)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Número obrigatório",
          path: ["tomadorNumero"],
        });
      if (!values.tomadorBairro)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Bairro obrigatório",
          path: ["tomadorBairro"],
        });
      if ((values.tomadorCep ?? "").replace(/\D/g, "").length !== 8)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "CEP inválido (deve ter 8 dígitos)",
          path: ["tomadorCep"],
        });
    }
  });

export type IssueInvoiceFormValues = z.infer<typeof issueInvoiceSchema>;
