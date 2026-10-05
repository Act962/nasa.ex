"use client";

import { Instagram } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import type { SocialAccount } from "@/features/social-accounts/hooks/use-social-accounts";

const STATUS_SUFFIX: Record<SocialAccount["status"], string> = {
  ACTIVE: "",
  NEEDS_RECONNECT: " · reconectar",
  DISABLED: " · desativada",
};

export function accountLabelOf(account: SocialAccount): string {
  return account.handle ? `@${account.handle}` : account.externalAccountId;
}

/** Em qual conta do Instagram o usuário está trabalhando no Comments (spec 0069, RF-12). */
export function CommentsAccountSelect({
  accounts,
  selectedAccountId,
  onSelect,
}: {
  accounts: SocialAccount[];
  selectedAccountId: string | null;
  onSelect: (accountId: string) => void;
}) {
  if (accounts.length === 0) return null;

  return (
    <Select value={selectedAccountId ?? undefined} onValueChange={onSelect}>
      <SelectTrigger className="w-full sm:w-72" data-guide={GUIDE_ANCHORS.commentsAccountSelect.id}>
        <Instagram className="size-4 shrink-0" />
        <SelectValue placeholder="Escolha a conta" />
      </SelectTrigger>
      <SelectContent>
        {accounts.map((account) => (
          <SelectItem key={account.id} value={account.id}>
            {accountLabelOf(account)}
            <span className="text-muted-foreground">
              {` · ${account.automationCount} automação(ões)${STATUS_SUFFIX[account.status]}`}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
