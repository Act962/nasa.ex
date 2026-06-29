import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import Link from "next/link";
import { RedeemForm } from "./redeem-form";
import { AlertCircle, CheckCircle2, Clock, Mail } from "lucide-react";

interface Params {
  token: string;
}

/**
 * Página pública de resgate da compra de curso (`/resgatar/[token]`).
 *
 * Server component: carrega o `PendingCoursePurchase` pelo `signupToken`,
 * trata estados (não encontrado / expirado / já redimido / não pago) e
 * renderiza o formulário de cadastro pra status PAID.
 */
export default async function Page({
  params,
}: {
  params: Promise<Params>;
}) {
  const { token } = await params;

  const pending = await prisma.pendingCoursePurchase.findUnique({
    where: { signupToken: token },
    select: {
      id: true,
      email: true,
      status: true,
      priceStars: true,
      amountBrlCents: true,
      tokenExpiresAt: true,
      paidAt: true,
      course: {
        select: {
          slug: true,
          title: true,
          coverUrl: true,
          creatorOrg: { select: { name: true, slug: true } },
        },
      },
      plan: { select: { name: true } },
    },
  });

  // Sessão atual (pode estar logado em outra conta)
  const sessionData = await auth.api.getSession({ headers: await headers() });
  const sessionEmail = sessionData?.user?.email?.toLowerCase() ?? null;

  if (!pending) {
    return (
      <Shell>
        <Banner
          icon={<AlertCircle className="size-12 text-rose-400" />}
          title="Link inválido"
          subtitle="Este link de resgate não existe ou foi reescrito. Verifique se você abriu o e-mail mais recente que recebeu."
        />
      </Shell>
    );
  }

  // Token expirado?
  const isExpired =
    pending.tokenExpiresAt && pending.tokenExpiresAt.getTime() < Date.now();

  if (pending.status === "REDEEMED") {
    return (
      <Shell>
        <Banner
          icon={<CheckCircle2 className="size-12 text-emerald-400" />}
          title="Compra já resgatada"
          subtitle={`O acesso ao curso "${pending.course.title}" já foi liberado para esta conta. Faça login para acessar.`}
          cta={
            <Link
              href="/sign-in"
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
          subtitle={`Este link expirou. Entre em contato com o suporte da plataforma informando o e-mail ${pending.email} para reenviarmos o acesso.`}
          cta={
            <a
              href={`mailto:suporte@nasaagents.com?subject=Resgate%20expirado%20-%20${encodeURIComponent(pending.email)}`}
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
          title="Pagamento ainda processando"
          subtitle="Aguardando confirmação do Stripe. Recarregue esta página em alguns instantes."
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
          subtitle="Esta compra não está em um estado válido para resgate. Contate o suporte."
        />
      </Shell>
    );
  }

  // PAID + token válido: render form
  const expiresAt = pending.tokenExpiresAt
    ? pending.tokenExpiresAt.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
      })
    : null;

  // Caso o usuário esteja logado em conta diferente, alertamos
  const wrongAccount =
    sessionEmail && sessionEmail !== pending.email.toLowerCase();

  return (
    <Shell>
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 md:p-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
            ✓ Pagamento confirmado
          </div>
          <h1 className="mt-3 text-2xl font-bold text-white md:text-3xl">
            Última etapa: criar sua conta
          </h1>
          <p className="mt-2 text-sm text-white/60">
            Você comprou{" "}
            <strong className="text-white">{pending.course.title}</strong>
            {pending.plan?.name && (
              <>
                {" — "}
                <span className="text-white/80">{pending.plan.name}</span>
              </>
            )}
            . Crie uma senha para acessar.
          </p>
        </div>

        {wrongAccount && (
          <div className="mt-5 rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-200">
            <strong>Atenção:</strong> você está logado como{" "}
            <code>{sessionEmail}</code>, mas esta compra é para{" "}
            <code>{pending.email}</code>. Saia da conta atual antes de
            resgatar.
          </div>
        )}

        <RedeemForm
          token={token}
          email={pending.email}
          courseTitle={pending.course.title}
          companySlug={pending.course.creatorOrg.slug}
          courseSlug={pending.course.slug}
          isAuthenticated={!!sessionData?.user}
          sessionEmail={sessionEmail}
        />

        {expiresAt && (
          <p className="mt-4 text-center text-[11px] text-white/40">
            Link válido até <strong>{expiresAt}</strong>.
          </p>
        )}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 px-4 py-12">
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
      <p className="mt-2 text-sm text-white/60">{subtitle}</p>
      {cta && <div className="mt-6">{cta}</div>}
    </div>
  );
}
