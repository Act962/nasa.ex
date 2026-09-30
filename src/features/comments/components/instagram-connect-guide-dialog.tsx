"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Instagram, Loader2, Plug } from "lucide-react";
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
  generateVerifyToken,
  isAccessTokenValid,
  isAppSecretValid,
  isInstagramAccountIdValid,
  looksLikeInstagramAppId,
} from "../lib/instagram-connect-guide";
import {
  useCommentsChannel,
  useCommentsWebhookSetup,
  useConnectCommentsChannel,
} from "../hooks/use-comments-channel";

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

/**
 * Popup "Conectar Instagram" do COMMENTS (spec 0047): as telas da Meta uma de
 * cada vez, com as chaves coladas no passo em que são copiadas.
 */
export function InstagramConnectGuideDialog({
  open,
  onOpenChange,
  initialAccountId = "",
  isStartingAtKeys = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialAccountId?: string;
  /** "Trocar conta ou credenciais": pula a criação do app (spec 0047, CA-5). */
  isStartingAtKeys?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[min(92vh,860px)] flex-col overflow-hidden sm:max-w-3xl lg:max-w-5xl"
        onInteractOutside={(event) => event.preventDefault()}
      >
        {open && (
          <GuideContent
            initialAccountId={initialAccountId}
            isStartingAtKeys={isStartingAtKeys}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function GuideContent({
  initialAccountId,
  isStartingAtKeys,
  onClose,
}: {
  initialAccountId: string;
  isStartingAtKeys: boolean;
  onClose: () => void;
}) {
  const [storedProgress] = useState(readStoredProgress);
  const initialSlug = isStartingAtKeys ? FIRST_KEY_STEP_SLUG : storedProgress.slug;
  const [cheeredIds, setCheeredIds] = useState(() => new Set(storedProgress.cheeredIds));
  const [currentStep, setCurrentStep] = useState<MetaGuideStep>(
    () => INSTAGRAM_GUIDE_STEPS.find((step) => step.slug === initialSlug) ?? INSTAGRAM_GUIDE_STEPS[0],
  );
  const [progress, setProgress] = useState(() => ({
    done: Math.max(0, INSTAGRAM_GUIDE_STEPS.findIndex((step) => step.slug === initialSlug)),
    total: INSTAGRAM_GUIDE_STEPS.length,
  }));
  const [keys, setKeys] = useState<Record<KeyName, string>>({
    accountId: initialAccountId,
    accessToken: "",
    appSecret: "",
  });
  const [verifyToken] = useState(generateVerifyToken);
  const [isConnectedNow, setIsConnectedNow] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const connect = useConnectCommentsChannel();
  const { data: channel } = useCommentsChannel();
  const { data: webhookSetup } = useCommentsWebhookSetup();
  // Retomou o guia depois de já ter conectado: não obriga a colar as chaves de novo.
  const isAlreadyConnected = !isStartingAtKeys && channel?.connected === true && channel.status === "ACTIVE";
  const isConnected = isConnectedNow || isAlreadyConnected;

  function persist(patch: Partial<StoredProgress>) {
    writeStoredProgress({ slug: currentStep.slug, cheeredIds: [...cheeredIds], ...patch });
  }

  function connectChannel() {
    setConnectError(null);
    connect.mutate(
      {
        provider: "INSTAGRAM",
        externalAccountId: keys.accountId.trim(),
        accessToken: keys.accessToken.trim(),
        appSecret: keys.appSecret.trim(),
        verifyToken,
      },
      {
        onSuccess: (result) => {
          setIsConnectedNow(true);
          const account = result.handle ? `@${result.handle}` : result.externalAccountId;
          if (!result.subscribed) {
            toast.warning(`Conectado em ${account}, mas a inscrição nos eventos falhou`, {
              description: result.subscriptionError ?? undefined,
            });
          } else if (result.replacedExternalAccountId && result.deactivatedAutomations > 0) {
            toast.success(`Conta trocada para ${account}`, {
              description: `${result.deactivatedAutomations} automação(ões) apontavam para posts da conta anterior e foram desativadas.`,
            });
          } else {
            toast.success(`Conectado em ${account}`);
          }
        },
        onError: (error) => setConnectError(error.message),
      },
    );
  }

  function renderStepExtra(step: MetaGuideStep) {
    const keyName = keyNameForStep(step.slug);
    if (keyName) {
      const field = KEY_FIELDS[keyName];
      const value = keys[keyName];
      const isFilled = value.trim().length > 0;
      const isValid = KEY_VALIDATORS[keyName](value);
      return (
        <div className="space-y-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3">
          <Label className="text-xs font-medium">Cole aqui: {field.label}</Label>
          <Input
            value={value}
            type={field.isSecret ? "password" : "text"}
            autoComplete="off"
            placeholder={field.placeholder}
            onChange={(event) => setKeys((current) => ({ ...current, [keyName]: event.target.value }))}
          />
          {isFilled && !isValid && (
            <p className="text-xs text-destructive">Esse valor não parece certo. Confira se copiou inteiro.</p>
          )}
          {keyName === "accountId" && looksLikeInstagramAppId(value) && (
            <p className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="size-3.5" /> Parece o ID do app. O da conta fica embaixo do @ e começa com 1784.
            </p>
          )}
        </div>
      );
    }

    if (step.slug === CONNECT_STEP_SLUG) {
      if (isConnected) {
        return (
          <p className="flex items-center gap-2 rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-300">
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
                  <CheckCircle2 className="size-4 text-emerald-500" />
                ) : (
                  <AlertTriangle className="size-4 text-amber-500" />
                )}
                {KEY_FIELDS[name].label}
              </li>
            ))}
          </ul>
          {connectError && (
            <p className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">{connectError}</p>
          )}
          <Button onClick={connectChannel} disabled={connect.isPending || missingKeys.length > 0}>
            {connect.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plug className="size-4" />}
            Conectar
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
          <Instagram className="size-5 text-pink-500" />
          {currentStep.title}
        </DialogTitle>
        <DialogDescription className="sr-only">Passo a passo para conectar o Instagram no COMMENTS</DialogDescription>
        <div className="flex items-center gap-3">
          <Progress value={percent} className="h-1.5" />
          <span className="shrink-0 text-xs text-muted-foreground">
            Passo {progress.done + 1} de {progress.total}
          </span>
          <RequestTeamHelp step={currentStep.title} contextLabel="Comments · Conectar Instagram" appId="comments" />
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
          persist({ slug: step.slug });
        }}
        onCheer={(cheerId) => {
          const nextCheered = new Set(cheeredIds).add(cheerId);
          setCheeredIds(nextCheered);
          persist({ cheeredIds: [...nextCheered] });
        }}
        onFinished={() => {
          writeStoredProgress({ slug: null, cheeredIds: [] });
          toast.success("Instagram conectado e recebendo comentários!");
          onClose();
        }}
      />
    </>
  );
}
