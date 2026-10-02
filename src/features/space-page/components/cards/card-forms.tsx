"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/lib/orpc";
import { SpaceCard } from "../space-card";
import { Button } from "@/components/ui/button";
import { FileText, ExternalLink, Plus } from "lucide-react";

interface CardFormsProps {
  nick: string;
}

export function CardForms({ nick }: CardFormsProps) {
  const session = authClient.useSession();
  const isAuthenticated = !!session.data?.user?.id;

  const { data, isLoading } = useQuery(
    orpc.public.space.listForms.queryOptions({ input: { nick } }),
  );

  const forms = data?.forms ?? [];

  return (
    <SpaceCard
      title="Formulários públicos"
      subtitle="Trabalhe conosco · Comercial · Contato"
      isEmpty={!isLoading && forms.length === 0}
      empty={
        isAuthenticated
          ? "Você ainda não publicou formulários."
          : "A empresa ainda não publicou formulários."
      }
      emptyAction={
        isAuthenticated ? (
          <Button asChild size="sm" >
            <Link href="/form">
              <Plus className="mr-1 size-4" />
              Criar meu primeiro formulário
            </Link>
          </Button>
        ) : null
      }
    >
      {isLoading ? (
        <div className="space-y-2">
          <div className="h-14 animate-pulse rounded-xl bg-muted/50" />
          <div className="h-14 animate-pulse rounded-xl bg-muted/50" />
        </div>
      ) : (
        <ul className="space-y-2">
          {forms.map((f) => (
            <li
              key={f.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-muted/50 p-3"
            >
              <FileText className="size-5 shrink-0 text-info" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {f.name}
                </p>
                {f.description && (
                  <p className="truncate text-xs text-muted-foreground">
                    {f.description}
                  </p>
                )}
              </div>
              {f.shareUrl && (
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                >
                  <a href={f.shareUrl} target="_blank" rel="noreferrer">
                    Abrir
                    <ExternalLink className="ml-1 size-3" />
                  </a>
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </SpaceCard>
  );
}
