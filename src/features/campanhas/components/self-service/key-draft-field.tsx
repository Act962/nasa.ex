"use client";

import { useState } from "react";
import { CheckCircle2, ClipboardPaste, Pencil } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSaveKeyDraft } from "../../hooks/use-meta-setup";

export type KeyDraftName = "accessToken" | "appId" | "appSecret" | "appPageUrl" | "businessPageUrl";

const FIELD_COPY: Record<KeyDraftName, { label: string; savedLabel: string; placeholder: string; isSecret: boolean }> = {
  accessToken: { label: "Cole aqui a chave de acesso", savedLabel: "Chave de acesso salva", placeholder: "EAA…", isSecret: true },
  appId: { label: "Cole aqui o ID da conexão (ID do Aplicativo)", savedLabel: "ID da conexão salvo", placeholder: "Ex.: 2140009873262854", isSecret: false },
  appSecret: { label: "Cole aqui a chave secreta", savedLabel: "Chave secreta salva", placeholder: "32 letras e números", isSecret: true },
  appPageUrl: {
    label: "Cole aqui o link desta página (barra de endereço do navegador)",
    savedLabel: "Sua conexão foi encontrada",
    placeholder: "https://developers.facebook.com/apps/…",
    isSecret: false,
  },
  businessPageUrl: {
    label: "Cole aqui o link desta página (barra de endereço): os próximos botões abrem direto no seu portfólio",
    savedLabel: "Portfólio encontrado",
    placeholder: "https://business.facebook.com/latest/…",
    isSecret: false,
  },
};

/**
 * Campo para colar a chave no mesmo passo em que ela é copiada na Meta
 * (spec 0040, RF-14). Salva no banco, cifrada, assim que o cliente cola —
 * o passo "Cole as 3 chaves" já abre preenchido.
 */
export function KeyDraftField({
  trackingId,
  name,
  savedHint,
}: {
  trackingId: string;
  name: KeyDraftName;
  /** Final da chave já salva (segredos) ou o próprio valor (ID do app). */
  savedHint: string | null;
}) {
  const [value, setValue] = useState("");
  const [isEditing, setIsEditing] = useState(!savedHint);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const saveDraft = useSaveKeyDraft();
  const copy = FIELD_COPY[name];

  function save(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) return;
    setErrorMessage(null);
    saveDraft.mutate(
      { trackingId, [name]: trimmed },
      {
        onSuccess: () => {
          setValue("");
          setIsEditing(false);
          toast.success("Salvo! Não precisa voltar aqui depois.");
        },
        onError: (error) => setErrorMessage(error.message),
      },
    );
  }

  if (!isEditing && savedHint) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-success/40 bg-success/5 p-3 text-sm">
        <span className="flex items-center gap-2 text-success dark:text-success">
          <CheckCircle2 className="size-4" />
          {copy.savedLabel}
          <span className="font-mono text-xs text-muted-foreground">{copy.isSecret ? `••••${savedHint}` : savedHint}</span>
        </span>
        <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
          <Pencil className="size-3.5" /> Trocar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-1 rounded-lg border border-dashed border-success/60 p-3">
      <Label htmlFor={`draft-${name}`} className="flex items-center gap-1.5">
        <ClipboardPaste className="size-4 text-success" /> {copy.label}
      </Label>
      <div className="flex gap-2">
        <Input
          id={`draft-${name}`}
          type={copy.isSecret ? "password" : "text"}
          value={value}
          placeholder={copy.placeholder}
          autoComplete="off"
          className="font-mono text-xs"
          aria-invalid={Boolean(errorMessage)}
          onChange={(event) => {
            setValue(event.target.value);
            setErrorMessage(null);
          }}
          onPaste={(event) => {
            const pasted = event.clipboardData.getData("text");
            event.preventDefault();
            setValue(pasted);
            save(pasted);
          }}
        />
        <Button size="sm" onClick={() => save(value)} disabled={!value.trim() || saveDraft.isPending}>
          {saveDraft.isPending ? <OrbitaSpinner className="size-4 " /> : "Salvar"}
        </Button>
      </div>
      {errorMessage ? (
        <p role="alert" className="text-xs font-medium text-destructive dark:text-destructive">
          {errorMessage}
        </p>
      ) : (
        <p className="text-[11px] text-muted-foreground">Fica guardada cifrada. Você pode continuar depois, de qualquer aparelho.</p>
      )}
    </div>
  );
}
