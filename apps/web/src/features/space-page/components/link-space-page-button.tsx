"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/lib/orpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Copy,
  ExternalLink,
  Lock,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

/**
 * Botão "Spacehome" exibido no header (ao lado do breadcrumb).
 * Comportamentos:
 *
 *  - Sem org ativa ⇒ não renderiza.
 *  - Sem Station (hasStation=false) ⇒ botão "Criar Spacehome".
 *  - Com station ⇒ link + badge (Pública/Privada) + copy-to-clipboard.
 */
export function LinkSpacehomeButton() {
  const { data: session } = authClient.useSession();
  const orgId = session?.session.activeOrganizationId ?? null;

  const { data, isLoading } = useQuery({
    ...orpc.companySpace.getSpaceAdmin.queryOptions({
      input: { orgId: orgId ?? "" },
    }),
    enabled: !!orgId,
  });

  if (!orgId || isLoading || !data) return null;

  const { hasStation, nick, org } = data;

  if (!hasStation || !nick) {
    return (
      <Button
        asChild
        size="sm"
        className="h-8 gap-1 bg-orange-500 px-2.5 text-white hover:bg-orange-600"
      >
        <Link href="/onboarding/space-page">
          <Plus className="size-3" />
          <span className="text-xs font-medium">Criar Spacehome</span>
        </Link>
      </Button>
    );
  }

  const url = `/space/${nick}`;
  const isPublic = org?.isSpacehomePublic ?? false;

  const onCopy = async () => {
    try {
      const abs = typeof window !== "undefined"
        ? `${window.location.origin}${url}`
        : url;
      await navigator.clipboard.writeText(abs);
      toast.success("Link copiado!");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  return (
    <div className="flex items-center gap-1">
      <Button
        asChild
        size="sm"
        className="h-8 gap-1.5 bg-orange-500 px-2.5 text-white hover:bg-orange-600"
      >
        <Link href={url} target="_blank">
          <ExternalLink className="size-3" />
          <span className="text-xs font-medium">Spacehome</span>
          {isPublic ? (
            <Badge className="bg-green-500/25 px-1.5 py-0 text-[10px] text-green-50">
              <ShieldCheck className="mr-0.5 size-2.5" />
              Pública
            </Badge>
          ) : (
            <Badge className="bg-yellow-500/25 px-1.5 py-0 text-[10px] text-yellow-50">
              <Lock className="mr-0.5 size-2.5" />
              Privada
            </Badge>
          )}
        </Link>
      </Button>
      <Button
        type="button"
        size="icon"
        variant="outline"
        onClick={onCopy}
        className="size-8 border-border/50 bg-background/50 hover:bg-muted"
        aria-label="Copiar link"
      >
        <Copy className="size-3" />
      </Button>
    </div>
  );
}

// Alias retro-compatível enquanto callers antigos não foram migrados
export const LinkSpacePageButton = LinkSpacehomeButton;
