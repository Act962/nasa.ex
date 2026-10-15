import prisma from "@/lib/prisma";
import { readUnsubscribeToken } from "@/features/campanhas/email/unsubscribe-token";

// Spec 0107 (RF-4): confirmação do descadastro. GET só mostra; quem grava é o botão (POST),
// para o robô de segurança do provedor de email não descadastrar ninguém ao abrir o link.

function maskEmail(email: string): string {
  const [user = "", domain = ""] = email.split("@");
  return `${user.slice(0, 2)}${"•".repeat(Math.max(1, user.length - 2))}@${domain}`;
}

type PageProps = { searchParams: Promise<{ t?: string; ok?: string }> };

export default async function EmailUnsubscribePage({ searchParams }: PageProps) {
  const { t: token = "", ok } = await searchParams;
  const target = readUnsubscribeToken(token);
  const organization = target
    ? await prisma.organization.findUnique({
        where: { id: target.organizationId },
        select: { name: true },
      })
    : null;

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 text-center shadow-sm">
        {!target ? (
          <p className="text-sm text-muted-foreground">Link inválido ou expirado.</p>
        ) : ok ? (
          <>
            <h1 className="text-lg font-semibold">Pronto</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {maskEmail(target.email)} não vai mais receber emails de {organization?.name ?? "esta empresa"}.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-lg font-semibold">Parar de receber emails</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {maskEmail(target.email)} vai deixar de receber emails de {organization?.name ?? "esta empresa"}.
            </p>
            <form method="post" action={`/api/email/unsubscribe?t=${encodeURIComponent(token)}&from=page`}>
              <button
                type="submit"
                className="mt-5 w-full rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                Não quero mais receber
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
