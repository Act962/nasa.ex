import { OFFICIAL_LINKS } from "@/features/accounting/lib/glossary/terms";

// Portais sugeridos no formulário do cofre, com o link oficial já preenchido.

export interface CredentialPortalOption {
  id: string;
  label: string;
  url: string | null;
}

export const CREDENTIAL_PORTALS: CredentialPortalOption[] = [
  { id: "ECAC", label: "e-CAC (Receita Federal)", url: OFFICIAL_LINKS.ecac.url },
  { id: "SIMPLES", label: "Simples Nacional", url: OFFICIAL_LINKS.simplesPortal.url },
  { id: "SEFAZ_PI", label: "SEFAZ-PI", url: OFFICIAL_LINKS.sefazPi.url },
  { id: "PREFEITURA_TERESINA", label: "Prefeitura de Teresina (NFS-e/ISS)", url: OFFICIAL_LINKS.semfTeresina.url },
  { id: "FGTS_DIGITAL", label: "FGTS Digital", url: OFFICIAL_LINKS.fgtsDigital.url },
  { id: "ESOCIAL", label: "eSocial / gov.br", url: OFFICIAL_LINKS.esocial.url },
  { id: "JUCEPI", label: "JUCEPI", url: OFFICIAL_LINKS.jucepi.url },
  { id: "BANCO", label: "Banco", url: null },
  { id: "OUTRO", label: "Outro", url: null },
];

export function findCredentialPortal(portalId: string): CredentialPortalOption | undefined {
  return CREDENTIAL_PORTALS.find((portal) => portal.id === portalId);
}
