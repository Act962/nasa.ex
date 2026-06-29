"use client";

import { useQuery } from "@tanstack/react-query";
import { InstagramIcon, FacebookIcon, AlertCircleIcon, Link2OffIcon } from "lucide-react";
import { orpc } from "@/lib/orpc";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  targetNetworks: string[];
  igAccountId: string | null | undefined;
  fbPageId: string | null | undefined;
  onChange: (patch: {
    targetNetworks?: string[];
    targetIgAccountId?: string | null;
    targetFbPageId?: string | null;
  }) => void;
  disabled?: boolean;
}

const NONE = "__none__";

export function PublishTargetPicker({
  targetNetworks,
  igAccountId,
  fbPageId,
  onChange,
  disabled,
}: Props) {
  const { data, isLoading } = useQuery(
    orpc.integrations.listAvailableMetaAccounts.queryOptions(),
  );

  const wantsInstagram = targetNetworks.includes("INSTAGRAM");
  const wantsFacebook = targetNetworks.includes("FACEBOOK");

  function toggleNetwork(network: "INSTAGRAM" | "FACEBOOK") {
    const next = targetNetworks.includes(network)
      ? targetNetworks.filter((n) => n !== network)
      : [...targetNetworks, network];
    const patch: Parameters<Props["onChange"]>[0] = { targetNetworks: next };
    if (network === "INSTAGRAM" && targetNetworks.includes("INSTAGRAM"))
      patch.targetIgAccountId = null;
    if (network === "FACEBOOK" && targetNetworks.includes("FACEBOOK"))
      patch.targetFbPageId = null;
    onChange(patch);
  }

  const networkToggles = (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold">Onde publicar</Label>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => toggleNetwork("INSTAGRAM")}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition ${
            wantsInstagram
              ? "border-pink-500 bg-pink-50 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300"
              : "border-border bg-background text-muted-foreground hover:bg-accent"
          } disabled:opacity-50`}
        >
          <InstagramIcon className="size-3.5" />
          Instagram
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => toggleNetwork("FACEBOOK")}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition ${
            wantsFacebook
              ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300"
              : "border-border bg-background text-muted-foreground hover:bg-accent"
          } disabled:opacity-50`}
        >
          <FacebookIcon className="size-3.5" />
          Facebook
        </button>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="space-y-2">
        {networkToggles}
        <Skeleton className="h-9 w-full" />
      </div>
    );
  }

  if (!data?.connected) {
    return (
      <div className="space-y-3">
        {networkToggles}
        <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-3 flex items-start gap-2">
          <AlertCircleIcon className="size-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div className="text-xs text-amber-800 dark:text-amber-300">
            Conecte uma conta Meta em <span className="font-semibold">Configurações → Integrações</span> para escolher onde publicar.
          </div>
        </div>
      </div>
    );
  }

  const igAccounts = data.igAccounts ?? [];
  const pages = data.pages ?? [];

  return (
    <div className="space-y-3">
      {networkToggles}
      {wantsInstagram && (
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold flex items-center gap-1.5">
            <InstagramIcon className="size-3.5 text-pink-500" />
            Instagram
          </Label>
          {igAccounts.length === 0 ? (
            <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 py-1.5">
              <Link2OffIcon className="size-3" />
              Nenhuma conta Instagram disponível para você nessa organização.
            </div>
          ) : (
            <Select
              value={igAccountId ?? NONE}
              onValueChange={(v) =>
                onChange({ targetIgAccountId: v === NONE ? null : v })
              }
              disabled={disabled}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Selecionar conta Instagram" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>
                  <span className="text-muted-foreground">Não publicar no IG</span>
                </SelectItem>
                {igAccounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    @{acc.username ?? acc.name ?? acc.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {wantsFacebook && (
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold flex items-center gap-1.5">
            <FacebookIcon className="size-3.5 text-blue-600" />
            Facebook
          </Label>
          {pages.length === 0 ? (
            <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 py-1.5">
              <Link2OffIcon className="size-3" />
              Nenhuma Página do Facebook disponível para você nessa organização.
            </div>
          ) : (
            <Select
              value={fbPageId ?? NONE}
              onValueChange={(v) =>
                onChange({ targetFbPageId: v === NONE ? null : v })
              }
              disabled={disabled}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Selecionar Página" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>
                  <span className="text-muted-foreground">Não publicar no Facebook</span>
                </SelectItem>
                {pages.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}
    </div>
  );
}
