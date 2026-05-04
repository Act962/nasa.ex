"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { toast } from "sonner";
import {
  AlertCircle,
  Building2,
  Facebook,
  Instagram,
  Lock,
  Sparkles,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AccountAccessPopover, type AccountAccessOption } from "./account-access-popover";

type Kind = "AD_ACCOUNT" | "PAGE" | "IG_ACCOUNT";

export function MetaAccountsTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery(
    orpc.integrations.listMembersWithMetaAccess.queryOptions(),
  );

  const setAccess = useMutation(
    orpc.integrations.setMemberMetaAccess.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({
          queryKey: orpc.integrations.listMembersWithMetaAccess.queryKey(),
        });
        toast.success("Acessos atualizados");
      },
      onError: (err: { message?: string }) => {
        toast.error(err?.message ?? "Erro ao salvar");
      },
    }),
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!data?.connected) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900/50 p-4 flex items-start gap-3">
        <AlertCircle className="size-5 text-amber-600 mt-0.5" />
        <div>
          <p className="text-sm font-medium">Meta não está conectado</p>
          <p className="text-xs text-muted-foreground">
            Conecte a Meta no marketplace de integrações para liberar a matriz de acesso por conta.
          </p>
        </div>
      </div>
    );
  }

  const adOptions: AccountAccessOption[] = data.catalog.adAccounts.map((a) => ({
    key: a.key,
    label: a.label,
    hint: a.hint,
  }));
  const pageOptions: AccountAccessOption[] = data.catalog.pages.map((p) => ({
    key: p.key,
    label: p.label,
    hint: p.hint,
  }));
  const igOptions: AccountAccessOption[] = data.catalog.igAccounts.map((i) => ({
    key: i.key,
    label: i.label,
    hint: i.hint,
  }));

  const totalAd = adOptions.length;
  const totalPage = pageOptions.length;
  const totalIg = igOptions.length;

  const handleSave = (userId: string, kind: Kind) => async (keys: string[]) => {
    await setAccess.mutateAsync({ userId, kind, accountKeys: keys });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-blue-50/40 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-900/40 p-3 flex items-start gap-3">
        <Sparkles className="size-4 text-blue-600 mt-0.5" />
        <div className="text-xs">
          <p className="font-medium">Whitelist por conta Meta</p>
          <p className="text-muted-foreground">
            Master/Admin têm acesso total automaticamente. Para os demais, marque
            quais contas de anúncios, páginas e Instagrams cada um pode visualizar.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr className="text-left text-xs">
              <th className="py-2 px-3 font-semibold">Membro</th>
              <th className="py-2 px-3 font-semibold">
                <span className="inline-flex items-center gap-1.5">
                  <Building2 className="size-3.5" /> Contas de anúncios
                </span>
              </th>
              <th className="py-2 px-3 font-semibold">
                <span className="inline-flex items-center gap-1.5">
                  <Facebook className="size-3.5" /> Páginas
                </span>
              </th>
              <th className="py-2 px-3 font-semibold">
                <span className="inline-flex items-center gap-1.5">
                  <Instagram className="size-3.5" /> Instagrams
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {data.members.map((m) => (
              <tr key={m.userId} className="border-t hover:bg-muted/20">
                <td className="py-2 px-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {m.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.image} alt={m.name} className="size-7 rounded-full" />
                    ) : (
                      <div className="size-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold">
                        {m.name.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{m.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {m.role}
                        {m.fullAccess && (
                          <span className="ml-2 inline-flex items-center gap-1 text-emerald-600">
                            <Lock className="size-2.5" />
                            acesso total
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </td>
                <CellAccess
                  member={m}
                  kind="AD_ACCOUNT"
                  options={adOptions}
                  total={totalAd}
                  selected={m.access.adAccountIds}
                  onSave={handleSave(m.userId, "AD_ACCOUNT")}
                />
                <CellAccess
                  member={m}
                  kind="PAGE"
                  options={pageOptions}
                  total={totalPage}
                  selected={m.access.pageIds}
                  onSave={handleSave(m.userId, "PAGE")}
                />
                <CellAccess
                  member={m}
                  kind="IG_ACCOUNT"
                  options={igOptions}
                  total={totalIg}
                  selected={m.access.igAccountIds}
                  onSave={handleSave(m.userId, "IG_ACCOUNT")}
                />
              </tr>
            ))}
            {data.members.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-xs text-muted-foreground">
                  Nenhum membro nesta organização ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CellAccess({
  member,
  kind,
  options,
  total,
  selected,
  onSave,
}: {
  member: { fullAccess: boolean };
  kind: Kind;
  options: AccountAccessOption[];
  total: number;
  selected: string[];
  onSave: (keys: string[]) => Promise<unknown> | void;
}) {
  if (member.fullAccess) {
    return (
      <td className="py-2 px-3">
        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
          <Lock className="size-3" /> todas ({total})
        </span>
      </td>
    );
  }
  return (
    <td className="py-2 px-3">
      <AccountAccessPopover
        triggerLabel={`${selected.length}/${total}`}
        triggerHint={kindHint(kind)}
        emptyLabel={emptyLabel(kind)}
        options={options}
        selectedKeys={selected}
        onSave={onSave}
      />
    </td>
  );
}

function kindHint(kind: Kind): string {
  if (kind === "AD_ACCOUNT") return "ad accounts";
  if (kind === "PAGE") return "páginas";
  return "Instagrams";
}

function emptyLabel(kind: Kind): string {
  if (kind === "AD_ACCOUNT") return "Sem contas";
  if (kind === "PAGE") return "Sem páginas";
  return "Sem IGs";
}
