"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bell,
  Building2,
  CreditCard,
  KanbanSquare,
  Landmark,
  Loader2,
  Save,
  Tag,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  useTrafegoSettings,
  useUpdateTrafegoSettings,
} from "@/features/trafego/hooks/use-trafego-admin";
import { useAdminPath } from "@/features/trafego/lib/base-path";
import { TRAFEGO_KANBAN_COLUMNS } from "@/features/trafego/lib/kanban-columns";
import {
  EMPTY_TRAFEGO_SETTINGS_FORM,
  changedTrafegoSettingsFields,
  trafegoFormToUpdateInput,
  trafegoSettingsToForm,
  type TrafegoSettingsFormState,
  type TrafegoSettingsPayload,
} from "@/features/admin/lib/trafego-settings-form";
import { AgencySection } from "./section-agency";
import { OperationsSection } from "./section-operations";
import { PlansSection } from "./section-plans";
import { PaymentSection } from "./section-payment";
import { FinanceSection } from "./section-finance";
import { ClientAlertsSection } from "./section-client-alerts";
import { AdvancedSection } from "./section-advanced";
import { cn } from "@/lib/utils";

type SectionStatus = "ok" | "warn" | "off" | null;

interface SectionSpec {
  id: string;
  label: string;
  icon: LucideIcon;
  fields: (keyof TrafegoSettingsFormState)[];
  status: (form: TrafegoSettingsFormState) => SectionStatus;
}

const SECTIONS: SectionSpec[] = [
  {
    id: "agencia",
    label: "Agência e leads",
    icon: Building2,
    fields: [
      "agencyOrganizationId",
      "supportWhatsapp",
      "partnerBusinessId",
      "captureOrganizationId",
      "captureTrackingId",
      "captureStatusId",
    ],
    status: (form) =>
      form.agencyOrganizationId && form.captureTrackingId && form.captureStatusId
        ? "ok"
        : "warn",
  },
  {
    id: "operacao",
    label: "Operação",
    icon: KanbanSquare,
    fields: ["operationsTrackingId", "statusColumnMap", "briefingFormId"],
    status: (form) => {
      if (!form.operationsTrackingId) return "warn";
      const mapped = TRAFEGO_KANBAN_COLUMNS.filter(
        (column) => form.statusColumnMap[column.key],
      ).length;
      return mapped === TRAFEGO_KANBAN_COLUMNS.length ? "ok" : "warn";
    },
  },
  {
    id: "planos",
    label: "Planos e preços",
    icon: Tag,
    fields: ["defaultServiceFeePercent", "includedCreatives", "extraCreativeBrl"],
    status: () => null,
  },
  {
    id: "pagamento",
    label: "Pagamento",
    icon: CreditCard,
    fields: ["pixKey", "pixHolderName", "pixBankName", "pixExpiryMinutes"],
    status: () => null,
  },
  {
    id: "financeiro",
    label: "Financeiro",
    icon: Landmark,
    fields: [
      "financeAccountId",
      "financeRevenueCategoryId",
      "financePassthroughCategoryId",
    ],
    status: (form) =>
      form.financeAccountId &&
      form.financeRevenueCategoryId &&
      form.financePassthroughCategoryId
        ? "ok"
        : "warn",
  },
  {
    id: "avisos",
    label: "Avisos ao cliente",
    icon: Bell,
    fields: [
      "clientNotificationsEnabled",
      "whatsappActivationTemplate",
      "whatsappStatusTemplate",
      "whatsappOtpTemplate",
      "whatsappTemplateLanguage",
    ],
    status: (form) => (form.clientNotificationsEnabled ? "ok" : "off"),
  },
  {
    id: "avancado",
    label: "Avançado",
    icon: Wrench,
    fields: [
      "salesTrackingId",
      "salesStatusId",
      "defaultBroadcastTrackingId",
    ],
    status: () => null,
  },
];

/**
 * Ajustes do trafeGO em uma seção por vez: a versão anterior empilhava nove
 * blocos numa rolagem única, com o botão de salvar no fim de tudo.
 */
