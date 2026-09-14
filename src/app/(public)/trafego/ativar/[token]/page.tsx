import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Clock, Mail } from "lucide-react";
import { ActivateForm } from "./activate-form";
import { PLATFORM_SHORT_LABEL } from "@/features/trafego/lib/catalog-labels";
import { formatBrlFromCents } from "@/features/trafego/lib/pricing";

/**
 * Ativação da conta pós-pagamento (`/trafego/ativar/[token]`).
 *
 * Server component: carrega a compra pelo `signupToken` e trata os estados
 * terminais (inexistente / expirado / já ativado / ainda não pago) antes de
 * renderizar o formulário.
 */
export default async function TrafegoActivatePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const pending = await prisma.trafegoPendingPurchase.findUnique({
    where: { signupToken: token },
    select: {
      email: true,
      status: true,
      platform: true,
      adBudgetBrlCents: true,
      serviceFeeBrlCents: true,
      amountBrlCents: true,
      tokenExpiresAt: true,
      companyName: true,
      plan: { select: { name: true, durationDays: true } },
      order: { select: { id: true } },
    },
  });

  const sessionData = await auth.api.getSession({ headers: await headers() });
  const sessionEmail = sessionData?.user?.email?.toLowerCase() ?? null;

  if (!pending) {
    return (
      <Shell>
        <Banner
          icon={<AlertCircle className="size-12 text-rose-400" />}
          title="Link inválido"
          subtitle="Este link de ativação não existe. Verifique se abriu o e-mail mais recente que enviamos."
        />
      </Shell>
    );
  }

  const isExpired =
    pending.tokenExpiresAt && pending.tokenExpiresAt.getTime() < Date.now();

  if (pending.status === "REDEEMED") {
    return (
      <Shell>
        <Banner
          icon={<CheckCircle2 className="size-12 text-emerald-400" />}
          title="Conta já ativada"
          subtitle="Sua campanha já está no painel. Faça login para acessar."
          cta={
            <Link
              href={`/sign-in?callbackUrl=${encodeURIComponent(
                pending.order ? `/trafego/painel/${pending.order.id}` : "/trafego/painel",
              )}`}
              className="inline-flex items-center justify-center rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-500"
            >
              Fazer login
            </Link>
          }
        />
      </Shell>
    );
  }

  if (pending.status === "EXPIRED" || isExpired) {
    return (
      <Shell>
        <Banner
          icon={<Clock className="size-12 text-amber-400" />}
          title="Link expirado"
          subtitle={`Este link expirou. Fale com o suporte informando o e-mail ${pending.email} para reenviarmos o acesso.`}
          cta={
            <a
              href={`mailto:suporte@nasaagents.com?subject=${encodeURIComponent(
                `trafeGO — link expirado (${pending.email})`,
              )}`}
              className="inline-flex items-center justify-center rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-500"
            >
              <Mail className="mr-2 size-4" />
              Falar com suporte
            </a>
          }
        />
      </Shell>
    );
  }

  if (pending.status === "PENDING") {
    return (
      <Shell>
        <Banner
          icon={<Clock className="size-12 text-amber-400" />}
          title="Pagamento em processamento"
          subtitle="Assim que o pagamento for confirmado, este link libera a criação da conta. Recarregue em alguns instantes."
        />
      </Shell>
    );
  }

  if (pending.status !== "PAID") {
    return (
      <Shell>
        <Banner
          icon={<AlertCircle className="size-12 text-rose-400" />}
          title="Compra indisponível"
          subtitle="Esta compra não está em um estado válido para ativação. Fale com o suporte."
        />
      </Shell>
    );
  }

  const wrongAccount =
    sessionEmail && sessionEmail !== pending.email.toLowerCase();

  return (
    <Shell>
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 md:p-8">
        <div className="text-center">
          <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
            ✓ Pagamento confirmado
          </span>
          <h1 className="mt-3 text-2xl font-bold text-white md:text-3xl">
            Última etapa: criar sua conta
          </h1>
          <p className="mt-2 text-sm text-white/60">
            {pending.plan?.name ?? "Sua campanha"} ·{" "}
            {PLATFORM_SHORT_LABEL[pending.platform]} ·{" "}
            {formatBrlFromCents(pending.amountBrlCents)}
          </p>
        </div>

        {wrongAccount && (
          <div className="mt-5 rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-200">
            <strong>Atenção:</strong> você está logado como{" "}
            <code>{sessionEmail}</code>, mas esta compra é de{" "}
            <code>{pending.email}</code>. Saia da conta atual antes de ativar.
          </div>
        )}

        <ActivateForm
          token={token}
          email={pending.email}
          defaultName={pending.companyName ?? ""}
          isAuthenticated={Boolean(sessionData?.user)}
          sessionEmail={sessionEmail}
        />

        {pending.tokenExpiresAt && (
          <p className="mt-4 text-center text-[11px] text-white/40">
            Link válido até{" "}
            <strong>
              {pending.tokenExpiresAt.toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "long",
              })}
            </strong>
            .
          </p>
        )}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-12">
      <div className="mx-auto max-w-md">{children}</div>
    </div>
  );
}

function Banner({
  icon,
  title,
  subtitle,
  cta,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  cta?: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center">
      <div className="inline-flex">{icon}</div>
      <h1 className="mt-4 text-2xl font-bold text-white">{title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-white/60">{subtitle}</p>
      {cta && <div className="mt-6">{cta}</div>}
    </div>
  );
}
