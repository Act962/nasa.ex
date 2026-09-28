"use client";

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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

export function ClientAlertsSection({
  form,
  patch,
}: {
  form: TrafegoSettingsFormState;
  patch: TrafegoSettingsPatch;
}) {
  return (
    <SettingsCard
      title="Avisos ao cliente"
      description="A cada fase o cliente recebe e-mail e WhatsApp. Fora da janela de 24 h a Meta só aceita template aprovado — cadastre os nomes aqui."
      action={
        <label className="flex items-center gap-2 text-xs">
          <Switch
            checked={form.clientNotificationsEnabled}
            onCheckedChange={(clientNotificationsEnabled) =>
              patch({ clientNotificationsEnabled })
            }
          />
          {form.clientNotificationsEnabled ? "Ligados" : "Desligados"}
        </label>
      }
    >
      <SettingsGrid>
        {!form.clientNotificationsEnabled && (
          <SettingsNotice tone="warn">
            Desligado: nenhum e-mail nem WhatsApp sai para o cliente, em
            nenhuma fase. Os templates abaixo ficam guardados.
          </SettingsNotice>
        )}

        <SettingsField
          label="Template de ativação"
          hint="Parâmetros: nome · valor · link"
        >
          <Input
            value={form.whatsappActivationTemplate}
            onChange={(event) =>
              patch({ whatsappActivationTemplate: event.target.value })
            }
            placeholder="trafego_ativacao"
          />
        </SettingsField>

        <SettingsField
          label="Template de mudança de fase"
          hint="Parâmetros: nome · código · fase · link"
        >
          <Input
            value={form.whatsappStatusTemplate}
            onChange={(event) =>
              patch({ whatsappStatusTemplate: event.target.value })
            }
            placeholder="trafego_status"
          />
        </SettingsField>

        <SettingsField
          label="Template do código de verificação"
          hint="Parâmetro: código de 6 dígitos (categoria Autenticação)."
        >
          <Input
            value={form.whatsappOtpTemplate}
            onChange={(event) =>
              patch({ whatsappOtpTemplate: event.target.value })
            }
            placeholder="trafego_codigo"
          />
        </SettingsField>

        <SettingsField
          label="Idioma dos templates"
          hint="Como cadastrado na Meta, por exemplo pt_BR."
        >
          <Input
            value={form.whatsappTemplateLanguage}
            onChange={(event) =>
              patch({ whatsappTemplateLanguage: event.target.value })
            }
            placeholder="pt_BR"
          />
        </SettingsField>
      </SettingsGrid>
    </SettingsCard>
  );
}
