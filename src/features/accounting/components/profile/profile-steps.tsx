"use client";

import { useState } from "react";
import { Calculator, Lightbulb, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { REGIME_LABELS, REGIME_TERM_IDS, type TaxRegimeDisplay } from "@/features/accounting/lib/profile/tax-display";
import {
  formatBrPhone,
  formatCnae,
  normalizeBrPhone,
  onlyDigits,
  suggestSimplesAnnex,
} from "@/features/accounting/lib/profile/suggest-simples-annex";
import { FiscalTermHint, TermLabel } from "../shared/fiscal-term-hint";
import { BRAZILIAN_UFS, KNOWN_MUNICIPALITIES, type ProfileFormState } from "./profile-form-state";

export interface ProfileStepProps {
  form: ProfileFormState;
  onChange: (patch: Partial<ProfileFormState>) => void;
  onNavigate?: (section: string) => void;
}

export function WhyWeAsk({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex gap-2 rounded-md bg-violet-500/5 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
      <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-violet-600" />
      <span>
        <strong className="font-medium text-foreground">Por que perguntamos isso? </strong>
        {children}
      </span>
    </p>
  );
}

function ToggleRow({
  label,
  description,
  termId,
  checked,
  onCheckedChange,
}: {
  label: string;
  description?: string;
  termId?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border px-3 py-2.5">
      <span className="space-y-0.5">
        <TermLabel termId={termId} className="text-sm font-medium">
          {label}
        </TermLabel>
        {description && <span className="block text-xs text-muted-foreground">{description}</span>}
      </span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={label} />
    </div>
  );
}

const REGIME_OPTIONS: Array<{ regime: TaxRegimeDisplay; summary: string }> = [
  { regime: "MEI", summary: "Fatura até R$ 81 mil por ano e paga um valor fixo mensal, sem importar o quanto vendeu." },
  { regime: "SIMPLES", summary: "Fatura até R$ 4,8 milhões por ano e paga quase tudo numa guia única (DAS), com alíquota que cresce com o faturamento." },
  { regime: "PRESUMIDO", summary: "A Receita presume um lucro (ex.: 32% em serviços) e cobra IRPJ/CSLL sobre ele, mais PIS/COFINS e ISS/ICMS separados." },
  { regime: "REAL", summary: "Imposto sobre o lucro de verdade. Obrigatório acima de R$ 78 milhões por ano ou para bancos; exige contabilidade completa." },
];

export function RegimeStep({ form, onChange, onNavigate }: ProfileStepProps) {
  return (
    <div className="space-y-4">
      <WhyWeAsk>
        O regime tributário define quais impostos a empresa paga, como calculamos cada guia e quais prazos entram no seu calendário. Ele está no
        cartão CNPJ ou com seu contador.
      </WhyWeAsk>
      <div role="radiogroup" aria-label="Regime tributário" className="grid gap-2 sm:grid-cols-2">
        {REGIME_OPTIONS.map((option) => {
          const isSelected = form.regime === option.regime;
          return (
            <div
              key={option.regime}
              role="radio"
              tabIndex={0}
              aria-checked={isSelected}
              onClick={() => onChange({ regime: option.regime })}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onChange({ regime: option.regime });
                }
              }}
              className={cn(
                "cursor-pointer space-y-1 rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
                isSelected ? "border-violet-500 bg-violet-500/10" : "hover:bg-muted/50",
              )}
            >
              <span className="flex items-center gap-1.5 text-sm font-semibold">
                {REGIME_LABELS[option.regime]}
                <FiscalTermHint termId={REGIME_TERM_IDS[option.regime]} />
              </span>
              <span className="block text-xs text-muted-foreground">{option.summary}</span>
            </div>
          );
        })}
      </div>
      <Button type="button" variant="link" size="sm" className="h-auto gap-1.5 px-0 text-violet-600 dark:text-violet-300" onClick={() => onNavigate?.("calculator")}>
        <Calculator className="size-3.5" />
        Não sabe qual compensa mais? Compare os regimes na calculadora
      </Button>
    </div>
  );
}

const ANNEX_OPTIONS = ["I", "II", "III", "IV", "V"];
const MEI_ACTIVITY_OPTIONS = [
  { value: "COMERCIO_INDUSTRIA", label: "Comércio ou indústria" },
  { value: "SERVICOS", label: "Serviços" },
  { value: "COMERCIO_SERVICOS", label: "Comércio e serviços" },
];

