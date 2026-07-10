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
  // A checagem de supportedByFocus (baseada na lista de municípios da Focus em
  // PRODUCAO) não reflete disponibilidade em HOMOLOGACAO, então ela é dispensada
  // só nesse ambiente. Não confundir com disponibilidade real de homologação:
  // para Teresina a Focus recusa a própria chamada de emissão MUNICIPAL em
  // homologação (erro `empresa_nao_habilitada`) — ver docs/nfs/municipios-requirements.md §8.
  skipsSupportedByFocusInHomologacao: boolean;
};

const DEFAULT_REQUIREMENTS: MunicipioNfseRequirements = {
  requiresCodigoCnae: false,
  usesCodigoTributarioMunicipio: true,
  requiresCodigoTributarioMunicipio: false,
  requiresTomadorEndereco: true,
  requiresInscricaoMunicipalPrestador: true,
  aliquotaDecimals: 2,
  skipsSupportedByFocusInHomologacao: false,
};

const MUNICIPIO_OVERRIDES: Record<string, Partial<MunicipioNfseRequirements>> = {
  // Teresina-PI — Focus: CNAE 9 dígitos obrigatório; codigo_tributario_municipio "não utilizado".
  // MUNICIPAL não tem homologação de fato na Focus (erro `empresa_nao_habilitada` ao emitir) e
  // NACIONAL está bloqueado porque o município não aderiu ao Emissor Nacional — testado em
  // 2026-07-08, ver docs/nfs/municipios-requirements.md §8.
  // https://focusnfe.com.br/guides/nfse/municipios-integrados/teresina-pi/
  "2211001": {
    requiresCodigoCnae: { digits: 9 },
    usesCodigoTributarioMunicipio: false,
    skipsSupportedByFocusInHomologacao: true,
  },
};

export function resolveMunicipioRequirements(
  codigoIbge: string | null | undefined,
): MunicipioNfseRequirements {
  const overrides = codigoIbge ? MUNICIPIO_OVERRIDES[codigoIbge] : undefined;
  return { ...DEFAULT_REQUIREMENTS, ...overrides };
}
