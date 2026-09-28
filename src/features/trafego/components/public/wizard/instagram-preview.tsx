"use client";

import { BadgeCheck, Globe, ImageIcon, SearchX } from "lucide-react";
import {
  formatFollowers,
  type TrafegoSocialProfile,
} from "@/features/trafego/lib/social-profile";

const PLACEHOLDER_TILES = Array.from({ length: 6 }, (_, index) => index);

/**
 * Prévia do perfil num celular. Serve para o cliente confirmar de bate-pronto
 * que é a conta dele — nome parecido não basta, a foto e os números confirmam.
 */
export function InstagramPreview({ profile }: { profile: TrafegoSocialProfile }) {
  const networkLabel = profile.network === "instagram" ? "Instagram" : "Facebook";

  return (
    <div className="mx-auto w-full max-w-[250px]">
      <div className="rounded-[2rem] border border-white/15 bg-black/70 p-2 shadow-2xl shadow-violet-950/40">
        <div className="overflow-hidden rounded-[1.65rem] bg-[#0f0f13]">
          <div className="flex items-center justify-between px-4 pb-1 pt-2.5 text-[9px] text-white/40">
            <span>9:41</span>
            <span className="flex gap-1">
              <span className="h-1.5 w-3 rounded-sm bg-white/30" />
              <span className="h-1.5 w-3 rounded-sm bg-white/30" />
            </span>
          </div>

          {profile.found ? (
            <>
              <div className="flex items-center gap-2 px-3.5 py-2">
                <span className="text-white/50">‹</span>
                <span className="truncate text-xs font-semibold text-white">
                  {profile.username ?? profile.handle}
                </span>
              </div>

              <div className="flex items-center gap-3 px-3.5">
                <span className="size-14 shrink-0 overflow-hidden rounded-full border-2 border-violet-400/40 bg-white/10">
                  {profile.pictureUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={profile.pictureUrl}
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : (
                    <span className="flex size-full items-center justify-center text-base font-bold text-white/50">
                      {(profile.name ?? profile.handle).slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </span>

                <dl className="flex flex-1 justify-between text-center">
                  <Stat value={profile.mediaCount} label="publicações" />
                  <Stat value={profile.followers} label="seguidores" />
                  <Stat value={null} label="seguindo" />
                </dl>
              </div>

              <div className="px-3.5 pt-2.5">
                <p className="flex items-center gap-1 text-[11px] font-semibold text-white">
                  {profile.name ?? profile.username ?? profile.handle}
                  {profile.isVerified && (
                    <BadgeCheck className="size-3 shrink-0 text-sky-400" />
                  )}
                </p>
                {profile.biography && (
                  <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-white/50">
                    {profile.biography}
                  </p>
                )}
                {profile.website && (
                  <p className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-sky-300">
                    <Globe className="size-2.5 shrink-0" />
                    {profile.website.replace(/^https?:\/\//, "")}
                  </p>
                )}
              </div>

              <div className="mt-2.5 flex gap-1.5 px-3.5">
                <span className="flex-1 rounded-md bg-[#0095f6] py-1 text-center text-[10px] font-semibold text-white">
                  Seguir
                </span>
                <span className="rounded-md bg-white/10 px-2.5 py-1 text-center text-[10px] font-semibold text-white">
                  +
                </span>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-px bg-white/[0.06]" aria-hidden>
                {PLACEHOLDER_TILES.map((tile) => (
                  <span
                    key={tile}
                    className="flex aspect-square items-center justify-center bg-[#15151a]"
                  >
                    <ImageIcon className="size-3.5 text-white/15" />
                  </span>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center px-5 py-12 text-center">
              <SearchX className="size-8 text-white/25" />
              <p className="mt-3 text-xs font-medium text-white/75">
                Não encontramos @{profile.handle}
              </p>
              <p className="mt-1.5 text-[10px] leading-relaxed text-white/40">
                {profile.reason === "not_business_or_not_found"
                  ? "Perfis pessoais não aparecem aqui. Converta para conta comercial ou siga sem verificar."
                  : "Confira o nome de usuário ou siga sem verificar."}
              </p>
            </div>
          )}
        </div>
      </div>
      <p className="mt-2 text-center text-[10px] text-white/25">
        Prévia do seu perfil no {networkLabel}
      </p>
    </div>
  );
}

function Stat({ value, label }: { value: number | null; label: string }) {
  return (
    <div>
      <dt className="text-[11px] font-bold text-white">{formatFollowers(value)}</dt>
      <dd className="text-[9px] text-white/40">{label}</dd>
    </div>
  );
}