export function ActivityStep({ form, onChange }: ProfileStepProps) {
  const [secondaryDraft, setSecondaryDraft] = useState("");
  const suggestion = suggestSimplesAnnex(form.cnaePrincipal);
  const isMei = form.regime === "MEI";
  const isSimples = form.regime === "SIMPLES";

  function handleCnaeChange(value: string) {
    const digits = onlyDigits(value).slice(0, 7);
    const nextSuggestion = suggestSimplesAnnex(digits);
    // Só aplica a sugestão enquanto o anexo estiver vazio: escolha do dono nunca é sobrescrita.
    const shouldApplySuggestion = isSimples && !form.simplesAnnex && nextSuggestion !== null;
    onChange({
      cnaePrincipal: digits,
      ...(shouldApplySuggestion ? { simplesAnnex: nextSuggestion.annex, isFatorRSubject: nextSuggestion.isFatorRSubject } : {}),
    });
  }

  function handleAddSecondary() {
    const digits = onlyDigits(secondaryDraft);
    if (digits.length !== 7 || form.cnaesSecundarios.includes(digits)) return;
    onChange({ cnaesSecundarios: [...form.cnaesSecundarios, digits] });
    setSecondaryDraft("");
  }

  return (
    <div className="space-y-4">
      <WhyWeAsk>
        A atividade (CNAE) define em qual tabela do Simples você cai, se paga ISS ou ICMS e quais obrigações se aplicam. Um anexo errado pode fazer
        você pagar muito mais — ou menos, e depois ser cobrado com multa.
      </WhyWeAsk>

      <div className="space-y-1.5">
        <Label htmlFor="cnae-principal">
          <TermLabel termId="cnae">CNAE principal</TermLabel>
        </Label>
        <Input
          id="cnae-principal"
          inputMode="numeric"
          placeholder="0000-0/00"
          value={formatCnae(form.cnaePrincipal)}
          onChange={(event) => handleCnaeChange(event.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cnae-secundario">CNAEs secundários</Label>
        <div className="flex gap-2">
          <Input
            id="cnae-secundario"
            inputMode="numeric"
            placeholder="0000-0/00"
            value={formatCnae(secondaryDraft)}
            onChange={(event) => setSecondaryDraft(onlyDigits(event.target.value).slice(0, 7))}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleAddSecondary();
              }
            }}
          />
          <Button type="button" variant="outline" size="icon" aria-label="Adicionar CNAE secundário" onClick={handleAddSecondary}>
            <Plus className="size-4" />
          </Button>
        </div>
        {form.cnaesSecundarios.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {form.cnaesSecundarios.map((cnae) => (
              <li key={cnae} className="inline-flex items-center gap-1 rounded-full border bg-muted/50 px-2 py-0.5 font-mono text-xs">
                {formatCnae(cnae)}
                <button
                  type="button"
                  aria-label={`Remover ${formatCnae(cnae)}`}
                  onClick={() => onChange({ cnaesSecundarios: form.cnaesSecundarios.filter((existing) => existing !== cnae) })}
                >
                  <X className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {isMei && (
        <div className="space-y-1.5">
          <Label>
            <TermLabel termId="das-mei">Atividade do MEI</TermLabel>
          </Label>
          <Select value={form.simplesAnnex || undefined} onValueChange={(value) => onChange({ simplesAnnex: value })}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Escolha a atividade" />
            </SelectTrigger>
            <SelectContent>
              {MEI_ACTIVITY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Define se o DAS-MEI inclui ICMS (comércio/indústria), ISS (serviços) ou os dois.</p>
        </div>
      )}

      {isSimples && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>
              <TermLabel termId="anexo-simples">Anexo do Simples</TermLabel>
            </Label>
            <Select value={form.simplesAnnex || undefined} onValueChange={(value) => onChange({ simplesAnnex: value })}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Escolha o anexo" />
              </SelectTrigger>
              <SelectContent>
                {ANNEX_OPTIONS.map((annex) => (
                  <SelectItem key={annex} value={annex}>
                    Anexo {annex}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {suggestion && (
              <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                <span>
                  <strong className="text-foreground">Sugestão pelo CNAE: Anexo {suggestion.annex}.</strong> {suggestion.reason} Confirme com seu
                  contador.
                </span>
                {form.simplesAnnex !== suggestion.annex && (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-7"
                    onClick={() => onChange({ simplesAnnex: suggestion.annex, isFatorRSubject: suggestion.isFatorRSubject })}
                  >
                    Usar sugestão
                  </Button>
                )}
              </div>
            )}
          </div>
          <label className="flex items-start gap-2.5 text-sm">
            <Checkbox checked={form.isFatorRSubject} onCheckedChange={(checked) => onChange({ isFatorRSubject: checked === true })} className="mt-0.5" />
            <span>
              <TermLabel termId="fator-r">Serviço sujeito ao Fator R</TermLabel>
              <span className="block text-xs text-muted-foreground">
                Se a folha dos últimos 12 meses for 28% ou mais do faturamento, o imposto cai do Anexo V para o III.
              </span>
            </span>
          </label>
        </div>
      )}
    </div>
  );
}

export function AddressStep({ form, onChange }: ProfileStepProps) {
  const municipalityName = KNOWN_MUNICIPALITIES[onlyDigits(form.municipioIbge)];
  return (
    <div className="space-y-4">
      <WhyWeAsk>
        O endereço define quem cobra o ISS (a prefeitura) e o ICMS (o estado), os prazos locais e quais certidões você precisa manter em dia.
      </WhyWeAsk>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>UF</Label>
          <Select value={form.uf} onValueChange={(value) => onChange({ uf: value })}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BRAZILIAN_UFS.map((uf) => (
                <SelectItem key={uf} value={uf}>
                  {uf}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="municipio-ibge">Código do município (IBGE)</Label>
          <Input
            id="municipio-ibge"
            inputMode="numeric"
            maxLength={7}
            value={form.municipioIbge}
            onChange={(event) => onChange({ municipioIbge: onlyDigits(event.target.value).slice(0, 7) })}
          />
          <p className="text-xs text-muted-foreground">{municipalityName ? municipalityName : "7 dígitos — encontre no site do IBGE."}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inscricao-estadual">
            <TermLabel termId="icms">Inscrição estadual (IE)</TermLabel>
          </Label>
          <Input id="inscricao-estadual" value={form.stateRegistration} onChange={(event) => onChange({ stateRegistration: event.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inscricao-municipal">
            <TermLabel termId="iss">Inscrição municipal (IM)</TermLabel>
          </Label>
          <Input
            id="inscricao-municipal"
            value={form.municipalRegistration}
            onChange={(event) => onChange({ municipalRegistration: event.target.value })}
          />
        </div>
      </div>
      <ToggleRow
        label="Contribuinte de ICMS"
        description="Vende mercadorias ou presta transporte/comunicação."
        termId="icms"
        checked={form.isIcmsContributor}
        onCheckedChange={(checked) => onChange({ isIcmsContributor: checked })}
      />
      <ToggleRow
        label="Contribuinte de ISS"
        description="Presta serviços."
        termId="iss"
        checked={form.isIssContributor}
        onCheckedChange={(checked) => onChange({ isIssContributor: checked })}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {form.isIssContributor && (
          <div className="space-y-1.5">
            <Label htmlFor="aliquota-iss">
              <TermLabel termId="iss">Alíquota de ISS (%)</TermLabel>
            </Label>
            <Input
              id="aliquota-iss"
              inputMode="decimal"
              placeholder="5"
              value={form.issRateText}
              onChange={(event) => onChange({ issRateText: event.target.value })}
            />
            <p className="text-xs text-muted-foreground">Entre 2% e 5%, conforme a lei do município.</p>
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="data-abertura">Data de abertura</Label>
          <Input id="data-abertura" type="date" value={form.openedAt} onChange={(event) => onChange({ openedAt: event.target.value })} />
          <p className="text-xs text-muted-foreground">
            Empresas com menos de 12 meses têm o <TermLabel termId="rbt12">faturamento proporcional</TermLabel>.
          </p>
        </div>
      </div>
    </div>
  );
}

export function PeopleStep({ form, onChange }: ProfileStepProps) {
  return (
    <div className="space-y-4">
      <WhyWeAsk>
        A folha de pagamento muda o imposto: no Simples ela decide o <TermLabel termId="fator-r">Fator R</TermLabel>, e ter funcionários traz
        obrigações como FGTS e eSocial para o seu calendário.
      </WhyWeAsk>
      <ToggleRow
        label="A empresa tem funcionários"
        description="CLT registrados (não conta pró-labore dos sócios)."
        checked={form.hasEmployees}
        onCheckedChange={(checked) => onChange({ hasEmployees: checked })}
      />
      <div className="space-y-1.5">
        <Label htmlFor="folha-12-meses">
          <TermLabel termId="folha-12-meses">Folha dos últimos 12 meses (R$)</TermLabel>
        </Label>
        <Input
          id="folha-12-meses"
          inputMode="decimal"
          placeholder="0,00"
          value={form.payroll12mText}
          onChange={(event) => onChange({ payroll12mText: event.target.value })}
        />
        <p className="text-xs text-muted-foreground">Salários + pró-labore + encargos (INSS patronal e FGTS) somados nos últimos 12 meses.</p>
      </div>

      {form.regime === "PRESUMIDO" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="presuncao-irpj">
              <TermLabel termId="lucro-presumido">Presunção do IRPJ (%)</TermLabel>
            </Label>
            <Input
              id="presuncao-irpj"
              inputMode="decimal"
              value={form.presumedIrpjBaseText}
              onChange={(event) => onChange({ presumedIrpjBaseText: event.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="presuncao-csll">Presunção da CSLL (%)</Label>
            <Input
              id="presuncao-csll"
              inputMode="decimal"
              value={form.presumedCsllBaseText}
              onChange={(event) => onChange({ presumedCsllBaseText: event.target.value })}
            />
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-2">
            32% é o padrão de serviços. Comércio e indústria costumam usar 8% (IRPJ) e 12% (CSLL).
          </p>
        </div>
      )}

      {form.regime === "SIMPLES" && (
        <div className="space-y-1.5">
          <ToggleRow
            label="Recolher IBS/CBS por fora do Simples"
            description="Seus clientes empresas passam a aproveitar o crédito cheio. Em troca, esses dois tributos saem do DAS e são pagos à parte."
            termId="simples-por-fora"
            checked={form.ibsCbsOutsideSimples}
            onCheckedChange={(checked) => onChange({ ibsCbsOutsideSimples: checked })}
          />
          <p className="text-xs text-amber-700 dark:text-amber-300">Essa opção só vale a partir de 2027. Em 2026 tudo continua dentro do DAS.</p>
        </div>
      )}
    </div>
  );
}

export function AlertsStep({ form, onChange }: ProfileStepProps) {
  const [phoneDraft, setPhoneDraft] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);

  function handleAddPhone() {
    const normalizedPhone = normalizeBrPhone(phoneDraft);
    if (!normalizedPhone) {
      setPhoneError("Informe DDD + número, ex.: (86) 99999-8888.");
      return;
    }
    if (form.alertPhones.includes(normalizedPhone)) {
      setPhoneError("Esse número já está na lista.");
      return;
    }
    if (form.alertPhones.length >= 10) {
      setPhoneError("Máximo de 10 telefones.");
      return;
    }
    onChange({ alertPhones: [...form.alertPhones, normalizedPhone] });
    setPhoneDraft("");
    setPhoneError(null);
  }

  return (
    <div className="space-y-4">
      <WhyWeAsk>
        Mandamos um aviso no WhatsApp 5, 2 e 0 dias antes de cada prazo fiscal. Coloque quem paga as contas e, se quiser, o seu contador.
      </WhyWeAsk>
      <div className="space-y-1.5">
        <Label htmlFor="telefone-aviso">Telefones que recebem os avisos</Label>
        <div className="flex gap-2">
          <Input
            id="telefone-aviso"
            inputMode="tel"
            placeholder="(86) 99999-8888"
            value={formatBrPhone(phoneDraft)}
            onChange={(event) => {
              setPhoneDraft(onlyDigits(event.target.value).slice(0, 13));
              setPhoneError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleAddPhone();
              }
            }}
          />
          <Button type="button" variant="outline" size="icon" aria-label="Adicionar telefone" onClick={handleAddPhone}>
            <Plus className="size-4" />
          </Button>
        </div>
        {phoneError && <p className="text-xs text-red-600 dark:text-red-400">{phoneError}</p>}
        {form.alertPhones.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum telefone ainda. Sem telefone, os avisos aparecem só aqui no sistema.</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {form.alertPhones.map((phone) => (
              <li key={phone} className="inline-flex items-center gap-1 rounded-full border bg-muted/50 px-2.5 py-0.5 text-xs tabular-nums">
                {formatBrPhone(phone)}
                <button
                  type="button"
                  aria-label={`Remover ${formatBrPhone(phone)}`}
                  onClick={() => onChange({ alertPhones: form.alertPhones.filter((existing) => existing !== phone) })}
                >
                  <X className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
