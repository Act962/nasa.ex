"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Save, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useProvisionTrafegoBriefingForm,
  useProvisionTrafegoOperationsTracking,
  useTrafegoAgencyOptions,
  useTrafegoSettings,
  useUpdateTrafegoSettings,
} from "@/features/trafego/hooks/use-trafego-admin";
import { TRAFEGO_KANBAN_COLUMNS } from "@/features/trafego/lib/kanban-columns";

const NONE = "__none__";

interface SettingsFormState {
  agencyOrganizationId: string;
  defaultServiceFeePercent: string;
  supportWhatsapp: string;
  partnerBusinessId: string;
  operationsTrackingId: string;
  statusColumnMap: Record<string, string>;
  briefingFormId: string;
  clientNotificationsEnabled: boolean;
  whatsappActivationTemplate: string;
  whatsappStatusTemplate: string;
  whatsappOtpTemplate: string;
  whatsappTemplateLanguage: string;
  pixKey: string;
  pixHolderName: string;
  pixBankName: string;
  pixExpiryHours: string;
  financeAccountId: string;
  financeRevenueCategoryId: string;
  financePassthroughCategoryId: string;
  salesTrackingId: string;
  salesStatusId: string;
  defaultBroadcastTrackingId: string;
}

const EMPTY_FORM: SettingsFormState = {
  agencyOrganizationId: "",
  defaultServiceFeePercent: "50",
  supportWhatsapp: "",
  partnerBusinessId: "",
  operationsTrackingId: "",
  statusColumnMap: {},
  briefingFormId: "",
  clientNotificationsEnabled: true,
  whatsappActivationTemplate: "",
  whatsappStatusTemplate: "",
  whatsappOtpTemplate: "",
  whatsappTemplateLanguage: "pt_BR",
  pixKey: "",
  pixHolderName: "",
  pixBankName: "",
  pixExpiryHours: "48",
  financeAccountId: "",
  financeRevenueCategoryId: "",
  financePassthroughCategoryId: "",
  salesTrackingId: "",
  salesStatusId: "",
  defaultBroadcastTrackingId: "",
};

/**
 * Ajustes globais do trafeGO. A org da agência vem primeiro: é dela que saem
 * as opções dos selects (tracking de operação, formulário, contas, categorias)
 * e é nela que a venda é lançada e os KPIs do Meta nascem.
 */
