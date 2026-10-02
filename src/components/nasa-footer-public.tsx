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
  { label: "ÓRBITA Route",     path: "/nasa-route",    emoji: "🗺️" },
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
    <footer className="dark mt-20 bg-background py-10 text-foreground">
      <div className="mx-auto grid max-w-6xl gap-8 px-6 md:grid-cols-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Image
              src="/orbita-logo-dark.svg"
              alt="ÓRBITA"
              width={36}
              height={36}
              className="rounded"
              priority
            />
            <span className="font-bold tracking-tight">ÓRBITA</span>
          </div>
          <p className="text-xs text-muted-foreground">
            © {year} NASAEX Inc. Todos os direitos reservados.
          </p>
          <p className="text-[11px] text-muted-foreground/70">
            A plataforma que centraliza times, leads e operação.
          </p>
        </div>

        <nav aria-labelledby="footer-platform" className="md:col-span-2">
          <h4
            id="footer-platform"
            className="mb-3 text-sm font-semibold text-foreground"
          >
            Plataforma
          </h4>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-muted-foreground">
            {NASA_APPS.map((app) => (
              <li key={app.path}>
                <a
                  href={isAuthenticated ? app.path : `/sign-up?next=${encodeURIComponent(app.path)}`}
                  onClick={(e) => handleAppClick(e, app.path)}
                  className="inline-flex items-center gap-1.5 transition hover:text-foreground"
                >
                  {app.emoji && <span aria-hidden>{app.emoji}</span>}
                  {app.label}
                </a>
              </li>
            ))}
          </ul>

          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <li>
              <Link href="/" className="transition hover:text-foreground">
                Nossa Space
              </Link>
            </li>
            <li>
              <Link href="/calendario" className="transition hover:text-foreground">
                Calendário público
              </Link>
            </li>
            <li>
              <Link href="/termos" className="transition hover:text-foreground">
                Termos de uso
              </Link>
            </li>
            <li>
              <Link href="/privacidade" className="transition hover:text-foreground">
                Privacidade
              </Link>
            </li>
          </ul>
        </nav>

        <div>
          <h4 className="mb-3 text-sm font-semibold text-foreground">
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

          <p className="mt-4 text-[11px] text-muted-foreground/70">
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
      className="flex size-9 items-center justify-center rounded-full bg-knob text-muted-foreground transition hover:bg-info/15 hover:text-info"
    >
      {icon}
    </a>
  );
}
