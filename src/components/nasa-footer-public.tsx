"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Instagram, Linkedin, Twitter, Youtube } from "lucide-react";

/**
 * Footer público reutilizável — presente em /calendario, /space/*,
 * /s/*, /station/*. Os links em "Plataforma" listam os Apps NASA:
 * usuário logado vai direto pro app; deslogado é mandado pro /sign-up
 * com `?next=` pra cair no app desejado após criar a conta.
 */

interface NasaAppLink {
  label: string;
  path:  string;
  emoji?: string;
}

const NASA_APPS: NasaAppLink[] = [
  { label: "Tracking",       path: "/tracking",      emoji: "🎯" },
  { label: "Agenda",         path: "/agendas",       emoji: "📅" },
  { label: "Formulários",    path: "/form",          emoji: "📋" },
  { label: "N-Box",          path: "/nbox",          emoji: "🗃️" },
  { label: "Workspaces",     path: "/workspaces",    emoji: "🛠️" },
  { label: "Insights",       path: "/insights",      emoji: "📊" },
  { label: "Space Help",     path: "/space-help",    emoji: "🚀" },
  { label: "Space Station",  path: "/space-station", emoji: "🛰️" },
  { label: "Linnker",        path: "/linnker",       emoji: "🔗" },
  { label: "Forge",          path: "/forge",         emoji: "⚒️" },
  { label: "Payment",        path: "/payment",       emoji: "💳" },
  { label: "NASA Route",     path: "/nasa-route",    emoji: "🗺️" },
];

export function NasaFooterPublic() {
  const router = useRouter();
  const session = authClient.useSession();
  const isAuthenticated = !!session.data?.user?.id;
  const year = new Date().getFullYear();

  function handleAppClick(e: React.MouseEvent, path: string) {
    e.preventDefault();
    if (isAuthenticated) {
      router.push(path);
    } else {
      router.push(`/sign-up?next=${encodeURIComponent(path)}`);
    }
  }

  return (
    <footer className="mt-20 border-t border-white/10 bg-slate-950 py-10 text-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-6 md:grid-cols-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Image
              src="/logo-dark.png"
              alt="N.A.S.A"
              width={36}
              height={36}
              className="rounded"
              priority
            />
            <span className="font-bold tracking-tight">N.A.S.A</span>
          </div>
          <p className="text-xs text-white/60">
            © {year} NASAEX Inc. Todos os direitos reservados.
          </p>
          <p className="text-[11px] text-white/40">
            A plataforma que centraliza times, leads e operação.
          </p>
        </div>

        <nav aria-labelledby="footer-platform" className="md:col-span-2">
          <h4
            id="footer-platform"
            className="mb-3 text-sm font-semibold text-white"
          >
            Plataforma
          </h4>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-white/60">
            {NASA_APPS.map((app) => (
              <li key={app.path}>
                <a
                  href={isAuthenticated ? app.path : `/sign-up?next=${encodeURIComponent(app.path)}`}
                  onClick={(e) => handleAppClick(e, app.path)}
                  className="inline-flex items-center gap-1.5 transition hover:text-white"
                >
                  {app.emoji && <span aria-hidden>{app.emoji}</span>}
                  {app.label}
                </a>
              </li>
            ))}
          </ul>

          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/50">
            <li>
              <Link href="/" className="transition hover:text-white">
                Nossa Space
              </Link>
            </li>
            <li>
              <Link href="/calendario" className="transition hover:text-white">
                Calendário público
              </Link>
            </li>
            <li>
              <Link href="/termos" className="transition hover:text-white">
                Termos de uso
              </Link>
            </li>
            <li>
              <Link href="/privacidade" className="transition hover:text-white">
                Privacidade
              </Link>
            </li>
          </ul>
        </nav>

        <div>
          <h4 className="mb-3 text-sm font-semibold text-white">
            Siga a gente
          </h4>
          <div className="flex flex-wrap gap-2">
            <SocialIcon
              href="https://instagram.com/nasaagents"
              label="Instagram"
              icon={<Instagram className="size-4" />}
            />
            <SocialIcon
              href="https://linkedin.com/company/nasaagents"
              label="LinkedIn"
              icon={<Linkedin className="size-4" />}
            />
            <SocialIcon
              href="https://twitter.com/nasaagents"
              label="X / Twitter"
              icon={<Twitter className="size-4" />}
            />
            <SocialIcon
              href="https://youtube.com/@nasaagents"
              label="YouTube"
              icon={<Youtube className="size-4" />}
            />
          </div>

          <p className="mt-4 text-[11px] text-white/40">
            Acompanhe novidades e cases reais.
          </p>
        </div>
      </div>
    </footer>
  );
}

function SocialIcon({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      title={label}
      className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:border-orange-400/40 hover:bg-orange-500/10 hover:text-orange-200"
    >
      {icon}
    </a>
  );
}
