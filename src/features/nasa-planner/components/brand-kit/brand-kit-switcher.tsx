"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Instagram, Pencil, Plus, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import {
  useCreatePlannerBrandKit,
  useDeletePlannerBrandKit,
  usePlannerBrandKits,
  useRenamePlannerBrandKit,
  useSetPlannerAccountBrandKit,
} from "../../hooks/use-planner-brand-kit";

/** Kits da empresa e qual conta do Instagram usa cada um (spec 0070). */

type BrandKitsData = ReturnType<typeof usePlannerBrandKits>;
export type BrandKitSummary = BrandKitsData["kits"][number];
type BrandKitAccount = BrandKitsData["accounts"][number];

const DEFAULT_KIT_VALUE = "__default__";
const PILL_CLASS = "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm";
const FIELD_CLASS = "h-9 rounded-full bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

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
      className="flex flex-wrap items-center gap-2 rounded-2xl bg-panel p-3"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <input
        autoFocus
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Nome do kit (ex.: Cliente B)"
        maxLength={80}
        className={cn(FIELD_CLASS, "min-w-48 flex-1")}
      />
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <input type="checkbox" checked={shouldCopyDefault} onChange={(event) => setShouldCopyDefault(event.target.checked)} />
        Começar com os textos, cores e fontes do kit padrão
      </label>
      <button type="submit" disabled={!name.trim() || createKit.isPending} className={cn(PILL_CLASS, "bg-foreground font-semibold text-background disabled:opacity-50")}>
        Criar kit
      </button>
      <button type="button" onClick={onCancel} className={cn(PILL_CLASS, "text-muted-foreground")}>
        Cancelar
      </button>
      {shouldCopyDefault && <p className="w-full text-[11px] text-muted-foreground">Logos e materiais não são copiados: envie os deste kit depois de criar.</p>}
    </form>
  );
}

function KitActions({ organizationId, kit, onDeleted }: { organizationId: string; kit: BrandKitSummary; onDeleted: () => void }) {
  const [draftName, setDraftName] = useState<string | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const renameKit = useRenamePlannerBrandKit();
  const deleteKit = useDeletePlannerBrandKit();
  if (!kit.brandKitId) return null;
  const brandKitId = kit.brandKitId;

  const saveName = () => {
    if (!draftName?.trim() || draftName.trim() === kit.name) return setDraftName(null);
    renameKit.mutate(
      { organizationId, brandKitId, name: draftName },
      { onSuccess: () => setDraftName(null), onError: (error) => toast.error(error.message) },
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {draftName === null ? (
        <button type="button" onClick={() => setDraftName(kit.name)} className={cn(PILL_CLASS, "bg-panel text-xs")}>
          <Pencil className="size-3.5" /> Renomear
        </button>
      ) : (
        <form
          className="flex items-center gap-1.5"
          onSubmit={(event) => {
            event.preventDefault();
            saveName();
          }}
        >
          <input autoFocus value={draftName} onChange={(event) => setDraftName(event.target.value)} maxLength={80} className={FIELD_CLASS} />
          <button type="submit" disabled={renameKit.isPending} aria-label="Salvar nome" className="grid size-8 place-items-center rounded-full bg-foreground text-background">
            <Check className="size-4" />
          </button>
          <button type="button" onClick={() => setDraftName(null)} aria-label="Cancelar" className="grid size-8 place-items-center rounded-full bg-panel">
            <X className="size-4" />
          </button>
        </form>
      )}
      <button type="button" onClick={() => setIsConfirmingDelete(true)} className={cn(PILL_CLASS, "bg-panel text-xs text-destructive")}>
        <Trash2 className="size-3.5" /> Apagar kit
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
        onConfirm={() =>
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
          )
        }
      />
    </div>
  );
}

