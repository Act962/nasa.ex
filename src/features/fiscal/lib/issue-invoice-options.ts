export const UF_OPTIONS = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

export const NATUREZA_OPERACAO_OPTIONS = [
  { value: "1", label: "1 – Tributação no município" },
  { value: "2", label: "2 – Tributação fora do município" },
  { value: "3", label: "3 – Isenção" },
  { value: "4", label: "4 – Imune" },
  { value: "5", label: "5 – Exigibilidade suspensa por decisão judicial" },
  { value: "6", label: "6 – Exigibilidade suspensa por proc. administrativo" },
] as const;

export const REGIME_ESPECIAL_OPTIONS = [
  { value: "1", label: "1 – Microempresa municipal" },
  { value: "2", label: "2 – Estimativa" },
  { value: "3", label: "3 – Sociedade de profissionais" },
  { value: "4", label: "4 – Cooperativa" },
  { value: "5", label: "5 – Microempresário individual (MEI)" },
  { value: "6", label: "6 – Microempresário e EPP (ME EPP)" },
] as const;

// taxationType do ServiceInvoice na NFE.io (enum da API).
export const TAXATION_TYPE_OPTIONS = [
  { value: "WithinCity", label: "Tributado no município" },
  { value: "OutsideCity", label: "Tributado fora do município" },
  { value: "Export", label: "Exportação de serviço" },
  { value: "Free", label: "Isento" },
  { value: "Immune", label: "Imune" },
  { value: "SuspendedCourtDecision", label: "Suspenso por decisão judicial" },
  {
    value: "SuspendedAdministrativeProcedure",
    label: "Suspenso por processo administrativo",
  },
] as const;
