// Endereço da empresa numa linha, a partir da "Localização" cadastrada na organização.

export type OrganizationAddressFields = {
  addressLine: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
};

export function formatOrganizationAddress(organization: OrganizationAddressFields): string | null {
  const cityAndState = [organization.city?.trim(), organization.state?.trim()].filter(Boolean).join(" - ");
  const postalCode = organization.postalCode?.trim() ? `CEP ${organization.postalCode.trim()}` : "";
  const parts = [organization.addressLine?.trim(), cityAndState, postalCode].filter(Boolean);
  // Só o CEP não é endereço que leve alguém até a loja.
  if (!organization.addressLine?.trim() && !cityAndState) return null;
  return parts.join(", ");
}

export function buildMapsSearchUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}
