// Registry data-driven dos requisitos de NFS-e municipal que variam por município.
// A Focus NFe unifica endpoint/payload; o que muda por prefeitura é quais campos são
// obrigatórios/ignorados. Default = superset seguro (municípios ignoram o que não usam);
// overrides só para exigências duras, documentadas em docs/nfs/municipios-requirements.md.

export type MunicipioNfseRequirements = {
  requiresCodigoCnae: false | { digits: 7 | 9 };
  usesCodigoTributarioMunicipio: boolean;
  requiresCodigoTributarioMunicipio: boolean;
  requiresTomadorEndereco: boolean;
  requiresInscricaoMunicipalPrestador: boolean;
  aliquotaDecimals: 2 | 4;
};

const DEFAULT_REQUIREMENTS: MunicipioNfseRequirements = {
  requiresCodigoCnae: false,
  usesCodigoTributarioMunicipio: true,
  requiresCodigoTributarioMunicipio: false,
  requiresTomadorEndereco: true,
  requiresInscricaoMunicipalPrestador: true,
  aliquotaDecimals: 2,
};

const MUNICIPIO_OVERRIDES: Record<string, Partial<MunicipioNfseRequirements>> = {
  // Teresina-PI — Focus: CNAE 9 dígitos obrigatório; codigo_tributario_municipio "não utilizado".
  // https://focusnfe.com.br/guides/nfse/municipios-integrados/teresina-pi/
  "2211001": {
    requiresCodigoCnae: { digits: 9 },
    usesCodigoTributarioMunicipio: false,
  },
};

export function resolveMunicipioRequirements(
  codigoIbge: string | null | undefined,
): MunicipioNfseRequirements {
  const overrides = codigoIbge ? MUNICIPIO_OVERRIDES[codigoIbge] : undefined;
  return { ...DEFAULT_REQUIREMENTS, ...overrides };
}
