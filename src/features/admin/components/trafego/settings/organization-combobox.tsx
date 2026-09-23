"use client";

import { useDeferredValue, useState } from "react";
import { useTrafegoAgencyOrganizations } from "@/features/trafego/hooks/use-trafego-admin";
import { SettingsCombobox, type ComboboxItem } from "./settings-combobox";

/**
 * Escolhe uma organização buscando no servidor. O termo digitado vai para a
 * query, então não existe um campo de busca separado do seletor.
 */
export function OrganizationCombobox({
  value,
  onChange,
  placeholder = "Selecione a organização",
}: {
  value: string;
  onChange: (organizationId: string) => void;
  placeholder?: string;
}) {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const { data, isLoading } = useTrafegoAgencyOrganizations(
    deferredSearch,
    200,
  );

  const items: ComboboxItem[] = (data?.organizations ?? []).map(
    (organization) => ({
      value: organization.id,
      label: organization.name,
      hasAvatar: true,
      imageUrl: organization.hasLogo
        ? `/api/admin/orgs/${organization.id}/logo`
        : undefined,
    }),
  );

  // A busca filtra a lista: sem isto, digitar um nome faria a org já escolhida
  // sumir do seletor e o campo voltar ao placeholder.
  const isSelectedListed = items.some((item) => item.value === value);
  const listedItems =
    value && !isSelectedListed
      ? [
          {
            value,
            label: "Organização selecionada",
            hint: value,
            hasAvatar: true,
            imageUrl: `/api/admin/orgs/${value}/logo`,
          },
          ...items,
        ]
      : items;

  return (
    <SettingsCombobox
      value={value}
      onChange={onChange}
      items={listedItems}
      placeholder={placeholder}
      searchPlaceholder="Buscar organização por nome"
      emptyLabel="Nenhuma organização com esse nome."
      isLoading={isLoading}
      onSearchChange={setSearch}
    />
  );
}
