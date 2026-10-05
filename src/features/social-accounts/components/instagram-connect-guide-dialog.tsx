"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Instagram, Plug } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RequestTeamHelp } from "@/features/campanhas/components/self-service/request-team-help";
import { MetaGuideStepper } from "@/features/meta-guide/components/meta-guide-stepper";
import type { MetaGuideStep } from "@/features/meta-guide/lib/types";
import {
  CONNECT_STEP_SLUG,
  FIRST_KEY_STEP_SLUG,
  INSTAGRAM_GUIDE,
  INSTAGRAM_GUIDE_STEPS,
  KEY_STEP_SLUGS,
  WEBHOOK_STEP_SLUG,
  generateVerifyToken,
  isAccessTokenValid,
  isAppSecretValid,
  isInstagramAccountIdValid,
  looksLikeInstagramAppId,
} from "../lib/instagram-connect-guide";
import {
  useConnectSocialAccount,
  useReconnectSocialAccount,
  useSocialAccountWebhookSetup,
} from "../hooks/use-social-accounts";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { emitTourResult } from "@/features/tour/store";
import { GUIDE_RESULT_KINDS } from "@/features/astro-guides/lib/result-kinds";

const PROGRESS_STORAGE_KEY = "orbita:comments-instagram-guide";

interface StoredProgress {
  slug: string | null;
  cheeredIds: string[];
}

function readStoredProgress(): StoredProgress {
  try {
    const raw = window.localStorage.getItem(PROGRESS_STORAGE_KEY);
    if (!raw) return { slug: null, cheeredIds: [] };
    const parsed = JSON.parse(raw) as Partial<StoredProgress>;
    return { slug: parsed.slug ?? null, cheeredIds: parsed.cheeredIds ?? [] };
  } catch {
    return { slug: null, cheeredIds: [] };
  }
}

function writeStoredProgress(progress: StoredProgress) {
  try {
    window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Modo privado: o guia funciona, só não lembra o passo (spec 0047, CB-5).
  }
}

type KeyName = keyof typeof KEY_STEP_SLUGS;

const KEY_FIELDS: Record<KeyName, { label: string; placeholder: string; isSecret: boolean }> = {
  accountId: { label: "ID da conta do Instagram", placeholder: "17841400000000000", isSecret: false },
  accessToken: { label: "Token de acesso", placeholder: "IGAA...", isSecret: true },
  appSecret: { label: "Chave secreta do app do Instagram", placeholder: "32 caracteres", isSecret: true },
};

const KEY_VALIDATORS: Record<KeyName, (value: string) => boolean> = {
  accountId: isInstagramAccountIdValid,
  accessToken: isAccessTokenValid,
  appSecret: isAppSecretValid,
};

function keyNameForStep(slug: string): KeyName | null {
  const entry = Object.entries(KEY_STEP_SLUGS).find(([, stepSlug]) => stepSlug === slug);
  return entry ? (entry[0] as KeyName) : null;
}

function stepIndexOf(slug: string | null): number {
  return INSTAGRAM_GUIDE_STEPS.findIndex((step) => step.slug === slug);
}

/** Conta já conectada sobre a qual o guia atua: trocar a credencial ou rever o webhook. */
export interface GuideTargetAccount {
  id: string;
  externalAccountId: string;
  /** `webhook` reabre direto no passo do webhook (spec 0069, CB-11). */
  startAt: "keys" | "webhook";
}

/**
 * Popup "Conectar Instagram" (specs 0047 e 0069): as telas da Meta uma de cada
 * vez, com as chaves coladas no passo em que são copiadas. Sem `targetAccount`,
 * adiciona uma conta nova à organização.
 */
