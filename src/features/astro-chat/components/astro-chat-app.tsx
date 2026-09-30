"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Globe, MessageSquareText, Plus, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AstroMark } from "@/features/astro/components/astro-mark";
import { useAstroChatSites } from "../hooks/use-astro-chat-sites";
import { describeSiteStatus } from "../utils/site-status";
import { CreateSiteDialog } from "./create-site-dialog";
import { SiteDetail } from "./site-detail";
import { SiteStatusPill } from "./site-status-pill";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";

/** App ASTRO CHAT (spec 0031, RF-1): sites com o ASTRO atendendo. O site aberto vive em `?site=`. */

const HIGHLIGHTS = [
  { icon: MessageSquareText, text: "Cada conversa vira lead e chega no Chat, canal ASTRO CHAT." },
  { icon: Sparkles, text: "O ASTRO responde com as instruções e o conhecimento que você escolher." },
  { icon: ShieldCheck, text: "Só abre nos seus domínios, com limite de uso e sem acesso a dados internos." },
];

export function AstroChatApp() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { sites, monthlyPrice, isLoading } = useAstroChatSites();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const openSiteId = searchParams.get("site");
  const openSite = sites.find((site) => site.id === openSiteId);

  const navigateToSite = (siteId: string | null) => {
    router.replace(siteId ? `${pathname}?site=${siteId}` : pathname, { scroll: false });
  };

  return (
    <div className="flex flex-col gap-6 px-4 pb-10 pt-4 md:px-6">
      {openSite ? (
        <SiteDetail site={openSite} monthlyPrice={monthlyPrice} onBack={() => navigateToSite(null)} />
      ) : (
        <>
          <section className="flex flex-col gap-5 rounded-3xl border bg-gradient-to-br from-violet-500/10 via-background to-background p-6 md:flex-row md:items-center">
            <AstroMark className="size-20 shrink-0" />
            <div className="flex-1 space-y-2">
              <h1 className="text-2xl font-semibold">ASTRO CHAT</h1>
              <p className="max-w-2xl text-muted-foreground">
                O ASTRO atendendo os visitantes do site da sua empresa, com a mesma inteligência do Órbita.
              </p>
              <ul className="grid gap-1.5 pt-1 text-sm md:grid-cols-3">
                {HIGHLIGHTS.map((highlight) => (
                  <li key={highlight.text} className="flex gap-2">
                    <highlight.icon className="mt-0.5 size-4 shrink-0 text-violet-500" />
                    {highlight.text}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col items-start gap-2 md:items-end">
              <span className="text-sm text-muted-foreground">{monthlyPrice} Stars / mês por site</span>
              <Button
                onClick={() => setIsCreateOpen(true)}
                data-guide={GUIDE_ANCHORS.astroChatAddSite.id}
              >
                <Plus className="size-4" /> Adicionar site
              </Button>
            </div>
          </section>

          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((index) => (
                <Skeleton key={index} className="h-36 rounded-2xl" />
              ))}
            </div>
          ) : sites.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
              Nenhum site ainda. Adicione o primeiro e cole uma linha de código no site da empresa.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {sites.map((site) => {
                const status = describeSiteStatus(site);
                return (
                  <button
                    key={site.id}
                    type="button"
                    onClick={() => navigateToSite(site.id)}
                    className="flex flex-col gap-3 rounded-2xl border bg-card p-5 text-left transition hover:border-primary/40 hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="size-3 rounded-full"
                          style={{ backgroundColor: site.accentColor }}
                          aria-hidden
                        />
                        <span className="font-semibold">{site.name}</span>
                      </div>
                      <SiteStatusPill label={status.label} tone={status.tone} />
                    </div>
                    <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                      {site.allowedOrigins.length ? (
                        site.allowedOrigins.map((origin) => (
                          <span key={origin} className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                            <Globe className="size-3" />
                            {origin.replace(/^https?:\/\//, "")}
                          </span>
                        ))
                      ) : (
                        <span>Sem domínio</span>
                      )}
                    </div>
                    <div className="mt-auto flex justify-between text-xs text-muted-foreground">
                      <span>{site.tracking?.name ?? "Sem tracking"}</span>
                      <span>{site._count.visitors} visitantes</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      <CreateSiteDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        monthlyPrice={monthlyPrice}
        onCreated={navigateToSite}
      />
    </div>
  );
}
