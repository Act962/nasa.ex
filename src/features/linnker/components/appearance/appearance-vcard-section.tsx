"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DownloadIcon, IdCard } from "lucide-react";
import type { AppearanceDraft, UpdateAppearanceDraft, VcardField } from "./appearance-draft";

interface AppearanceVcardSectionProps {
  draft: AppearanceDraft;
  onChange: UpdateAppearanceDraft;
  pageTitle: string;
  pageSlug: string;
}

interface VcardInputConfig {
  field: VcardField;
  label: string;
  placeholder?: string;
  hint?: string;
  maxLength: number;
  type?: "text" | "email" | "date";
  isMonospace?: boolean;
  inputMode?: "tel" | "url" | "email";
}

export function AppearanceVcardSection({ draft, onChange, pageTitle, pageSlug }: AppearanceVcardSectionProps) {
  const updateVcardField = (field: VcardField, value: string) =>
    onChange({ vcard: { ...draft.vcard, [field]: value } });

  const renderInput = (config: VcardInputConfig) => (
    <div key={config.field} className="min-w-0">
      <Label className="text-xs">{config.label}</Label>
      <Input
        type={config.type ?? "text"}
        value={draft.vcard[config.field]}
        onChange={(event) => updateVcardField(config.field, event.target.value)}
        placeholder={config.placeholder}
        inputMode={config.inputMode}
        className={`mt-1 h-10 text-xs sm:h-9 ${config.isMonospace ? "font-mono" : ""}`}
        maxLength={config.maxLength}
        max={config.type === "date" ? "2026-12-31" : undefined}
      />
      {config.hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{config.hint}</p>}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="rounded-[18px] border border-line bg-muted/40 p-3 text-xs leading-relaxed">
        <p className="mb-1 flex items-center gap-1.5 font-semibold">
          <IdCard className="size-3.5" />
          Cartão de contato
        </p>
        <p className="text-muted-foreground">
          Estes dados vão para o arquivo de contato que a pessoa baixa ao tocar em &ldquo;Baixar meu contato&rdquo; no
          QR. No iPhone, aparece &ldquo;Adicionar aos Contatos&rdquo; com tudo preenchido.
        </p>
        <p className="mt-2 text-muted-foreground">
          <strong>Deixe vazio</strong> para usar os dados da página (nome, empresa, WhatsApp das redes sociais etc.).
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {renderInput({ field: "firstName", label: "Primeiro nome", placeholder: pageTitle.split(" ")[0] ?? "", maxLength: 100 })}
        {renderInput({ field: "lastName", label: "Sobrenome", placeholder: pageTitle.split(" ").slice(1).join(" ") || "", maxLength: 100 })}
      </div>

      {renderInput({ field: "jobTitle", label: "Cargo / função", placeholder: "Ex: CEO, Designer, Consultor", maxLength: 200 })}
      {renderInput({ field: "company", label: "Empresa", placeholder: "Padrão: nome da sua empresa na ÓRBITA", maxLength: 200 })}

      <div className="grid grid-cols-2 gap-2">
        {renderInput({
          field: "phone",
          label: "Telefone",
          placeholder: "5586999999999",
          hint: "Só números. Padrão: WhatsApp das redes sociais.",
          maxLength: 20,
          isMonospace: true,
          inputMode: "tel",
        })}
        {renderInput({ field: "birthday", label: "Aniversário", type: "date", maxLength: 10 })}
      </div>

      {renderInput({ field: "email", label: "E-mail", type: "email", placeholder: "Padrão: e-mail do seu usuário", maxLength: 200, inputMode: "email" })}
      {renderInput({
        field: "website",
        label: "Site pessoal (extra)",
        placeholder: "https://meusite.com",
        hint: "O link desta página já vai junto. Este é um extra.",
        maxLength: 500,
        isMonospace: true,
        inputMode: "url",
      })}

      <div>
        <Label className="text-xs">Notas</Label>
        <Textarea
          value={draft.vcard.notes}
          onChange={(event) => updateVcardField("notes", event.target.value)}
          placeholder="Padrão: a descrição da página. Pode escrever algo diferente aqui."
          rows={3}
          className="mt-1 text-xs"
          maxLength={1000}
        />
      </div>

      <a
        href={`/api/linnker/${pageSlug}/vcard`}
        download
        className="flex h-10 items-center justify-center gap-1.5 rounded-full text-xs text-info underline-offset-2 hover:underline"
      >
        <DownloadIcon className="size-3.5" />
        Testar o download do cartão atual
      </a>
    </div>
  );
}