export function InstagramConnectGuideDialog({
  open,
  onOpenChange,
  targetAccount,
  onConnected,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetAccount?: GuideTargetAccount;
  onConnected?: (accountId: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[min(92vh,860px)] flex-col overflow-hidden sm:max-w-3xl lg:max-w-5xl"
        onInteractOutside={(event) => event.preventDefault()}
        data-guide={GUIDE_ANCHORS.commentsConnectDialog.id}
      >
        {open && (
          <GuideContent
            targetAccount={targetAccount}
            onConnected={onConnected}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function resolveInitialSlug(targetAccount: GuideTargetAccount | undefined, storedSlug: string | null): string | null {
  if (targetAccount) return targetAccount.startAt === "webhook" ? WEBHOOK_STEP_SLUG : FIRST_KEY_STEP_SLUG;
  // Conta nova: o progresso salvo depois do "Conectar" era de outra conta. Recomeça nas chaves.
  if (stepIndexOf(storedSlug) > stepIndexOf(CONNECT_STEP_SLUG)) return FIRST_KEY_STEP_SLUG;
  return storedSlug;
}

function GuideContent({
  targetAccount,
  onConnected,
  onClose,
}: {
  targetAccount?: GuideTargetAccount;
  onConnected?: (accountId: string) => void;
  onClose: () => void;
}) {
  const [storedProgress] = useState(readStoredProgress);
  const [initialSlug] = useState(() => resolveInitialSlug(targetAccount, storedProgress.slug));
  const [cheeredIds, setCheeredIds] = useState(() => new Set(storedProgress.cheeredIds));
  const [currentStep, setCurrentStep] = useState<MetaGuideStep>(
    () => INSTAGRAM_GUIDE_STEPS.find((step) => step.slug === initialSlug) ?? INSTAGRAM_GUIDE_STEPS[0],
  );
  const [progress, setProgress] = useState(() => ({
    done: Math.max(0, stepIndexOf(initialSlug)),
    total: INSTAGRAM_GUIDE_STEPS.length,
  }));
  const [keys, setKeys] = useState<Record<KeyName, string>>({
    accountId: targetAccount?.externalAccountId ?? "",
    accessToken: "",
    appSecret: "",
  });
  const [verifyToken] = useState(generateVerifyToken);
  const isReviewingWebhook = targetAccount?.startAt === "webhook";
  const [connectedAccountId, setConnectedAccountId] = useState<string | null>(
    isReviewingWebhook ? targetAccount.id : null,
  );
  const [connectError, setConnectError] = useState<string | null>(null);
  const connect = useConnectSocialAccount();
  const reconnect = useReconnectSocialAccount();
  const { data: webhookSetup } = useSocialAccountWebhookSetup(connectedAccountId);
  const isConnected = connectedAccountId !== null;
  const isSaving = connect.isPending || reconnect.isPending;

  function persist(patch: Partial<StoredProgress>) {
    writeStoredProgress({ slug: currentStep.slug, cheeredIds: [...cheeredIds], ...patch });
  }

  type ConnectionResult = {
    account: { id: string; handle: string | null; externalAccountId: string };
    subscribed: boolean;
    subscriptionError: string | null;
    isNewAccount?: boolean;
  };

  function handleConnected(result: ConnectionResult) {
    setConnectedAccountId(result.account.id);
    onConnected?.(result.account.id);
    emitTourResult({ kind: GUIDE_RESULT_KINDS.instagramConnected });
    const accountLabel = result.account.handle ? `@${result.account.handle}` : result.account.externalAccountId;
    if (!result.subscribed) {
      toast.warning(`Conectado em ${accountLabel}, mas a inscrição nos eventos falhou`, {
        description: result.subscriptionError ?? undefined,
      });
    } else if (result.isNewAccount === false) {
      toast.success(`Credencial de ${accountLabel} atualizada`);
    } else {
      toast.success(`Conectado em ${accountLabel}`);
    }
  }

  function submitKeys() {
    setConnectError(null);
    const callbacks = {
      onSuccess: handleConnected,
      onError: (error: Error) => setConnectError(error.message),
    };
    if (targetAccount) {
      reconnect.mutate(
        { channelId: targetAccount.id, accessToken: keys.accessToken.trim(), appSecret: keys.appSecret.trim() },
        callbacks,
      );
      return;
    }
    connect.mutate(
      {
        provider: "INSTAGRAM",
        externalAccountId: keys.accountId.trim(),
        accessToken: keys.accessToken.trim(),
        appSecret: keys.appSecret.trim(),
        verifyToken,
      },
      callbacks,
    );
  }

  function renderStepExtra(step: MetaGuideStep) {
    const keyName = keyNameForStep(step.slug);
    if (keyName) {
      const field = KEY_FIELDS[keyName];
      const value = keys[keyName];
      const isFilled = value.trim().length > 0;
      const isValid = KEY_VALIDATORS[keyName](value);
      // Reconectar não troca a conta da linha: o ID fica travado (spec 0069, CB-8).
      const isLocked = keyName === "accountId" && Boolean(targetAccount);
      return (
        <div className="space-y-1.5 rounded-lg border border-success/40 bg-success/5 p-3">
          <Label className="text-xs font-medium">{isLocked ? field.label : `Cole aqui: ${field.label}`}</Label>
          <Input
            value={value}
            type={field.isSecret ? "password" : "text"}
            autoComplete="off"
            placeholder={field.placeholder}
            readOnly={isLocked}
            onChange={(event) => setKeys((current) => ({ ...current, [keyName]: event.target.value }))}
          />
          {isLocked && (
            <p className="text-xs text-muted-foreground">
              Você está trocando a credencial desta conta. Para outro Instagram, use &ldquo;Adicionar conta&rdquo;.
            </p>
          )}
          {isFilled && !isValid && (
            <p className="text-xs text-destructive">Esse valor não parece certo. Confira se copiou inteiro.</p>
          )}
          {!isLocked && keyName === "accountId" && looksLikeInstagramAppId(value) && (
            <p className="flex items-center gap-1.5 text-xs text-warning">
              <AlertTriangle className="size-3.5" /> Parece o ID do app. O da conta fica embaixo do @ e começa com 1784.
            </p>
          )}
        </div>
      );
    }

    if (step.slug === CONNECT_STEP_SLUG) {
      if (isConnected) {
        return (
          <p className="flex items-center gap-2 rounded-lg bg-success/10 p-3 text-sm text-success">
            <CheckCircle2 className="size-4" /> Conectado! Clique em próximo para configurar o webhook.
          </p>
        );
      }
      const missingKeys = (Object.keys(KEY_FIELDS) as KeyName[]).filter((name) => !KEY_VALIDATORS[name](keys[name]));
      return (
        <div className="space-y-3 rounded-lg border p-3">
          <ul className="space-y-1 text-sm">
            {(Object.keys(KEY_FIELDS) as KeyName[]).map((name) => (
              <li key={name} className="flex items-center gap-2">
                {KEY_VALIDATORS[name](keys[name]) ? (
                  <CheckCircle2 className="size-4 text-success" />
                ) : (
                  <AlertTriangle className="size-4 text-warning" />
                )}
                {KEY_FIELDS[name].label}
              </li>
            ))}
          </ul>
          {connectError && (
            <p className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">{connectError}</p>
          )}
          <Button onClick={submitKeys} disabled={isSaving || missingKeys.length > 0}>
            {isSaving ? <OrbitaSpinner className="size-4 " /> : <Plug className="size-4" />}
            {targetAccount ? "Atualizar credencial" : "Conectar"}
          </Button>
          {missingKeys.length > 0 && (
            <p className="text-xs text-muted-foreground">Volte aos passos marcados em amarelo e cole a chave.</p>
          )}
        </div>
      );
    }

    return null;
  }

  function canAdvance(step: MetaGuideStep): boolean {
    const keyName = keyNameForStep(step.slug);
    if (keyName) return KEY_VALIDATORS[keyName](keys[keyName]);
    if (step.slug === CONNECT_STEP_SLUG) return isConnected;
    return true;
  }

  const percent = Math.round((progress.done / Math.max(1, progress.total - 1)) * 100);

  return (
    <>
      <DialogHeader className="shrink-0 space-y-2">
        <DialogTitle className="flex items-center gap-2">
          <Instagram className="size-5 text-info" />
          {currentStep.title}
        </DialogTitle>
        <DialogDescription className="sr-only">Passo a passo para conectar uma conta do Instagram</DialogDescription>
        <div className="flex items-center gap-3">
          <Progress value={percent} className="h-1.5" />
          <span className="shrink-0 text-xs text-muted-foreground">
            Passo {progress.done + 1} de {progress.total}
          </span>
          <RequestTeamHelp step={currentStep.title} contextLabel="Satélites · Conectar Instagram" appId="comments" />
        </div>
      </DialogHeader>

      <MetaGuideStepper
        guide={INSTAGRAM_GUIDE}
        isTitleHidden
        initialSlug={initialSlug}
        cheeredIds={cheeredIds}
        copyValues={{
          privacyUrl: typeof window === "undefined" ? null : `${window.location.origin}/privacidade`,
          callbackUrl: webhookSetup?.webhookUrl,
          verifyToken: webhookSetup?.verifyToken,
        }}
        renderStepExtra={renderStepExtra}
        canAdvance={canAdvance}
        onStepChange={(step, index, total) => {
          setCurrentStep(step);
          setProgress({ done: index, total });
          // O progresso salvo é o de uma conta nova; rever uma conta não o sobrescreve.
          if (!targetAccount) persist({ slug: step.slug });
        }}
        onCheer={(cheerId) => {
          const nextCheered = new Set(cheeredIds).add(cheerId);
          setCheeredIds(nextCheered);
          if (!targetAccount) persist({ cheeredIds: [...nextCheered] });
        }}
        onFinished={() => {
          if (!targetAccount) writeStoredProgress({ slug: null, cheeredIds: [] });
          toast.success("Instagram conectado e recebendo comentários!");
          onClose();
        }}
      />
    </>
  );
}
