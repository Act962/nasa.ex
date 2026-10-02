"use client";

import { useState } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Save } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAccountingProfile, useUpdateAccountingProfile } from "@/features/accounting/hooks/use-accounting-profile";
import { REGIME_LABELS } from "@/features/accounting/lib/profile/tax-display";
import { formatBrPhone, formatCnae, onlyDigits } from "@/features/accounting/lib/profile/suggest-simples-annex";
import { formatCentsBrl } from "@/features/accounting/lib/format";
import { parseBrlToCents } from "@/features/accounting/lib/profile/parse-inputs";
import { KNOWN_MUNICIPALITIES, toFormState, toUpdatePayload, type AccountingProfileData, type ProfileFormState } from "./profile-form-state";
import { ActivityStep, AddressStep, AlertsStep, PeopleStep, RegimeStep, type ProfileStepProps } from "./profile-steps";

const MEI_ACTIVITY_VALUES = new Set(["COMERCIO_INDUSTRIA", "SERVICOS", "COMERCIO_SERVICOS"]);
const SIMPLES_ANNEX_VALUES = new Set(["I", "II", "III", "IV", "V"]);

const PROFILE_STEPS: Array<{ id: string; title: string; render: (props: ProfileStepProps) => React.ReactNode }> = [
  { id: "regime", title: "Regime tributário", render: (props) => <RegimeStep {...props} /> },
  { id: "activity", title: "Atividade", render: (props) => <ActivityStep {...props} /> },
  { id: "address", title: "Endereço fiscal", render: (props) => <AddressStep {...props} /> },
  { id: "people", title: "Pessoas e folha", render: (props) => <PeopleStep {...props} /> },
  { id: "alerts", title: "Avisos no WhatsApp", render: (props) => <AlertsStep {...props} /> },
];