export function TrafegoSettingsPage() {
  const { data: settings, isLoading } = useTrafegoSettings();
  const updateSettings = useUpdateTrafegoSettings();
  const adminPath = useAdminPath();

  const [activeSectionId, setActiveSectionId] = useState(SECTIONS[0].id);
  const [form, setForm] = useState(EMPTY_TRAFEGO_SETTINGS_FORM);
  const [baseline, setBaseline] = useState(EMPTY_TRAFEGO_SETTINGS_FORM);
  const [syncedSettings, setSyncedSettings] = useState<
    TrafegoSettingsPayload | undefined
  >(undefined);

  const changedFields = changedTrafegoSettingsFields(form, baseline);
  const isDirty = changedFields.size > 0;

  // Um refetch (troca de aba, por exemplo) não pode apagar edição em curso.
  if (settings && settings !== syncedSettings && !isDirty) {
    const nextForm = trafegoSettingsToForm(settings);
    setSyncedSettings(settings);
    setBaseline(nextForm);
    setForm(nextForm);
  }

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (SECTIONS.some((section) => section.id === hash)) {
      setActiveSectionId(hash);
    }
  }, []);

  function selectSection(sectionId: string) {
    setActiveSectionId(sectionId);
    window.history.replaceState(null, "", `#${sectionId}`);
  }

  const patch = (partial: Partial<TrafegoSettingsFormState>) =>
    setForm((current) => ({ ...current, ...partial }));

  function handleSave() {
    updateSettings.mutate(trafegoFormToUpdateInput(form), {
      onSuccess: () => {
        setBaseline(form);
        toast.success("Ajustes salvos.");
      },
      onError: (error) => toast.error(error.message),
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Carregando ajustes…
      </div>
    );
  }

  return (
    <div className="p-6 pb-24">
      <Link
        href={adminPath}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Pedidos
      </Link>

      <header className="mt-4">
        <h1 className="text-xl font-bold">Ajustes do trafeGO</h1>
        <p className="text-sm text-muted-foreground">
          Da organização que roda os anúncios até onde o dinheiro é lançado.
          Cada seção é um pedaço do caminho do cliente.
        </p>
      </header>

      <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-start">
        <nav
          aria-label="Seções dos ajustes"
          className="flex gap-1 overflow-x-auto pb-1 lg:sticky lg:top-6 lg:w-56 lg:shrink-0 lg:flex-col lg:overflow-visible lg:pb-0"
        >
          {SECTIONS.map((section) => {
            const isActive = section.id === activeSectionId;
            const hasUnsaved = section.fields.some((field) =>
              changedFields.has(field),
            );

            return (
              <button
                key={section.id}
                type="button"
                onClick={() => selectSection(section.id)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition",
                  isActive
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                )}
              >
                <section.icon className="size-4 shrink-0" />
                <span className="flex-1 whitespace-nowrap">{section.label}</span>
                <StatusDot
                  status={section.status(form)}
                  hasUnsaved={hasUnsaved}
                />
              </button>
            );
          })}
        </nav>

        <div className="min-w-0 flex-1">
          {activeSectionId === "agencia" && (
            <AgencySection form={form} patch={patch} />
          )}
          {activeSectionId === "operacao" && (
            <OperationsSection form={form} patch={patch} />
          )}
          {activeSectionId === "planos" && (
            <PlansSection form={form} patch={patch} />
          )}
          {activeSectionId === "pagamento" && (
            <PaymentSection form={form} patch={patch} />
          )}
          {activeSectionId === "financeiro" && (
            <FinanceSection form={form} patch={patch} />
          )}
          {activeSectionId === "avisos" && (
            <ClientAlertsSection form={form} patch={patch} />
          )}
          {activeSectionId === "avancado" && (
            <AdvancedSection form={form} patch={patch} />
          )}
        </div>
      </div>

      {isDirty && (
        <div className="sticky bottom-4 z-20 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background/95 px-4 py-3 shadow-lg backdrop-blur">
          <p className="text-sm">
            <span className="font-medium">
              {changedFields.size}{" "}
              {changedFields.size === 1 ? "alteração" : "alterações"}
            </span>{" "}
            <span className="text-muted-foreground">sem salvar</span>
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={updateSettings.isPending}
              onClick={() => setForm(baseline)}
            >
              Descartar
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={updateSettings.isPending}
            >
              {updateSettings.isPending ? (
                <Loader2 className="mr-1.5 size-4 animate-spin" />
              ) : (
                <Save className="mr-1.5 size-4" />
              )}
              Salvar alterações
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusDot({
  status,
  hasUnsaved,
}: {
  status: SectionStatus;
  hasUnsaved: boolean;
}) {
  if (hasUnsaved) {
    return (
      <span
        aria-label="Alterações não salvas"
        className="size-1.5 shrink-0 rounded-full bg-primary"
      />
    );
  }
  if (!status) return null;

  return (
    <span
      aria-label={
        status === "ok"
          ? "Configurado"
          : status === "warn"
            ? "Falta configurar"
            : "Desligado"
      }
      className={cn(
        "size-1.5 shrink-0 rounded-full",
        status === "ok" && "bg-emerald-500",
        status === "warn" && "bg-amber-500",
        status === "off" && "bg-muted-foreground/40",
      )}
    />
  );
}
