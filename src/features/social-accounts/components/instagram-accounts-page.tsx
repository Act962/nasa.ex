"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  CalendarDaysIcon,
  ChevronRightIcon,
  InboxIcon,
  InstagramIcon,
  ListChecksIcon,
  MessageCircleIcon,
  PlusIcon,
  ZapIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { Button } from "@/components/ui/button";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { useMetaInstagramAccounts, useSocialAccounts } from "../hooks/use-social-accounts";
import { InstagramConnectGuideDialog } from "./instagram-connect-guide-dialog";
import { MetaConnectOption } from "./meta-connect-option";
import { SocialAccountCard } from "./social-account-card";
import { LegacyDirectMessageNotice, type AccountGuideState } from "./social-accounts-manager";

function StatTile({ value, label, children, valueClassName }: { value: ReactNode; label: string; children?: ReactNode; valueClassName?: string }) {
  return (
    <div className="rounded-[20px] bg-card px-4 py-3.5">
      <p className={cn("text-[22px] leading-tight font-semibold tabular-nums", valueClassName)}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function ConnectOption({
  icon,
  title,
  description,
  ...buttonProps
}: {
  icon: ReactNode;
  title: string;
  description: string;
} & React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-3 rounded-[16px] bg-panel p-3 text-left transition-colors hover:bg-knob disabled:pointer-events-none disabled:opacity-50"
      {...buttonProps}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-[12px] bg-knob [&>svg]:size-[18px]">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </span>
      <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

const ACCOUNT_USES = [
  { icon: MessageCircleIcon, title: "Comments", description: "Responde comentários e directs sozinha." },
  { icon: InboxIcon, title: "Chat", description: "Comentários e directs viram conversa com o lead." },
  { icon: CalendarDaysIcon, title: "Planner", description: "Publicar pela conta conectada chega na próxima etapa." },
] as const;

/** Página Satélites › Instagram (spec 0069, RF-1): as contas conectadas da organização e como conectar outra. */
export function InstagramAccountsPage() {
  const { data, isLoading } = useSocialAccounts();
  const { data: metaAccounts } = useMetaInstagramAccounts();
  const [guide, setGuide] = useState<AccountGuideState>({ isOpen: false });

  const accounts = (data?.accounts ?? []).filter((account) => account.provider === "INSTAGRAM");
  const canManage = data?.canManage ?? false;
  const limitPerProvider = data?.limitPerProvider ?? 0;
  const hasReachedLimit = Boolean(data) && accounts.length >= limitPerProvider;
  const activeCount = accounts.filter((account) => account.status === "ACTIVE").length;
  const automationCount = accounts.reduce((total, account) => total + account.automationCount, 0);
  const connectedExternalAccountIds = accounts.map((account) => account.externalAccountId);
  const hasMetaAccountToConnect = (metaAccounts?.accounts ?? []).some(
    (metaAccount) => !connectedExternalAccountIds.includes(metaAccount.igUserId),
  );
  const openAddGuide = () => setGuide({ isOpen: true });

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <Button asChild size="icon" variant="secondary" className="size-8 rounded-full" aria-label="Voltar para Satélites">
          <Link href="/integrations">
            <ArrowLeftIcon />
          </Link>
        </Button>
        <Link href="/integrations" className="hover:text-foreground">
          Satélites
        </Link>
        <ChevronRightIcon className="size-3.5" />
        <span className="font-medium text-foreground">Instagram</span>
      </nav>

      <header className="relative flex flex-wrap items-center gap-5 overflow-hidden rounded-[28px] bg-card px-5 py-6 sm:px-7">
        <div className="pointer-events-none absolute -top-24 -right-16 size-80 rounded-full bg-brand-instagram/25 blur-[80px]" />
        <span className="relative grid size-16 shrink-0 place-items-center rounded-[20px] bg-brand-instagram text-white">
          <InstagramIcon className="size-8" />
        </span>
        <div className="relative min-w-60 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">Instagram</h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Conecte uma ou mais contas. As mesmas contas ficam disponíveis no Comments e no Planner.
          </p>
        </div>
        {canManage && (
          <Button
            className="relative rounded-full"
            disabled={hasReachedLimit}
            data-guide={GUIDE_ANCHORS.commentsConnectInstagram.id}
            onClick={openAddGuide}
          >
            <PlusIcon />
            Adicionar conta
          </Button>
        )}
      </header>

      <section className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatTile value={accounts.length} label="contas conectadas" />
        <StatTile value={activeCount} label="ativas e respondendo" valueClassName="text-success" />
        <StatTile value={automationCount} label="automações no Comments" />
        <StatTile
          value={
            <>
              {accounts.length} <span className="text-sm font-normal text-muted-foreground">de {limitPerProvider}</span>
            </>
          }
          label="limite de contas"
        >
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-knob">
            <div
              className="h-full rounded-full bg-brand-instagram"
              style={{ width: `${limitPerProvider ? Math.min(100, (accounts.length / limitPerProvider) * 100) : 0}%` }}
            />
          </div>
        </StatTile>
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="space-y-2.5">
          <h2 className="px-1 text-sm font-semibold">
            Contas <span className="font-normal text-muted-foreground">· {accounts.length}</span>
          </h2>

          {isLoading && (
            <p className="flex items-center gap-2 rounded-[24px] bg-card p-6 text-sm text-muted-foreground">
              <OrbitaSpinner className="size-4" />
              Carregando contas...
            </p>
          )}

          {!isLoading && accounts.length === 0 && (
            <div className="flex flex-col items-center gap-3 rounded-[24px] bg-card px-6 py-12 text-center">
              <span className="grid size-12 place-items-center rounded-full bg-knob">
                <InstagramIcon className="size-6" />
              </span>
              <div>
                <p className="font-medium">Nenhuma conta conectada</p>
                <p className="text-sm text-muted-foreground">
                  Conecte a primeira para responder comentários e directs sem sair da ÓRBITA.
                </p>
              </div>
              {canManage && (
                <Button className="rounded-full" onClick={openAddGuide}>
                  <PlusIcon />
                  Conectar Instagram
                </Button>
              )}
            </div>
          )}

          {accounts.map((account) => (
            <SocialAccountCard
              key={account.id}
              account={account}
              canManage={canManage}
              showOpenInComments
              onOpenGuide={(startAt) =>
                setGuide({
                  isOpen: true,
                  targetAccount: { id: account.id, externalAccountId: account.externalAccountId, startAt },
                })
              }
            />
          ))}

          {data?.hasLegacyDirectMessageIntegration && <LegacyDirectMessageNotice />}
        </section>

        <aside className="space-y-2.5 lg:sticky lg:top-4">
          <div className="rounded-[24px] bg-card p-4">
            <h2 className="text-sm font-semibold">Conectar outra conta</h2>
            {canManage ? (
              <>
                <p className="mb-2 text-[13px] text-muted-foreground">Escolha como quer conectar.</p>
                <div className="space-y-2">
                  <ConnectOption
                    icon={<ListChecksIcon />}
                    title="Passo a passo"
                    description="Com app próprio na Meta · uns 15 minutos"
                    disabled={hasReachedLimit}
                    onClick={openAddGuide}
                  />
                  {hasMetaAccountToConnect ? (
                    <div className="rounded-[16px] bg-panel p-3">
                      <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                        <ZapIcon className="size-4" />
                        Pela Meta, em um clique
                      </p>
                      <MetaConnectOption connectedExternalAccountIds={connectedExternalAccountIds} />
                    </div>
                  ) : (
                    <Link
                      href="/integrations?connect=META"
                      className="flex w-full items-center gap-3 rounded-[16px] bg-panel p-3 transition-colors hover:bg-knob"
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-[12px] bg-knob">
                        <ZapIcon className="size-[18px]" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">Pela Meta</span>
                        <span className="block text-xs text-muted-foreground">
                          Um clique depois de conectar a Meta da empresa
                        </span>
                      </span>
                      <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
                    </Link>
                  )}
                </div>
                {hasReachedLimit && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Limite de {limitPerProvider} contas atingido. Desative uma conta que não usa mais.
                  </p>
                )}
              </>
            ) : (
              <p className="mt-1 text-[13px] text-muted-foreground">Só owner ou admin podem conectar e gerenciar contas.</p>
            )}
          </div>

          <div className="rounded-[24px] bg-card p-4">
            <h2 className="text-sm font-semibold">O que cada conta faz</h2>
            <ul className="mt-2 space-y-2.5">
              {ACCOUNT_USES.map(({ icon: UseIcon, title, description }) => (
                <li key={title} className="flex gap-2.5 text-[13px]">
                  <span className="grid size-6 shrink-0 place-items-center rounded-[8px] bg-knob">
                    <UseIcon className="size-3.5" />
                  </span>
                  <span>
                    <span className="block font-semibold">{title}</span>
                    <span className="text-muted-foreground">{description}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      <InstagramConnectGuideDialog
        open={guide.isOpen}
        onOpenChange={(isOpen) => !isOpen && setGuide({ isOpen: false })}
        targetAccount={guide.isOpen ? guide.targetAccount : undefined}
      />
    </div>
  );
}
