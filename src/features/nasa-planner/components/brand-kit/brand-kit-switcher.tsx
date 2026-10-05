"use client";

import { useState } from "react";
import { useIsMutating } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Instagram, Pencil, Plus, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import {
  useCreatePlannerBrandKit,
  useDeletePlannerBrandKit,
  usePlannerBrandKits,
  useRenamePlannerBrandKit,
  useSetPlannerAccountBrandKit,
} from "../../hooks/use-planner-brand-kit";

/** Kits da empresa (lista lateral) e o cabeçalho do kit em tela, com as contas do Instagram que o usam (spec 0070). */

type BrandKitsData = ReturnType<typeof usePlannerBrandKits>;
export type BrandKitSummary = BrandKitsData["kits"][number];
type BrandKitAccount = BrandKitsData["accounts"][number];

const DEFAULT_KIT_KEY = "__default__";
const FIELD_CLASS = "h-9 w-full rounded-xl border border-line bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

const accountLabelOf = (account: BrandKitAccount) => (account.handle ? `@${account.handle}` : account.externalAccountId);

function describeAccountCount(accountCount: number) {
  if (accountCount === 0) return "nenhuma conta";
  return accountCount === 1 ? "1 conta" : `${accountCount} contas`;
}

function NewKitForm({ organizationId, onCreated, onCancel }: { organizationId: string; onCreated: (brandKitId: string) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [shouldCopyDefault, setShouldCopyDefault] = useState(true);
  const createKit = useCreatePlannerBrandKit();
  const submit = () =>
    createKit.mutate(
      { organizationId, name, shouldCopyDefault },
      {
        onSuccess: (created) => {
          toast.success(`Kit "${created.name}" criado.`);
          onCreated(created.brandKitId);
        },
        onError: (error) => toast.error(error.message),
      },
    );

  return (
    <form
      className="space-y-2.5 rounded-2xl bg-card p-3"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <p className="text-xs font-semibold">Novo kit</p>
      <input
        autoFocus
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Nome (ex.: Cliente B)"
        maxLength={80}
        className={cn(FIELD_CLASS, "bg-panel")}
      />
      <label className="flex items-start gap-2 text-xs text-muted-foreground">
        <input type="checkbox" className="mt-0.5" checked={shouldCopyDefault} onChange={(event) => setShouldCopyDefault(event.target.checked)} />
        <span>
          Começar com os textos, cores e fontes do kit padrão.
          {shouldCopyDefault && " Logos e materiais não são copiados."}
        </span>
      </label>
      <div className="flex gap-2">
        <button type="submit" disabled={!name.trim() || createKit.isPending} className="flex-1 rounded-full bg-foreground px-3 py-1.5 text-xs font-semibold text-background disabled:opacity-50">
          {createKit.isPending ? "Criando…" : "Criar kit"}
        </button>
        <button type="button" onClick={onCancel} className="rounded-full px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
          Cancelar
        </button>
      </div>
    </form>
  );
}

export function BrandKitList({
  organizationId,
  organizationName,
  selectedKitId,
  canEdit,
  onSelectKit,
}: {
  organizationId: string;
  organizationName: string | null;
  selectedKitId: string | null;
  canEdit: boolean;
  onSelectKit: (brandKitId: string | null) => void;
}) {
  const { kits, limit } = usePlannerBrandKits(organizationId);
  const [isCreating, setIsCreating] = useState(false);
  const additionalKitCount = kits.filter((kit) => !kit.isDefault).length;
  if (kits.length === 0) return null;

  return (
    <aside data-guide={GUIDE_ANCHORS.plannerBrandKitSwitcher.id} className="min-w-0 rounded-[20px] bg-panel p-3 lg:sticky lg:top-20">
      <h2 className="mx-1 mb-2.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
        Kits{organizationName ? ` de ${organizationName}` : ""}
      </h2>
      <ul className="flex gap-1.5 overflow-x-auto lg:flex-col lg:overflow-visible">
        {kits.map((kit) => {
          const isSelected = kit.brandKitId === selectedKitId;
          const percent = Math.round((kit.completeness.completedCount / kit.completeness.totalCount) * 100);
          return (
            <li key={kit.brandKitId ?? DEFAULT_KIT_KEY} className="min-w-52 flex-none lg:min-w-0">
              <button
                type="button"
                aria-current={isSelected}
                onClick={() => onSelectKit(kit.brandKitId)}
                className={cn("block w-full rounded-2xl border px-3 py-2.5 text-left transition", isSelected ? "border-foreground/25 bg-card" : "border-transparent hover:bg-card")}
              >
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  <span className="truncate">{kit.name}</span>
                  {kit.isDefault && <span className="rounded-full bg-knob px-1.5 py-px text-[10px] font-semibold text-muted-foreground">padrão</span>}
                </span>
                <span className="my-2 block h-1 overflow-hidden rounded-full bg-knob">
                  <span className={cn("block h-full rounded-full", kit.completeness.isComplete ? "bg-success" : "bg-warning")} style={{ width: `${percent}%` }} />
                </span>
                <span className="block text-[11.5px] text-muted-foreground">
                  {kit.completeness.isComplete ? "Completo" : `${kit.completeness.completedCount} de ${kit.completeness.totalCount} itens`} · {describeAccountCount(kit.accountCount)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {canEdit && (
        <div className="mt-1.5">
          {isCreating ? (
            <NewKitForm
              organizationId={organizationId}
              onCancel={() => setIsCreating(false)}
              onCreated={(brandKitId) => {
                setIsCreating(false);
                onSelectKit(brandKitId);
              }}
            />
          ) : additionalKitCount < limit ? (
            <button
              type="button"
              onClick={() => setIsCreating(true)}
              className="flex w-full items-center gap-1.5 rounded-2xl border border-dashed border-line px-3 py-2.5 text-sm text-muted-foreground hover:border-foreground/30 hover:text-foreground"
            >
              <Plus className="size-4" /> Novo kit
            </button>
          ) : (
            <p className="mx-1 text-[11.5px] text-muted-foreground">Limite de {limit} kits adicionais atingido.</p>
          )}
        </div>
      )}
      <p className="mx-1 mt-3 hidden text-[11.5px] text-muted-foreground lg:block">
        Cada kit é uma marca. Crie um para cada cliente ou linha de produto com identidade própria.
      </p>
    </aside>
  );
}

function KitTitle({ organizationId, kit, canEdit, onDeleted }: { organizationId: string; kit: BrandKitSummary; canEdit: boolean; onDeleted: () => void }) {
  const [draftName, setDraftName] = useState<string | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const renameKit = useRenamePlannerBrandKit();
  const deleteKit = useDeletePlannerBrandKit();
  const brandKitId = kit.brandKitId;
  const canManageKit = canEdit && brandKitId !== null;

  const saveName = () => {
    if (!brandKitId || !draftName?.trim() || draftName.trim() === kit.name) return setDraftName(null);
    renameKit.mutate(
      { organizationId, brandKitId, name: draftName },
      { onSuccess: () => setDraftName(null), onError: (error) => toast.error(error.message) },
    );
  };

  if (draftName !== null) {
    return (
      <form
        className="flex min-w-0 flex-1 items-center gap-1.5"
        onSubmit={(event) => {
          event.preventDefault();
          saveName();
        }}
      >
        <input autoFocus value={draftName} onChange={(event) => setDraftName(event.target.value)} maxLength={80} aria-label="Nome do kit" className={cn(FIELD_CLASS, "max-w-xs")} />
        <button type="submit" disabled={renameKit.isPending} aria-label="Salvar nome" className="grid size-8 flex-none place-items-center rounded-full bg-foreground text-background">
          <Check className="size-4" />
        </button>
        <button type="button" onClick={() => setDraftName(null)} aria-label="Cancelar" className="grid size-8 flex-none place-items-center rounded-full bg-card">
          <X className="size-4" />
        </button>
      </form>
    );
  }

  return (
    <>
      <h2 className="min-w-0 truncate text-xl font-semibold tracking-tight">{kit.name}</h2>
      <span className="rounded-full bg-knob px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{kit.isDefault ? "padrão" : "kit adicional"}</span>
      {canManageKit && (
        <>
          <button type="button" onClick={() => setDraftName(kit.name)} aria-label="Renomear kit" title="Renomear" className="grid size-8 place-items-center rounded-full bg-card text-muted-foreground hover:text-foreground">
            <Pencil className="size-3.5" />
          </button>
          <button type="button" onClick={() => setIsConfirmingDelete(true)} aria-label="Apagar kit" title="Apagar kit" className="grid size-8 place-items-center rounded-full bg-card text-destructive">
            <Trash2 className="size-3.5" />
          </button>
          <ConfirmDialog
            isOpen={isConfirmingDelete}
            isDangerous
            isLoading={deleteKit.isPending}
            title={`Apagar o kit "${kit.name}"?`}
            description={`Os logos, textos e materiais deste kit são apagados e não dá para desfazer. ${
              kit.accountCount > 0 ? `${kit.accountCount} conta(s) do Instagram que usam este kit voltam para o kit padrão.` : "Nenhuma conta usa este kit."
            }`}
            confirmText="Apagar kit"
            onCancel={() => setIsConfirmingDelete(false)}
            onConfirm={() => {
              if (!brandKitId) return;
              deleteKit.mutate(
                { organizationId, brandKitId },
                {
                  onSuccess: () => {
                    setIsConfirmingDelete(false);
                    toast.success("Kit apagado.");
                    onDeleted();
                  },
                  onError: (error) => toast.error(error.message),
                },
              );
            }}
          />
        </>
      )}
    </>
  );
}

function KitAccounts({
  organizationId,
  kit,
  kits,
  accounts,
  canLinkAccounts,
}: {
  organizationId: string;
  kit: BrandKitSummary;
  kits: BrandKitSummary[];
  accounts: BrandKitAccount[];
  canLinkAccounts: boolean;
}) {
  const setAccountKit = useSetPlannerAccountBrandKit();
  const accountsOnKit = accounts.filter((account) => account.brandKitId === kit.brandKitId);
  const accountsOnOtherKits = accounts.filter((account) => account.brandKitId !== kit.brandKitId);
  const kitNameOf = (brandKitId: string | null) => kits.find((candidate) => candidate.brandKitId === brandKitId)?.name ?? kits[0]?.name;
  const canUnlink = canLinkAccounts && !kit.isDefault;

  const moveAccount = (account: BrandKitAccount, brandKitId: string | null, successMessage: string) =>
    setAccountKit.mutate(
      { organizationId, channelId: account.id, brandKitId },
      { onSuccess: () => toast.success(successMessage), onError: (error) => toast.error(error.message) },
    );

  return (
    <div className="mt-4 border-t border-line pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {accountsOnKit.length > 0 ? "Contas do Instagram que usam este kit:" : "Nenhuma conta do Instagram usa este kit."}
        </span>
        {accountsOnKit.map((account) => (
          <span key={account.id} className={cn("inline-flex items-center gap-1.5 rounded-full bg-card py-1 pr-1.5 pl-2.5 text-sm font-medium", account.status === "DISABLED" && "opacity-60")}>
            <Instagram className="size-3.5 text-brand-instagram" />
            {accountLabelOf(account)}
            {account.status === "DISABLED" && <span className="text-xs font-normal text-muted-foreground">· desativada</span>}
            {canUnlink ? (
              <button
                type="button"
                disabled={setAccountKit.isPending}
                aria-label={`Tirar ${accountLabelOf(account)} deste kit`}
                title="Voltar para o kit padrão"
                onClick={() => moveAccount(account, null, `${accountLabelOf(account)} voltou para o kit padrão.`)}
                className="grid size-5 place-items-center rounded-full bg-knob text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            ) : (
              <span className="w-1" />
            )}
          </span>
        ))}
        {canLinkAccounts && accountsOnOtherKits.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" disabled={setAccountKit.isPending} className="inline-flex items-center gap-1 rounded-full border border-dashed border-line px-3 py-1 text-sm text-muted-foreground hover:border-foreground/30 hover:text-foreground">
                <Plus className="size-3.5" /> Vincular conta
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-60">
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Passar para o kit &ldquo;{kit.name}&rdquo;</DropdownMenuLabel>
              {accountsOnOtherKits.map((account) => (
                <DropdownMenuItem key={account.id} onSelect={() => moveAccount(account, kit.brandKitId, `${accountLabelOf(account)} agora usa o kit "${kit.name}".`)}>
                  <Instagram className="size-3.5" />
                  <span className="flex-1">{accountLabelOf(account)}</span>
                  <span className="text-xs text-muted-foreground">hoje: {kitNameOf(account.brandKitId)}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {kit.isDefault
          ? "Toda conta sem kit próprio usa este. É a mesma marca de Configurações → Marca e não pode ser apagado."
          : accountsOnKit.length === 0
            ? "Enquanto nenhuma conta usar este kit, os posts continuam saindo com o kit padrão."
            : "Os posts dessas contas são criados e conferidos com este kit."}
        {!canLinkAccounts && " Só owner ou admin trocam o kit de uma conta."}
      </p>
    </div>
  );
}

function SaveStatus() {
  const pendingMutationCount = useIsMutating();
  return (
    <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
      <span className={cn("size-1.5 rounded-full", pendingMutationCount > 0 ? "animate-pulse bg-warning" : "bg-success")} />
      {pendingMutationCount > 0 ? "Salvando…" : "As mudanças salvam sozinhas"}
    </span>
  );
}

export function BrandKitHeader({
  organizationId,
  selectedKitId,
  canEdit,
  onDeleted,
  children,
}: {
  organizationId: string;
  selectedKitId: string | null;
  canEdit: boolean;
  onDeleted: () => void;
  children?: React.ReactNode;
}) {
  const { kits, accounts, canLinkAccounts } = usePlannerBrandKits(organizationId);
  const kit = kits.find((candidate) => candidate.brandKitId === selectedKitId);
  if (!kit) return null;

  return (
    <section className="rounded-[20px] bg-panel p-4 md:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <KitTitle key={kit.brandKitId ?? DEFAULT_KIT_KEY} organizationId={organizationId} kit={kit} canEdit={canEdit} onDeleted={onDeleted} />
        {canEdit && <SaveStatus />}
      </div>
      {accounts.length > 0 && <KitAccounts organizationId={organizationId} kit={kit} kits={kits} accounts={accounts} canLinkAccounts={canLinkAccounts} />}
      {children}
    </section>
  );
}
