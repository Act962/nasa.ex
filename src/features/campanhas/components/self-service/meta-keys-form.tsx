"use client";

import { useState } from "react";
import { CheckCircle2, ExternalLink, KeyRound } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSaveMetaKeys } from "../../hooks/use-meta-setup";
import { KeyDraftField } from "./key-draft-field";
import { MetaLogo } from "@/features/meta-guide/components/meta-logo";
import { GUIDE_STEPS, guideStepLink } from "../../lib/whatsapp-connect-guide";

const API_SETUP_STEP = GUIDE_STEPS.find((step) => step.linkKey === "waApiSetup");

type WabaOption = { id: string; name: string | null };

export interface KeyDraftsView {
  accessToken: { isSaved: boolean; last4: string | null };
  appId: string | null;
  appSecret: { isSaved: boolean; last4: string | null };
  businessId?: string | null;
}

/**
 * "Cole as 3 chaves" (spec 0040, RF-11/RF-14): abre com o que o cliente já
 * colou nos passos anteriores; a ÓRBITA confere na Meta, descobre a conta e
 * preenche as configurações do funil.
 */
export function MetaKeysForm({
  trackingId,
  drafts,
  hasSavedKeys,
  onSaved,
}: {
  trackingId: string;
  drafts: KeyDraftsView;
  hasSavedKeys: boolean;
  onSaved: () => void;
}) {
  const [wabaOptions, setWabaOptions] = useState<WabaOption[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAskingWabaId, setIsAskingWabaId] = useState(false);
  const [wabaIdInput, setWabaIdInput] = useState("");
  const saveKeys = useSaveMetaKeys();
  const isComplete = drafts.accessToken.isSaved && Boolean(drafts.appId) && drafts.appSecret.isSaved;

  if (hasSavedKeys && !isComplete) {
    return (
      <p className="flex items-start gap-2 rounded-lg border border-success/40 bg-success/5 p-3 text-sm text-success dark:text-success">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> Chaves conferidas e guardadas no seu funil. Pode seguir.
      </p>
    );
  }

  function submit(wabaId?: string) {
    setErrorMessage(null);
    saveKeys.mutate(
      { trackingId, wabaId },
      {
        onSuccess: (result) => {
          if (result.status === "choose_waba") {
            setWabaOptions(result.wabas);
            return;
          }
          if (result.status === "need_waba_id") {
            setIsAskingWabaId(true);
            return;
          }
          setIsAskingWabaId(false);
          setWabaOptions(null);
          if (result.webhook.detail) toast.warning(result.webhook.detail);
          toast.success(`Chaves conferidas! ${result.phones.length} número(s) na sua conta. Já preenchemos as configurações do seu funil.`);
          onSaved();
        },
        onError: (error) => setErrorMessage(error.message),
      },
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-success/40 bg-success/5 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <KeyRound className="size-4 text-success" /> Suas 3 chaves
      </p>
      <KeyDraftField trackingId={trackingId} name="accessToken" savedHint={drafts.accessToken.last4} />
      <KeyDraftField trackingId={trackingId} name="appId" savedHint={drafts.appId} />
      <KeyDraftField trackingId={trackingId} name="appSecret" savedHint={drafts.appSecret.last4} />

      {wabaOptions && (
        <div className="space-y-2 rounded-md border bg-background p-3">
          <p className="text-sm font-medium">Qual conta do WhatsApp vai disparar?</p>
          {wabaOptions.map((waba) => (
            <Button key={waba.id} variant="outline" size="sm" className="mr-2" onClick={() => submit(waba.id)} disabled={saveKeys.isPending}>
              {waba.name ?? waba.id}
            </Button>
          ))}
        </div>
      )}

      {isAskingWabaId && (
        <div className="space-y-2 rounded-md border bg-background p-3">
          <Label htmlFor="waba-id" className="text-sm font-medium">
            Falta só o ID da sua conta do WhatsApp
          </Label>
          <p className="text-xs text-muted-foreground">
            Abra a tela abaixo e clique no ícone de copiar ao lado de <strong>Identificação da conta do WhatsApp Business</strong>.
            Depois é só colar aqui — a ÓRBITA confere na hora.
          </p>
          {API_SETUP_STEP && (
            <Button
              asChild
              size="sm"
              variant="outline"
              className="border-brand-facebook/40 text-brand-facebook hover:bg-brand-facebook/10 hover:text-brand-facebook"
            >
              <a
                href={guideStepLink(API_SETUP_STEP, { appId: drafts.appId, businessId: drafts.businessId ?? null }) ?? "#"}
                target="_blank"
                rel="noreferrer"
              >
                <MetaLogo className="size-4" /> Abrir Configuração da API <ExternalLink className="size-3.5 opacity-70" />
              </a>
            </Button>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/guides/whatsapp-oficial/extras/04-copiar-id-conta.webp"
            alt="Onde copiar a Identificação da conta do WhatsApp Business"
            className="w-full rounded border"
          />
          <div className="flex gap-2">
            <Input
              id="waba-id"
              inputMode="numeric"
              value={wabaIdInput}
              placeholder="Cole aqui o ID (só números)"
              className="font-mono text-xs"
              disabled={saveKeys.isPending}
              onChange={(event) => setWabaIdInput(event.target.value)}
              onKeyDown={(event) => {
                const typedId = wabaIdInput.replace(/\D/g, "");
                if (event.key === "Enter" && typedId) submit(typedId);
              }}
              onPaste={(event) => {
                const pastedId = event.clipboardData.getData("text").replace(/\D/g, "");
                if (!pastedId) return;
                event.preventDefault();
                setWabaIdInput(pastedId);
                submit(pastedId);
              }}
            />
            <Button
              size="sm"
              onClick={() => submit(wabaIdInput.replace(/\D/g, ""))}
              disabled={!wabaIdInput.replace(/\D/g, "") || saveKeys.isPending}
            >
              Conferir
            </Button>
          </div>
          {saveKeys.isPending && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <OrbitaSpinner className="size-3.5 " /> Conferindo na Meta…
            </p>
          )}
        </div>
      )}

      {errorMessage && (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs font-medium text-destructive dark:text-destructive">
          {errorMessage}
        </p>
      )}

      <Button onClick={() => submit()} disabled={!isComplete || saveKeys.isPending} className="bg-success text-white hover:bg-success">
        {saveKeys.isPending && <OrbitaSpinner className="size-4 " />} Conferir e salvar
      </Button>
    </div>
  );
}
