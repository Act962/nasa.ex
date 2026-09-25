"use client";

import { Input } from "@/components/ui/input";
import type {
  TrafegoSettingsFormState,
  TrafegoSettingsPatch,
} from "@/features/admin/lib/trafego-settings-form";
import {
  SettingsCard,
  SettingsField,
  SettingsGrid,
  SettingsNotice,
} from "./settings-primitives";

export function AdvancedSection({
  form,
  patch,
}: {
  form: TrafegoSettingsFormState;
  patch: TrafegoSettingsPatch;
}) {
  return (
    <SettingsCard
      title="Avançado"
      description="Campos herdados da primeira versão. Mexa só se souber exatamente o efeito."
    >
      <SettingsGrid>
        <SettingsNotice tone="info">
          O tracking de vendas abaixo só entra em ação quando não há tracking de
          operação configurado. Com a operação montada, ele é ignorado.
        </SettingsNotice>

        <SettingsField label="Tracking de vendas (legado)">
          <Input
            value={form.salesTrackingId}
            onChange={(event) => patch({ salesTrackingId: event.target.value })}
            placeholder="ID do tracking"
            className="font-mono text-xs"
          />
        </SettingsField>

        <SettingsField label="Coluna de entrada (legado)">
          <Input
            value={form.salesStatusId}
            onChange={(event) => patch({ salesStatusId: event.target.value })}
            placeholder="Opcional"
            className="font-mono text-xs"
          />
        </SettingsField>

        <SettingsField
          label="Tracking padrão de disparo"
          wide
          hint="Número META_CLOUD de origem dos disparos."
        >
          <Input
            value={form.defaultBroadcastTrackingId}
            onChange={(event) =>
              patch({ defaultBroadcastTrackingId: event.target.value })
            }
            placeholder="ID do tracking"
            className="font-mono text-xs"
          />
        </SettingsField>
      </SettingsGrid>
    </SettingsCard>
  );
}
