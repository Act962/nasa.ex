"use client";

import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Github, Linkedin, Mail, FileText, ExternalLink,
  Building2, ArrowLeft, Sparkles, Wrench,
} from "lucide-react";
import { POSITIONS } from "@/features/company/constants";
import { NasaFooterPublic } from "@/components/nasa-footer-public";

interface ProfileCard {
  headline:     string | null;
  bio:          string | null;
  cvUrl:        string | null;
  linkedinUrl:  string | null;
  githubUrl:    string | null;
  portfolioUrl: string | null;
  email:        string | null;
}

interface SkillEntry {
  level: number;
  skill: { id: string; name: string; slug: string };
}

interface ToolEntry {
  proficiency: number;
  tool: { id: string; name: string; slug: string; iconUrl: string | null };
}

interface Membership {
  cargo: string | null;
  role:  string;
  organization: {
    id:                string;
    name:              string;
    slug:              string;
    logo:              string | null;
    isSpacehomePublic: boolean;
    spaceStation:      { nick: string } | null;
  };
}

interface ProfileViewProps {
  user:        { id: string; name: string | null; image: string | null };
  card:        ProfileCard | null;
  skills:      SkillEntry[];
  tools:       ToolEntry[];
  memberships: Membership[];
}

const POSITION_BY_SLUG = new Map(POSITIONS.map((p) => [p.slug, p]));

export function ProfileView({ user, card, skills, tools, memberships }: ProfileViewProps) {
  return (
    <div className="min-h-screen bg-slate-950 pb-20 text-white">
      <div className="mx-auto max-w-4xl px-4 pt-6 md:px-6">
        {/* Voltar */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition-colors"
        >
          <ArrowLeft className="size-4" />
          Voltar
        </Link>

        {/* Header do perfil */}
        <section className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-6 shadow-xl md:p-8">
          <div className="flex flex-col items-center gap-4 text-center md:flex-row md:items-start md:gap-6 md:text-left">
            <div className="relative size-24 shrink-0 overflow-hidden rounded-full border-4 border-white/20 bg-slate-800 md:size-32">
              {user.image ? (
                <Image
                  src={user.image}
                  alt={user.name ?? ""}
                  fill
                  className="object-cover"
                  sizes="128px"
                  unoptimized
                  priority
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-orange-300">
                  {user.name?.[0]?.toUpperCase() ?? "?"}
                </div>
              )}
            </div>

            <div className="flex-1 space-y-2">
              <h1 className="text-2xl font-bold md:text-3xl">
                {user.name ?? "Sem nome"}
              </h1>
              {card?.headline && (
                <p className="text-base text-white/80">{card.headline}</p>
              )}
              {card?.bio && (
                <p className="text-sm leading-relaxed text-white/60 max-w-2xl">
                  {card.bio}
                </p>
              )}

              {/* Links públicos */}
              {card && (
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2 md:justify-start">
                  {card.linkedinUrl && (
                    <SocialButton href={card.linkedinUrl} icon={<Linkedin className="size-3.5" />} label="LinkedIn" />
                  )}
                  {card.githubUrl && (
                    <SocialButton href={card.githubUrl} icon={<Github className="size-3.5" />} label="GitHub" />
                  )}
                  {card.portfolioUrl && (
                    <SocialButton href={card.portfolioUrl} icon={<ExternalLink className="size-3.5" />} label="Portfólio" />
                  )}
                  {card.cvUrl && (
                    <SocialButton href={card.cvUrl} icon={<FileText className="size-3.5" />} label="Currículo" />
                  )}
                  {card.email && (
                    <SocialButton href={`mailto:${card.email}`} icon={<Mail className="size-3.5" />} label="E-mail" external={false} />
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Empresas (Memberships) */}
        {memberships.length > 0 && (
          <section className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 p-5">
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
              <Building2 className="size-4 text-orange-400" />
              Empresas
            </h2>
            <ul className="space-y-2">
              {memberships.map((m) => {
                const position = m.cargo ? POSITION_BY_SLUG.get(m.cargo) : null;
                const positionLabel = position?.label ?? (m.role === "owner" ? "CEO / Sócio-Fundador" : "Membro");
                const stationNick = m.organization.spaceStation?.nick;
                const linkable = m.organization.isSpacehomePublic && stationNick;

                const content = (
                  <div className="flex items-center gap-3">
                    <div className="relative size-10 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-white/5">
                      {m.organization.logo ? (
                        <Image src={m.organization.logo} alt={m.organization.name} fill className="object-cover" sizes="40px" unoptimized />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs font-bold text-white/60">
                          {m.organization.name[0]?.toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">{m.organization.name}</p>
                      <p className="truncate text-xs text-white/60">{positionLabel}</p>
                    </div>
                    {linkable && (
                      <span className="shrink-0 text-xs text-orange-300">
                        Ver Spacehome →
                      </span>
                    )}
                  </div>
                );

                return (
                  <li key={m.organization.id}>
                    {linkable ? (
                      <Link
                        href={`/space/${stationNick}`}
                        className="block rounded-xl border border-white/5 bg-white/5 p-3 transition-colors hover:border-orange-400/40 hover:bg-orange-500/5"
                      >
                        {content}
                      </Link>
                    ) : (
                      <div className="rounded-xl border border-white/5 bg-white/5 p-3">
                        {content}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Skills */}
        {skills.length > 0 && (
          <section className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 p-5">
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
              <Sparkles className="size-4 text-emerald-400" />
              Skills
            </h2>
            <div className="flex flex-wrap gap-2">
              {skills.map((s) => (
                <Badge
                  key={s.skill.id}
                  variant="outline"
                  className="border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                >
                  {s.skill.name}
                  <span className="ml-1.5 text-[10px] text-emerald-300/70">{s.level}</span>
                </Badge>
              ))}
            </div>
          </section>
        )}

        {/* Tools */}
        {tools.length > 0 && (
          <section className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 p-5">
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
              <Wrench className="size-4 text-sky-400" />
              Ferramentas
            </h2>
            <div className="flex flex-wrap gap-2">
              {tools.map((t) => (
                <div
                  key={t.tool.id}
                  className="flex items-center gap-1.5 rounded-md border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-xs text-sky-200"
                >
                  {t.tool.iconUrl && (
                    <Image src={t.tool.iconUrl} alt={t.tool.name} width={14} height={14} className="rounded" unoptimized />
                  )}
                  <span>{t.tool.name}</span>
                  <span className="text-[10px] text-sky-300/70">{t.proficiency}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Vazio */}
        {!card && memberships.length === 0 && skills.length === 0 && tools.length === 0 && (
          <section className="mt-5 rounded-2xl border border-white/10 bg-slate-900/60 p-8 text-center">
            <p className="text-sm text-white/60">
              Este usuário ainda não publicou um perfil completo.
            </p>
          </section>
        )}
      </div>

      <NasaFooterPublic />
    </div>
  );
}

function SocialButton({
  href, icon, label, external = true,
}: {
  href:     string;
  icon:     React.ReactNode;
  label:    string;
  external?: boolean;
}) {
  return (
    <Button
      asChild
      size="sm"
      variant="outline"
      className="h-7 border-white/20 bg-white/5 px-2.5 text-xs text-white/80 hover:bg-white/10"
    >
      <a
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
      >
        {icon}
        <span className="ml-1">{label}</span>
      </a>
    </Button>
  );
}
