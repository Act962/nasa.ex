"use client";

import { useTrafegoAgencyOptions } from "@/features/trafego/hooks/use-trafego-admin";
import type {
  TrafegoSettingsFormState,
  TrafegoSettingsPatch,
} from "@/features/admin/lib/trafego-settings-form";
import { SettingsCombobox } from "./settings-combobox";
import {
  SettingsCard,
  SettingsField,
  SettingsGrid,
  SettingsNotice,
} from "./settings-primitives";

export function FinanceSection({
  form,
  patch,
}: {
  form: TrafegoSettingsFormState;
  patch: TrafegoSettingsPatch;
}) {
  const { data: options, isLoading } = useTrafegoAgencyOptions(
    form.agencyOrganizationId,
  );
  const hasAgency = Boolean(form.agencyOrganizationId.trim());

  const placeholderWithoutAgency = "Escolha a organização da agência primeiro";

  return (
    <SettingsCard
      title="Financeiro"
      description="Onde a venda entra na org da agência: receita = taxa + setup; a verba vira conta a pagar (repasse)."
    >
      <SettingsGrid>
        <SettingsField
          label="Conta"
          wide
          hint="A conta bancária que recebe — normalmente a do gateway."
        >
          <SettingsCombobox
            value={form.financeAccountId}
            onChange={(financeAccountId) => patch({ financeAccountId })}
            items={(options?.accounts ?? []).map((account) => ({
              value: account.id,
              label: account.name,
              hint: account.type,
            }))}
            placeholder={hasAgency ? "Escolha a conta" : placeholderWithoutAgency}
            searchPlaceholder="Buscar conta"
            emptyLabel="Nenhuma conta ativa nesta organização."
            disabled={!hasAgency}
            isLoading={isLoading}
          />
        </SettingsField>

        <SettingsField
          label="Categoria da receita"
          hint="Só categorias do tipo Receita."
        >
          <SettingsCombobox
            value={form.financeRevenueCategoryId}
            onChange={(financeRevenueCategoryId) =>
              patch({ financeRevenueCategoryId })
            }
            items={(options?.categories ?? [])
              .filter((category) => category.type === "REVENUE")
              .map((category) => ({ value: category.id, label: category.name }))}
            placeholder={
              hasAgency ? "Escolha a categoria" : placeholderWithoutAgency
            }
            searchPlaceholder="Buscar categoria"
            emptyLabel="Nenhuma categoria de receita."
            disabled={!hasAgency}
            isLoading={isLoading}
          />
        </SettingsField>

        <SettingsField
          label="Categoria do repasse da verba"
          hint="Categorias do tipo Despesa ou Custo."
        >
          <SettingsCombobox
            value={form.financePassthroughCategoryId}
            onChange={(financePassthroughCategoryId) =>
              patch({ financePassthroughCategoryId })
            }
            items={(options?.categories ?? [])
              .filter((category) => category.type !== "REVENUE")
              .map((category) => ({ value: category.id, label: category.name }))}
            placeholder={
              hasAgency ? "Escolha a categoria" : placeholderWithoutAgency
            }
            searchPlaceholder="Buscar categoria"
            emptyLabel="Nenhuma categoria de despesa ou custo."
            disabled={!hasAgency}
            isLoading={isLoading}
          />
        </SettingsField>

        {!hasAgency && (
          <SettingsNotice tone="info">
            Conta e categorias precisam pertencer à organização da agência — o
            servidor recusa ids de outra org.
          </SettingsNotice>
        )}
      </SettingsGrid>
    </SettingsCard>
  );
}