function formatCnpj(cnpj: string): string {
  const digits = onlyDigits(cnpj);
  if (digits.length !== 14) return cnpj;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

/** Ao trocar de regime, descarta o anexo/atividade que só fazia sentido no regime anterior. */
function applyFormPatch(current: ProfileFormState, patch: Partial<ProfileFormState>): ProfileFormState {
  const next = { ...current, ...patch };
  if (patch.regime && patch.regime !== current.regime) {
    const isAnnexValid = next.regime === "MEI" ? MEI_ACTIVITY_VALUES.has(next.simplesAnnex) : SIMPLES_ANNEX_VALUES.has(next.simplesAnnex);
    if (!isAnnexValid) next.simplesAnnex = "";
  }
  return next;
}

function ProfileSummary({ form }: { form: ProfileFormState }) {
  const municipalityName = KNOWN_MUNICIPALITIES[form.municipioIbge] ?? form.municipioIbge;
  const summaryRows: Array<[string, string]> = [
    ["Regime", REGIME_LABELS[form.regime]],
    ["CNAE principal", form.cnaePrincipal ? formatCnae(form.cnaePrincipal) : "—"],
    [form.regime === "MEI" ? "Atividade" : "Anexo", form.simplesAnnex || "—"],
    ["Endereço fiscal", `${municipalityName || "—"} / ${form.uf || "—"}`],
    ["Funcionários", form.hasEmployees ? "Sim" : "Não"],
    ["Folha 12 meses", formatCentsBrl(parseBrlToCents(form.payroll12mText))],
    ["Avisos para", form.alertPhones.length > 0 ? form.alertPhones.map(formatBrPhone).join(", ") : "ninguém ainda"],
  ];
  return (
    <dl className="divide-y rounded-lg border text-sm">
      {summaryRows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-3 px-3 py-2">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="text-right font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ProfileEditor({ profile, onNavigate }: { profile: AccountingProfileData; onNavigate?: (section: string) => void }) {
  const [form, setForm] = useState<ProfileFormState>(() => toFormState(profile));
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [openSectionIds, setOpenSectionIds] = useState<Set<string>>(() => new Set(["regime"]));
  const updateProfile = useUpdateAccountingProfile();
  const isOnboarded = Boolean(profile.onboardingCompletedAt);
  const isLastStep = currentStepIndex === PROFILE_STEPS.length - 1;

  const stepProps: ProfileStepProps = {
    form,
    onChange: (patch) => setForm((current) => applyFormPatch(current, patch)),
    onNavigate,
  };

  function handleSave(shouldCompleteOnboarding: boolean) {
    updateProfile.mutate(
      { ...toUpdatePayload(form), ...(shouldCompleteOnboarding ? { completeOnboarding: true } : {}) },
      {
        onSuccess: () => {
          if (shouldCompleteOnboarding) {
            toast.success("Perfil fiscal ativado!", {
              description: "Estamos gerando a contabilidade de todo o seu histórico em segundo plano. Pode continuar usando o sistema.",
            });
            onNavigate?.("overview");
            return;
          }
          toast.success("Perfil fiscal salvo. O calendário de obrigações foi atualizado.");
        },
        onError: (error) => toast.error(error.message || "Não foi possível salvar o perfil."),
      },
    );
  }

  function toggleSection(sectionId: string, isOpen: boolean) {
    setOpenSectionIds((current) => {
      const next = new Set(current);
      if (isOpen) next.add(sectionId);
      else next.delete(sectionId);
      return next;
    });
  }

  const cnpjLine = (
    <p className="text-sm text-muted-foreground">
      CNPJ da empresa:{" "}
      <span className="font-mono font-medium text-foreground">{profile.organizationCnpj ? formatCnpj(profile.organizationCnpj) : "não cadastrado"}</span>
      <span className="block text-xs">O CNPJ vem do cadastro da organização e não é alterado aqui.</span>
    </p>
  );

  if (isOnboarded) {
    return (
      <div className="space-y-4">
        {cnpjLine}
        {PROFILE_STEPS.map((step) => {
          const isOpen = openSectionIds.has(step.id);
          return (
            <Collapsible key={step.id} open={isOpen} onOpenChange={(open) => toggleSection(step.id, open)}>
              <Card className="gap-0 py-0">
                <CollapsibleTrigger asChild>
                  <button type="button" className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold">
                    {step.title}
                    <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pb-4">{step.render(stepProps)}</CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          );
        })}
        <div className="sticky bottom-3 flex justify-end">
          <Button className="gap-1.5 bg-info text-white shadow-md hover:bg-info" disabled={updateProfile.isPending} onClick={() => handleSave(false)}>
            {updateProfile.isPending ? <OrbitaSpinner className="size-4 " /> : <Save className="size-4" />}
            Salvar alterações
          </Button>
        </div>
      </div>
    );
  }

  const currentStep = PROFILE_STEPS[currentStepIndex];
  return (
    <div className="space-y-4">
      {cnpjLine}
      <ol className="flex items-center gap-1.5 overflow-x-auto pb-1" aria-label="Etapas do perfil fiscal">
        {PROFILE_STEPS.map((step, index) => {
          const isDone = index < currentStepIndex;
          const isCurrent = index === currentStepIndex;
          return (
            <li key={step.id} className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentStepIndex(index)}
                aria-current={isCurrent ? "step" : undefined}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
                  isCurrent && "border-info bg-info/10 text-info dark:text-info",
                  isDone && "text-success dark:text-success",
                  !isCurrent && !isDone && "text-muted-foreground",
                )}
              >
                <span className="flex size-4 items-center justify-center rounded-full bg-muted text-[10px]">
                  {isDone ? <Check className="size-3" /> : index + 1}
                </span>
                <span className={cn(!isCurrent && "hidden sm:inline")}>{step.title}</span>
              </button>
              {index < PROFILE_STEPS.length - 1 && <span className="h-px w-3 bg-border" aria-hidden />}
            </li>
          );
        })}
      </ol>

      <Card className="gap-4">
        <CardHeader className="pb-0">
          <CardTitle className="text-base">
            Passo {currentStepIndex + 1} de {PROFILE_STEPS.length} · {currentStep.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {currentStep.render(stepProps)}
          {isLastStep && (
            <div className="space-y-2">
              <p className="text-sm font-semibold">Confira antes de ativar</p>
              <ProfileSummary form={form} />
            </div>
          )}
          <div className="flex items-center justify-between gap-2 border-t pt-4">
            <Button
              type="button"
              variant="ghost"
              className="gap-1"
              disabled={currentStepIndex === 0}
              onClick={() => setCurrentStepIndex((index) => Math.max(0, index - 1))}
            >
              <ChevronLeft className="size-4" />
              Voltar
            </Button>
            {isLastStep ? (
              <Button className="gap-1.5 bg-info text-white hover:bg-info" disabled={updateProfile.isPending} onClick={() => handleSave(true)}>
                {updateProfile.isPending ? <OrbitaSpinner className="size-4 " /> : <Check className="size-4" />}
                Concluir e ativar
              </Button>
            ) : (
              <Button
                type="button"
                className="gap-1 bg-info text-white hover:bg-info"
                onClick={() => setCurrentStepIndex((index) => Math.min(PROFILE_STEPS.length - 1, index + 1))}
              >
                Continuar
                <ChevronRight className="size-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** Perfil fiscal: wizard na primeira vez, formulário em seções depois de ativado. */
export function TaxProfileSection({ onNavigate }: { onNavigate?: (section: string) => void }) {
  const profileQuery = useAccountingProfile();

  if (profileQuery.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }
  if (profileQuery.isError || !profileQuery.data) {
    return (
      <Card className="py-0">
        <CardContent className="flex flex-col items-start gap-3 py-6">
          <p className="text-sm text-muted-foreground">Não foi possível carregar o perfil fiscal agora.</p>
          <Button size="sm" variant="outline" onClick={() => profileQuery.refetch()}>
            Tentar de novo
          </Button>
        </CardContent>
      </Card>
    );
  }
  // A key remonta o editor quando o perfil é ativado, trocando o wizard pelo modo edição.
  return (
    <ProfileEditor
      key={`${profileQuery.data.id}-${profileQuery.data.onboardingCompletedAt ? "edit" : "wizard"}`}
      profile={profileQuery.data}
      onNavigate={onNavigate}
    />
  );
}