function AccountKitRow({
  organizationId,
  account,
  kits,
  selectedKitId,
  canLinkAccounts,
}: {
  organizationId: string;
  account: BrandKitAccount;
  kits: BrandKitSummary[];
  selectedKitId: string | null;
  canLinkAccounts: boolean;
}) {
  const setAccountKit = useSetPlannerAccountBrandKit();
  const accountKit = kits.find((kit) => kit.brandKitId === account.brandKitId) ?? kits[0];
  const accountLabel = account.handle ? `@${account.handle}` : account.externalAccountId;
  const usesSelectedKit = account.brandKitId === selectedKitId;

  return (
    <li className={cn("flex flex-wrap items-center gap-2 rounded-xl bg-card px-3 py-2", usesSelectedKit && "ring-1 ring-primary/40")}>
      <Instagram className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate text-sm font-medium">
        {accountLabel}
        {account.status === "DISABLED" && <span className="font-normal text-muted-foreground"> · desativada</span>}
      </span>
      {canLinkAccounts ? (
        <Select
          value={account.brandKitId ?? DEFAULT_KIT_VALUE}
          disabled={setAccountKit.isPending}
          onValueChange={(value) =>
            setAccountKit.mutate(
              { organizationId, channelId: account.id, brandKitId: value === DEFAULT_KIT_VALUE ? null : value },
              { onSuccess: () => toast.success(`${accountLabel} atualizada.`), onError: (error) => toast.error(error.message) },
            )
          }
        >
          <SelectTrigger className="h-8 w-52 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {kits.map((kit) => (
              <SelectItem key={kit.brandKitId ?? DEFAULT_KIT_VALUE} value={kit.brandKitId ?? DEFAULT_KIT_VALUE}>
                {kit.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <span className="text-xs text-muted-foreground">Kit: {accountKit?.name}</span>
      )}
    </li>
  );
}

export function BrandKitSwitcher({
  organizationId,
  selectedKitId,
  canEdit,
  onSelectKit,
}: {
  organizationId: string;
  selectedKitId: string | null;
  canEdit: boolean;
  onSelectKit: (brandKitId: string | null) => void;
}) {
  const { kits, accounts, limit, canLinkAccounts } = usePlannerBrandKits(organizationId);
  const [isCreating, setIsCreating] = useState(false);
  const selectedKit = kits.find((kit) => kit.brandKitId === selectedKitId) ?? null;
  const additionalKitCount = kits.filter((kit) => !kit.isDefault).length;
  if (kits.length === 0) return null;

  return (
    <div className="space-y-3">
      <div data-guide={GUIDE_ANCHORS.plannerBrandKitSwitcher.id} className="flex flex-wrap items-center gap-2">
        {kits.map((kit) => (
          <button
            key={kit.brandKitId ?? DEFAULT_KIT_VALUE}
            type="button"
            onClick={() => onSelectKit(kit.brandKitId)}
            className={cn(PILL_CLASS, kit.brandKitId === selectedKitId ? "bg-foreground font-semibold text-background" : "bg-panel")}
          >
            {kit.name}
            <span className={cn("text-xs font-normal", kit.brandKitId === selectedKitId ? "text-background/70" : "text-muted-foreground")}>
              {kit.completeness.completedCount}/{kit.completeness.totalCount} · {kit.accountCount} conta(s)
            </span>
          </button>
        ))}
        {canEdit && !isCreating && additionalKitCount < limit && (
          <button type="button" onClick={() => setIsCreating(true)} className={cn(PILL_CLASS, "border border-dashed border-line text-muted-foreground hover:text-foreground")}>
            <Plus className="size-4" /> Novo kit
          </button>
        )}
        <span className="flex-1" />
        {canEdit && selectedKit && <KitActions organizationId={organizationId} kit={selectedKit} onDeleted={() => onSelectKit(null)} />}
      </div>

      {isCreating && (
        <NewKitForm
          organizationId={organizationId}
          onCancel={() => setIsCreating(false)}
          onCreated={(brandKitId) => {
            setIsCreating(false);
            onSelectKit(brandKitId);
          }}
        />
      )}

      {accounts.length > 0 && (
        <section className="rounded-[20px] bg-panel p-4">
          <h3 className="text-sm font-semibold">Contas do Instagram e o kit que usam</h3>
          <p className="mb-3 text-xs text-muted-foreground">
            O post usa o kit da conta em que vai sair. {canLinkAccounts ? "Troque o kit de uma conta aqui." : "Só owner ou admin trocam o kit de uma conta."}
          </p>
          <ul className="grid gap-2 md:grid-cols-2">
            {accounts.map((account) => (
              <AccountKitRow
                key={account.id}
                organizationId={organizationId}
                account={account}
                kits={kits}
                selectedKitId={selectedKitId}
                canLinkAccounts={canLinkAccounts}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
