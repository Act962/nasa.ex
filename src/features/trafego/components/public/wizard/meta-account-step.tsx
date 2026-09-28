"use client";

import { useState } from "react";
import { AtSign, CheckCircle2, Loader2, SearchCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLookupTrafegoSocialProfile } from "@/features/trafego/hooks/use-trafego-verification";
import {
  formatFollowers,
  type SocialNetwork,
  type TrafegoSocialProfile,
} from "@/features/trafego/lib/social-profile";
import { InstagramPreview } from "./instagram-preview";

interface MetaAccountStepProps {
  handle: string;
  onHandle: (value: string) => void;
  network: SocialNetwork;
  onNetwork: (value: SocialNetwork) => void;
  profile: TrafegoSocialProfile | null;
  onProfile: (profile: TrafegoSocialProfile | null) => void;
  /** false quando a agência não tem integração Meta — o campo só guarda o @. */
  lookupEnabled: boolean;
}

const TABS: Array<{ id: SocialNetwork; label: string }> = [
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
];

export function MetaAccountStep({
  handle,
  onHandle,
  network,
  onNetwork,
  profile,
  onProfile,
  lookupEnabled,
}: MetaAccountStepProps) {
  const lookup = useLookupTrafegoSocialProfile();
  const [error, setError] = useState<string | null>(null);
  const clean = handle.trim().replace(/^@/, "");

  function handleLookup() {
    if (!clean) return;
    setError(null);
    // A rede vem da aba, não do texto: mandamos no formato de URL para o
    // normalizador do servidor resolver sem adivinhar.
    const qualified = network === "facebook" ? `facebook.com/${clean}` : clean;
    lookup.mutate(
      { handle: qualified },
      {
        onSuccess: (result) => onProfile(result),
        onError: (mutationError) => {
          onProfile(null);
          setError(mutationError.message);
        },
      },
    );
  }

  // Sem integração Meta na agência não há o que pré-visualizar — a coluna do
  // celular sai em vez de virar um vazio de meia tela.
  const showPreview = lookupEnabled;

  return (
    <div
      className={cn(
        "grid gap-6",
        showPreview && "lg:grid-cols-[1fr_250px] lg:items-start",
      )}
    >
      <div>
        <div className="inline-flex w-full rounded-xl border border-white/10 bg-white/[0.03] p-1 sm:w-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                onNetwork(tab.id);
                onProfile(null);
              }}
              className={cn(
                "flex-1 rounded-lg px-6 py-2 text-sm font-medium transition sm:flex-none",
                network === tab.id
                  ? "bg-violet-600 text-white"
                  : "text-white/50 hover:text-white/80",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <label className="mt-5 block text-xs font-medium text-white/55">
          Nome de usuário da rede social
        </label>
        <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <AtSign className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/30" />
            <input
              value={clean}
              onChange={(event) => {
                onHandle(event.target.value);
                if (profile) onProfile(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleLookup();
                }
              }}
              placeholder="suaempresa"
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-9 pr-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-violet-400/60"
            />
          </div>

          {lookupEnabled && (
            <button
              type="button"
              onClick={handleLookup}
              disabled={!clean || lookup.isPending}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.05] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/[0.09] disabled:opacity-40"
            >
              {lookup.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <SearchCheck className="size-4" />
              )}
              Verificar conta
            </button>
          )}
        </div>

        {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}

        {profile?.found && (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-400/25 bg-emerald-500/[0.08] p-4">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-400" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-emerald-200">Conta encontrada!</p>
              <p className="mt-1 truncate text-xs text-white/70">
                @{profile.username ?? profile.handle}
              </p>
              {profile.name && (
                <p className="truncate text-xs text-white/70">{profile.name}</p>
              )}
              {profile.followers !== null && (
                <p className="text-xs text-white/45">
                  {formatFollowers(profile.followers)} seguidores
                </p>
              )}
            </div>
          </div>
        )}

        {profile && !profile.found && (
          <div className="mt-4 rounded-xl border border-amber-400/25 bg-amber-500/[0.08] p-4 text-xs leading-relaxed text-amber-100">
            Não encontramos <strong>@{profile.handle}</strong>. Confira o nome de
            usuário — ou siga assim mesmo: nossa equipe confere a conta na análise,
            antes de qualquer anúncio ir ao ar.
          </div>
        )}

        {!lookupEnabled && clean && (
          <p className="mt-3 text-xs text-white/35">
            Nossa equipe confere a conta na análise, depois do pagamento.
          </p>
        )}
      </div>

      {showPreview && (
        <div className="hidden lg:block">
          {profile ? (
            <InstagramPreview profile={profile} />
          ) : (
            <EmptyPreview network={network} />
          )}
        </div>
      )}
    </div>
  );
}

function EmptyPreview({ network }: { network: SocialNetwork }) {
  return (
    <div className="mx-auto w-full max-w-[250px]">
      <div className="rounded-[2rem] border border-dashed border-white/10 bg-white/[0.015] p-2">
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-[1.65rem] px-6 py-10 text-center">
          <SearchCheck className="size-7 text-white/15" />
          <p className="mt-3 text-[11px] leading-relaxed text-white/30">
            Digite o usuário e toque em “Verificar conta” para ver a prévia do seu
            perfil no {network === "instagram" ? "Instagram" : "Facebook"}.
          </p>
        </div>
      </div>
    </div>
  );
}