export function TrafegoSettingsForm() {
  const { data: settings, isLoading } = useTrafegoSettings();
  const updateSettings = useUpdateTrafegoSettings();
  const provisionTracking = useProvisionTrafegoOperationsTracking();
  const provisionForm = useProvisionTrafegoBriefingForm();

  const [form, setForm] = useState<SettingsFormState>(EMPTY_FORM);
  const { data: options, isLoading: isLoadingOptions } = useTrafegoAgencyOptions(
    form.agencyOrganizationId,
  );

  useEffect(() => {
    if (!settings) return;
    setForm({
      agencyOrganizationId: settings.agencyOrganizationId ?? "",
      defaultServiceFeePercent: String(settings.defaultServiceFeePercent ?? 50),
      supportWhatsapp: settings.supportWhatsapp ?? "",
      partnerBusinessId: settings.partnerBusinessId ?? "",
      operationsTrackingId: settings.operationsTrackingId ?? "",
      statusColumnMap: (settings.statusColumnMap ?? {}) as Record<string, string>,
      briefingFormId: settings.briefingFormId ?? "",
      clientNotificationsEnabled: settings.clientNotificationsEnabled ?? true,
      whatsappActivationTemplate: settings.whatsappActivationTemplate ?? "",
      whatsappStatusTemplate: settings.whatsappStatusTemplate ?? "",
      whatsappOtpTemplate: settings.whatsappOtpTemplate ?? "",
      pixKey: settings.pixKey ?? "",
      pixHolderName: settings.pixHolderName ?? "",
      pixBankName: settings.pixBankName ?? "",
      pixExpiryHours: String(settings.pixExpiryHours ?? 48),
      whatsappTemplateLanguage: settings.whatsappTemplateLanguage ?? "pt_BR",
      financeAccountId: settings.financeAccountId ?? "",
      financeRevenueCategoryId: settings.financeRevenueCategoryId ?? "",
      financePassthroughCategoryId: settings.financePassthroughCategoryId ?? "",
      salesTrackingId: settings.salesTrackingId ?? "",
      salesStatusId: settings.salesStatusId ?? "",
      defaultBroadcastTrackingId: settings.defaultBroadcastTrackingId ?? "",
    });
  }, [settings]);

  const patch = (partial: Partial<SettingsFormState>) =>
    setForm((current) => ({ ...current, ...partial }));

  const selectedTracking = options?.trackings.find(
    (tracking) => tracking.id === form.operationsTrackingId,
  );
  const unmappedColumns = TRAFEGO_KANBAN_COLUMNS.filter(
    (column) => !form.statusColumnMap[column.key],
  );

  function handleSave() {
    const emptyToNull = (value: string) => (value.trim() ? value.trim() : null);

    updateSettings.mutate(
      {
        agencyOrganizationId: emptyToNull(form.agencyOrganizationId),
        defaultBroadcastTrackingId: emptyToNull(form.defaultBroadcastTrackingId),
        salesTrackingId: emptyToNull(form.salesTrackingId),
        salesStatusId: emptyToNull(form.salesStatusId),
        defaultServiceFeePercent: Number(form.defaultServiceFeePercent),
        supportWhatsapp: emptyToNull(form.supportWhatsapp),
        operationsTrackingId: emptyToNull(form.operationsTrackingId),
        statusColumnMap: form.statusColumnMap,
        briefingFormId: emptyToNull(form.briefingFormId),
        partnerBusinessId: emptyToNull(form.partnerBusinessId),
        whatsappActivationTemplate: emptyToNull(form.whatsappActivationTemplate),
        whatsappStatusTemplate: emptyToNull(form.whatsappStatusTemplate),
        whatsappOtpTemplate: emptyToNull(form.whatsappOtpTemplate),
        pixKey: emptyToNull(form.pixKey),
        pixHolderName: emptyToNull(form.pixHolderName),
        pixBankName: emptyToNull(form.pixBankName),
        pixExpiryHours: Number(form.pixExpiryHours) || 48,
        whatsappTemplateLanguage: form.whatsappTemplateLanguage.trim() || "pt_BR",
        clientNotificationsEnabled: form.clientNotificationsEnabled,
        financeAccountId: emptyToNull(form.financeAccountId),
        financeRevenueCategoryId: emptyToNull(form.financeRevenueCategoryId),
        financePassthroughCategoryId: emptyToNull(form.financePassthroughCategoryId),
      },
      {
        onSuccess: () => toast.success("Ajustes salvos."),
        onError: (error) => toast.error(error.message),
      },
    );
  }

  function handleProvisionTracking() {
    provisionTracking.mutate(
      { organizationId: form.agencyOrganizationId.trim() || undefined },
      {
        onSuccess: (result) => {
          patch({
            operationsTrackingId: result.trackingId,
            statusColumnMap: result.statusColumnMap as Record<string, string>,
          });
          toast.success(
            result.created
              ? "Tracking TrafeGO criado com as 12 colunas."
              : "Colunas conferidas e mapa refeito.",
          );
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  function handleProvisionForm() {
    provisionForm.mutate(
      { organizationId: form.agencyOrganizationId.trim() || undefined },
      {
        onSuccess: (result) => {
          patch({ briefingFormId: result.formId });
          toast.success(
            result.created ? "Formulário Briefing TrafeGO criado." : "Formulário já existia.",
          );
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Carregando ajustes…
      </div>
    );
  }

  const hasAgency = form.agencyOrganizationId.trim().length >= 8;

  return (
    <div className="space-y-5">
      <Section
        title="Agência"
        description="A organização que roda os anúncios. É dela que vêm as opções abaixo, e é nela que a venda é lançada e as métricas do Meta nascem."
      >
        <Field label="Organização da agência" wide>
          <Input
            value={form.agencyOrganizationId}
            onChange={(event) => patch({ agencyOrganizationId: event.target.value })}
            placeholder="ID da org da NASA que roda os anúncios"
          />
        </Field>
        <Field label="Taxa de serviço padrão (%)">
          <Input
            type="number"
            value={form.defaultServiceFeePercent}
            onChange={(event) => patch({ defaultServiceFeePercent: event.target.value })}
          />
        </Field>
        <Field
          label="WhatsApp da equipe"
          hint="Mesmo número da instância do tracking de operação — é onde o comprovante e as dúvidas chegam."
        >
          <Input
            value={form.supportWhatsapp}
            onChange={(event) => patch({ supportWhatsapp: event.target.value })}
            placeholder="5586998221810"
          />
        </Field>
        <Field
          label="Business ID da Órbita"
          hint="Vai na mensagem de análise da conta: o cliente adiciona este ID como parceiro na BM dele."
          wide
        >
          <Input
            value={form.partnerBusinessId}
            onChange={(event) => patch({ partnerBusinessId: event.target.value })}
            placeholder="Configurações do negócio → Informações do negócio → ID"
          />
        </Field>
      </Section>

      <Section
        title="Operação"
        description="O tracking onde o gestor trabalha: um card por cliente, uma coluna por fase. Arrastar o card muda o status do pedido e avisa o cliente."
        action={
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!hasAgency || provisionTracking.isPending}
            onClick={handleProvisionTracking}
          >
            {provisionTracking.isPending ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" />
            ) : (
              <Wand2 className="mr-1.5 size-4" />
            )}
            {form.operationsTrackingId ? "Conferir colunas" : "Criar tracking TrafeGO"}
          </Button>
        }
      >
        <Field label="Tracking de operação" wide>
          <OptionSelect
            value={form.operationsTrackingId}
            onChange={(value) => patch({ operationsTrackingId: value, statusColumnMap: {} })}
            placeholder={hasAgency ? "Escolha o tracking" : "Informe a org da agência primeiro"}
            disabled={!hasAgency || isLoadingOptions}
            items={(options?.trackings ?? []).map((tracking) => ({
              value: tracking.id,
              label: tracking.name,
            }))}
          />
        </Field>

        {selectedTracking && (
          <div className="sm:col-span-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Fase do pedido → coluna do tracking</Label>
              {unmappedColumns.length === 0 ? (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                  <CheckCircle2 className="size-3.5" /> Todas as fases mapeadas
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                  <AlertTriangle className="size-3.5" /> {unmappedColumns.length} sem coluna
                </span>
              )}
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {TRAFEGO_KANBAN_COLUMNS.map((column) => (
                <div key={column.key} className="flex items-center gap-2 rounded-md border px-3 py-2">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: column.color }}
                  />
                  <span className="min-w-0 flex-1 truncate text-xs">{column.name}</span>
                  <OptionSelect
                    compact
                    value={form.statusColumnMap[column.key] ?? ""}
                    onChange={(value) =>
                      patch({
                        statusColumnMap: value
                          ? { ...form.statusColumnMap, [column.key]: value }
                          : Object.fromEntries(
                              Object.entries(form.statusColumnMap).filter(
                                ([key]) => key !== column.key,
                              ),
                            ),
                      })
                    }
                    placeholder="Coluna"
                    items={selectedTracking.status.map((status) => ({
                      value: status.id,
                      label: status.name,
                    }))}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </Section>

      <Section
        title="Briefing no card"
        description="As respostas do wizard viram uma resposta deste formulário no card do lead."
        action={
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!hasAgency || provisionForm.isPending}
            onClick={handleProvisionForm}
          >
            {provisionForm.isPending ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" />
            ) : (
              <Wand2 className="mr-1.5 size-4" />
            )}
            Criar formulário Briefing
          </Button>
        }
      >
        <Field label="Formulário" wide>
          <OptionSelect
            value={form.briefingFormId}
            onChange={(value) => patch({ briefingFormId: value })}
            placeholder={hasAgency ? "Escolha o formulário" : "Informe a org da agência primeiro"}
            disabled={!hasAgency || isLoadingOptions}
            items={(options?.forms ?? []).map((formOption) => ({
              value: formOption.id,
              label: `${formOption.name}${formOption.published ? "" : " (não publicado)"}`,
            }))}
          />
        </Field>
      </Section>

      <Section
        title="Avisos ao cliente"
        description="A cada fase o cliente recebe e-mail e WhatsApp. Fora da janela de 24 h a Meta só aceita template aprovado — cadastre os nomes aqui."
        action={
          <label className="flex items-center gap-2 text-xs">
            <Switch
              checked={form.clientNotificationsEnabled}
              onCheckedChange={(checked) => patch({ clientNotificationsEnabled: checked })}
            />
            {form.clientNotificationsEnabled ? "Ligados" : "Desligados"}
          </label>
        }
      >
        <Field label="Template de ativação" hint="Parâmetros: nome · valor · link">
          <Input
            value={form.whatsappActivationTemplate}
            onChange={(event) => patch({ whatsappActivationTemplate: event.target.value })}
            placeholder="trafego_ativacao"
          />
        </Field>
        <Field label="Template de mudança de fase" hint="Parâmetros: nome · código · fase · link">
          <Input
            value={form.whatsappStatusTemplate}
            onChange={(event) => patch({ whatsappStatusTemplate: event.target.value })}
            placeholder="trafego_status"
          />
        </Field>
        <Field label="Template do código de verificação" hint="Parâmetro: código de 6 dígitos (categoria Autenticação)">
          <Input
            value={form.whatsappOtpTemplate}
            onChange={(event) => patch({ whatsappOtpTemplate: event.target.value })}
            placeholder="trafego_codigo"
          />
        </Field>
        <Field label="Idioma dos templates">
          <Input
            value={form.whatsappTemplateLanguage}
            onChange={(event) => patch({ whatsappTemplateLanguage: event.target.value })}
            placeholder="pt_BR"
          />
        </Field>
      </Section>

      <Section
        title="PIX manual"
        description="A chave aparece para o cliente no fim do wizard. Sem chave preenchida, o PIX some e só o cartão é oferecido."
      >
        <Field label="Chave PIX" wide hint="CNPJ, e-mail, telefone ou chave aleatória.">
          <Input
            value={form.pixKey}
            onChange={(event) => patch({ pixKey: event.target.value })}
            placeholder="00.000.000/0001-00"
          />
        </Field>
        <Field label="Titular da conta">
          <Input
            value={form.pixHolderName}
            onChange={(event) => patch({ pixHolderName: event.target.value })}
            placeholder="Órbita Hub LTDA"
          />
        </Field>
        <Field label="Banco">
          <Input
            value={form.pixBankName}
            onChange={(event) => patch({ pixBankName: event.target.value })}
            placeholder="Inter"
          />
        </Field>
        <Field
          label="Validade da cobrança (horas)"
          hint="Depois disso a cobrança vira “vencida” na fila — mas continua confirmável."
        >
          <Input
            type="number"
            value={form.pixExpiryHours}
            onChange={(event) => patch({ pixExpiryHours: event.target.value })}
          />
        </Field>
      </Section>

      <Section
        title="Financeiro"
        description="Onde a venda entra na org da agência: receita = taxa + setup; a verba vira conta a pagar (repasse)."
      >
        <Field label="Conta (ex.: STRIPE)" wide>
          <OptionSelect
            value={form.financeAccountId}
            onChange={(value) => patch({ financeAccountId: value })}
            placeholder={hasAgency ? "Escolha a conta" : "Informe a org da agência primeiro"}
            disabled={!hasAgency || isLoadingOptions}
            items={(options?.accounts ?? []).map((account) => ({
              value: account.id,
              label: account.name,
            }))}
          />
        </Field>
        <Field label="Categoria da receita (ex.: Cliente TrafeGO)">
          <OptionSelect
            value={form.financeRevenueCategoryId}
            onChange={(value) => patch({ financeRevenueCategoryId: value })}
            placeholder="Categoria do tipo Receita"
            disabled={!hasAgency || isLoadingOptions}
            items={(options?.categories ?? [])
              .filter((category) => category.type === "REVENUE")
              .map((category) => ({ value: category.id, label: category.name }))}
          />
        </Field>
        <Field label="Categoria do repasse da verba">
          <OptionSelect
            value={form.financePassthroughCategoryId}
            onChange={(value) => patch({ financePassthroughCategoryId: value })}
            placeholder="Categoria Despesa ou Custo"
            disabled={!hasAgency || isLoadingOptions}
            items={(options?.categories ?? [])
              .filter((category) => category.type !== "REVENUE")
              .map((category) => ({ value: category.id, label: category.name }))}
          />
        </Field>
      </Section>

      <Section
        title="Avançado"
        description="Campos herdados da primeira versão. O tracking de vendas só é usado se não houver tracking de operação."
      >
        <Field label="Tracking de vendas (legado)">
          <Input
            value={form.salesTrackingId}
            onChange={(event) => patch({ salesTrackingId: event.target.value })}
            placeholder="ID do tracking"
          />
        </Field>
        <Field label="Coluna de entrada (legado)">
          <Input
            value={form.salesStatusId}
            onChange={(event) => patch({ salesStatusId: event.target.value })}
            placeholder="Opcional"
          />
        </Field>
        <Field label="Tracking padrão de disparo" wide>
          <Input
            value={form.defaultBroadcastTrackingId}
            onChange={(event) => patch({ defaultBroadcastTrackingId: event.target.value })}
            placeholder="Número META_CLOUD de origem dos disparos"
          />
        </Field>
      </Section>

      <div className="flex justify-end">
        <Button size="sm" onClick={handleSave} disabled={updateSettings.isPending}>
          {updateSettings.isPending ? (
            <Loader2 className="mr-1.5 size-4 animate-spin" />
          ) : (
            <Save className="mr-1.5 size-4" />
          )}
          Salvar ajustes
        </Button>
      </div>
    </div>
  );
}

function Section({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="max-w-xl text-sm text-muted-foreground">{description}</p>
        </div>
        {action}
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  wide,
  children,
}: {
  label: string;
  hint?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <Label className="text-xs">{label}</Label>
      <div className="mt-1">{children}</div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function OptionSelect({
  value,
  onChange,
  items,
  placeholder,
  disabled,
  compact,
}: {
  value: string;
  onChange: (value: string) => void;
  items: { value: string; label: string }[];
  placeholder: string;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <Select
      value={value || NONE}
      onValueChange={(next) => onChange(next === NONE ? "" : next)}
      disabled={disabled}
    >
      <SelectTrigger className={compact ? "h-8 w-40 text-xs" : undefined}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>— nenhum —</SelectItem>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
