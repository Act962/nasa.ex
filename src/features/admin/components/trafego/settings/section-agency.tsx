"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTrafegoAgencyOptions } from "@/features/trafego/hooks/use-trafego-admin";
import { maskPhoneBr } from "@/features/form/lib/masks";
import type {
  TrafegoSettingsFormState,
  TrafegoSettingsPatch,
} from "@/features/admin/lib/trafego-settings-form";
import { TrafegoPublicLinkCard } from "../public-link-card";
import { OrganizationCombobox } from "./organization-combobox";
import { SettingsCombobox } from "./settings-combobox";
import {
  SettingsCard,
  SettingsDivider,
  SettingsField,
  SettingsGrid,
  SettingsNotice,
} from "./settings-primitives";

/**
 * Agência e entrada de leads no mesmo card: escolher a organização e escolher
 * onde o lead cai são a mesma decisão para quem configura, e separá-las fazia
 * o admin pular metade da tela para terminar um pensamento só.
 */
export function AgencySection({
  form,
  patch,
}: {
  form: TrafegoSettingsFormState;
  patch: TrafegoSettingsPatch;
}) {
  const { data: captureOptions, isLoading: isLoadingCaptureOptions } =
    useTrafegoAgencyOptions(form.captureOrganizationId);

  const captureTracking = captureOptions?.trackings.find(
    (tracking) => tracking.id === form.captureTrackingId,
  );
  const hasCaptureOrganization = Boolean(form.captureOrganizationId.trim());
  const isCaptureReady = Boolean(
    form.captureTrackingId.trim() && form.captureStatusId.trim(),
  );
  const canMirrorAgency =
    Boolean(form.agencyOrganizationId.trim()) &&
    form.captureOrganizationId !== form.agencyOrganizationId;

  return (
    <div className="space-y-5">
      <TrafegoPublicLinkCard />

      <SettingsCard
        title="Agência e entrada de leads"
        description="Quem roda os anúncios e onde cai quem preenche o wizard. A organização da agência libera as opções das outras seções — comece por ela."
      >
        <SettingsGrid>
          <SettingsField
            label="Organização da agência"
            wide
            hint="É nela que a venda é lançada, que as métricas do Meta nascem e de onde vêm tracking, formulário e financeiro."
          >
            <OrganizationCombobox
              value={form.agencyOrganizationId}
              onChange={(agencyOrganizationId) =>
                // Tracking, formulário, conta e categorias pertencem à org
                // anterior — mantê-los apontaria para o lugar errado.
                patch({
                  agencyOrganizationId,
                  operationsTrackingId: "",
                  statusColumnMap: {},
                  briefingFormId: "",
                  financeAccountId: "",
                  financeRevenueCategoryId: "",
                  financePassthroughCategoryId: "",
                })
              }
            />
          </SettingsField>

          <SettingsField
            label="WhatsApp da equipe"
            hint="Mesmo número da instância do tracking de operação."
          >
            <Input
              value={form.supportWhatsapp}
              onChange={(event) =>
                patch({ supportWhatsapp: maskPhoneBr(event.target.value) })
              }
              placeholder="(86) 99822-1810"
            />
          </SettingsField>

          <SettingsField
            label="Business ID da Órbita"
            hint="O cliente adiciona este ID como parceiro na BM dele."
          >
            <Input
              value={form.partnerBusinessId}
              onChange={(event) =>
                patch({ partnerBusinessId: event.target.value })
              }
              placeholder="000000000000000"
            />
          </SettingsField>

          <SettingsDivider
            title="Entrada de leads"
            description="Quem preenche o passo Contato vira card mesmo sem pagar. É o funil comercial, separado do board de operação — e pode morar em outra organização."
          />

          <SettingsField
            label="Organização do funil"
            wide
            action={
              canMirrorAgency && (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs"
                  onClick={() =>
                    patch({
                      captureOrganizationId: form.agencyOrganizationId,
                      captureTrackingId: "",
                      captureStatusId: "",
                    })
                  }
                >
                  Usar a da agência
                </Button>
              )
            }
          >
            <OrganizationCombobox
              value={form.captureOrganizationId}
              onChange={(captureOrganizationId) =>
                patch({
                  captureOrganizationId,
                  captureTrackingId: "",
                  captureStatusId: "",
                })
              }
            />
          </SettingsField>

          <SettingsField label="Tracking">
            <SettingsCombobox
              value={form.captureTrackingId}
              onChange={(captureTrackingId) =>
                patch({ captureTrackingId, captureStatusId: "" })
              }
              items={(captureOptions?.trackings ?? []).map((tracking) => ({
                value: tracking.id,
                label: tracking.name,
              }))}
              placeholder={
                hasCaptureOrganization
                  ? "Escolha o tracking"
                  : "Escolha a organização primeiro"
              }
              searchPlaceholder="Buscar tracking"
              emptyLabel="Nenhum tracking nesta organização."
              disabled={!hasCaptureOrganization}
              isLoading={isLoadingCaptureOptions}
            />
          </SettingsField>

          <SettingsField
            label="Coluna de entrada"
            hint="Onde o card nasce. Se a coluna sumir, o lead cai na primeira do tracking."
          >
            <SettingsCombobox
              value={form.captureStatusId}
              onChange={(captureStatusId) => patch({ captureStatusId })}
              items={(captureTracking?.status ?? []).map((status) => ({
                value: status.id,
                label: status.name,
                color: status.color ?? undefined,
              }))}
              placeholder={
                captureTracking
                  ? "Escolha a coluna"
                  : "Escolha o tracking primeiro"
              }
              searchPlaceholder="Buscar coluna"
              emptyLabel="Este tracking não tem colunas."
              disabled={!captureTracking}
            />
          </SettingsField>

          {isCaptureReady ? (
            <SettingsNotice tone="ok">
              Captura ligada. Cada lead novo abre um aviso para os admins do
              sistema e chega como push nos aparelhos inscritos.
            </SettingsNotice>
          ) : (
            <SettingsNotice tone="warn">
              Captura desligada — o wizard continua funcionando, mas quem
              abandona antes de pagar não deixa card nenhum.
            </SettingsNotice>
          )}
        </SettingsGrid>
      </SettingsCard>
    </div>
  );
}
