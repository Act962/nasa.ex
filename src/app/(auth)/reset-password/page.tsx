export const dynamic = "force-dynamic";

import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import {
  Bot,
  KeyRound,
  Mail,
  Shield,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { ResetPasswordForm } from "./reset-password-form";

const HIGHLIGHTS = [
  { icon: Mail, label: "Link seguro", desc: "Enviado ao e-mail cadastrado" },
  { icon: ShieldCheck, label: "Token temporário", desc: "Expira em pouco tempo" },
  { icon: KeyRound, label: "Nova senha", desc: "Troque o acesso em minutos" },
  { icon: Sparkles, label: "Fluxo simples", desc: "Sem etapas desnecessárias" },
  { icon: Bot, label: "Suporte 24/7", desc: "Equipe pronta para ajudar" },
  { icon: Shield, label: "Proteção", desc: "Seu acesso continua seguro" },
];

const RESET_STATS = [
  { value: "1 clique", label: "para recuperar" },
  { value: "60 min", label: "expiração padrão" },
  { value: "100%", label: "email protegido" },
];

function OrbitaWordmark({ isCompact }: { isCompact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 no-underline">
      <div
        className={
          isCompact
            ? "flex size-[30px] items-center justify-center rounded-lg bg-info"
            : "flex size-[34px] shrink-0 items-center justify-center rounded-[9px] bg-info shadow-[0_0_16px_color-mix(in_oklch,var(--info)_45%,transparent)]"
        }
      >
        <Image
          src="/icon-astro.svg"
          alt="ÓRBITA"
          width={isCompact ? 18 : 20}
          height={isCompact ? 18 : 20}
          unoptimized
        />
      </div>
      <span className={isCompact ? "text-[17px] font-extrabold text-foreground" : "text-lg font-extrabold tracking-tight text-foreground"}>
        ÓRBITA<span className="text-info">.ex</span>
      </span>
    </Link>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="dark flex min-h-svh text-foreground">
      <div className="sticky top-0 hidden h-svh w-1/2 flex-col overflow-hidden lg:flex">
        <div
          className="pointer-events-none absolute inset-0 bg-size-[32px_32px] mask-[radial-gradient(ellipse_80%_80%_at_50%_50%,black_40%,transparent_100%)]"
          style={{
            backgroundImage:
              "radial-gradient(color-mix(in oklch, var(--info) 18%, transparent) 1px, transparent 1px)",
          }}
        />

        <div
          className="pointer-events-none absolute top-1/2 left-1/2 size-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background:
              "radial-gradient(circle, color-mix(in oklch, var(--info) 14%, transparent) 0%, transparent 70%)",
          }}
        />

        <div className="relative z-10 shrink-0 px-9 py-7">
          <OrbitaWordmark />
        </div>

        <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-5 px-9">
          <div className="size-[130px] shrink-0 animate-[astroResetFloat_3.2s_ease-in-out_infinite] drop-shadow-[0_0_28px_color-mix(in_oklch,var(--info)_55%,transparent)]">
            <Image src="/icon-astro.svg" alt="ASTRO" width={130} height={130} unoptimized />
          </div>

          <div className="text-center">
            <h1 className="m-0 text-[26px] leading-tight font-black tracking-tight text-foreground">
              Recuperar acesso é <span className="text-info">rápido e seguro</span>
            </h1>
            <p className="mt-2 mb-0 text-[13px] leading-normal text-muted-foreground">
              Envie o link para seu e-mail e redefina a senha em poucos cliques.
            </p>
          </div>

          <div className="grid w-full grid-cols-2 gap-2">
            {HIGHLIGHTS.map(({ icon: Icon, label, desc }) => (
              <div
                key={label}
                className="flex items-center gap-2.5 rounded-xl border border-line bg-foreground/5 px-3 py-2.5 backdrop-blur-sm"
              >
                <div className="flex size-7 shrink-0 items-center justify-center rounded-[7px] bg-info/25">
                  <Icon className="size-[13px] text-info" />
                </div>
                <div className="min-w-0">
                  <p className="m-0 text-xs leading-none font-bold text-foreground">{label}</p>
                  <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex shrink-0 justify-around px-9 pt-5 pb-7">
          {RESET_STATS.map(({ value, label }) => (
            <div key={label} className="text-center">
              <p className="m-0 text-lg leading-none font-extrabold text-foreground">{value}</p>
              <p className="mt-[3px] text-[10px] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        <style>{`
          @keyframes astroResetFloat {
            0%,100% { transform: translateY(0) rotate(2deg); }
            50% { transform: translateY(-12px) rotate(-2deg); }
          }
        `}</style>
      </div>

      <div className="flex min-h-svh flex-1 flex-col items-center justify-center px-6 py-10">
        <div className="mb-7 lg:hidden">
          <OrbitaWordmark isCompact />
        </div>

        <div className="w-full max-w-[460px]">
          <Suspense fallback={null}>
            <ResetPasswordForm />
          </Suspense>
        </div>

        <p className="mt-4 text-center text-[11px] text-muted-foreground/60">
          Segurança em primeiro lugar. O link expira automaticamente.
        </p>
      </div>
    </div>
  );
}
