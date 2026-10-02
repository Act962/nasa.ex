import type { PlatformDef } from "@/features/integrations/components/integrations-page";
import type { Integration, IntegrationCategory } from "@/types/integration";
import { CATEGORY_LABELS } from "@/types/integration";

/** Tipos de satélite na página de Satélites: os nativos (com conexão real) primeiro, a IA no topo. */

export const PLATFORM_TYPE_ORDER: { category: PlatformDef["category"]; label: string }[] = [
  { category: "ai", label: "Inteligência artificial" },
  { category: "messaging", label: "Mensagens e chat" },
  { category: "social", label: "Redes sociais" },
  { category: "ads", label: "Anúncios e marketing" },
  { category: "email", label: "E-mail e agenda" },
  { category: "maps", label: "Localização e mapas" },
  { category: "crm", label: "CRM e vendas" },
];

export interface SatelliteGroup<TItem> {
  key: string;
  label: string;
  items: TItem[];
}

export function normalizeSearch(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export function matchesSearch(search: string, ...fields: string[]): boolean {
  if (!search) return true;
  return fields.some((field) => normalizeSearch(field).includes(search));
}

export function groupPlatformDefs(platformDefs: PlatformDef[]): SatelliteGroup<PlatformDef>[] {
  return PLATFORM_TYPE_ORDER.map(({ category, label }) => ({
    key: `platform-${category}`,
    label,
    items: platformDefs.filter((platformDef) => platformDef.category === category),
  })).filter((group) => group.items.length > 0);
}

export function groupCatalogIntegrations(catalog: Integration[]): SatelliteGroup<Integration>[] {
  return (Object.keys(CATEGORY_LABELS) as IntegrationCategory[])
    .map((category) => ({
      key: `catalog-${category}`,
      label: CATEGORY_LABELS[category],
      items: catalog.filter((integration) => integration.category === category),
    }))
    .filter((group) => group.items.length > 0);
}
