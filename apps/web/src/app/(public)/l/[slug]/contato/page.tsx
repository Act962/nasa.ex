import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { extractWhatsappPhone, type SocialLink } from "@/features/linnker/lib/extract-whatsapp-phone";
import type { Metadata } from "next";

/**
 * Página intersticial pra adicionar contato: `/l/<slug>/contato`
 *
 * Por quê: o `.vcf` direto sofre de UX inconsistente conforme o
 * browser. Safari iOS abre o Quick Look e mostra "Adicionar
 * contato". Chrome iOS/Android baixa como arquivo, e o user não
 * vê botão de "Salvar".
 *
 * Esta página resolve mostrando preview do cartão + 1 botão GIGANTE
 * "Adicionar aos Contatos" que aponta pro `.vcf`. Funciona em
 * qualquer browser porque o user vê claramente a ação.
 *
 * Também serve como destination shareable: o dono pode mandar
 * `nasaex.com.br/l/<slug>/contato` no WhatsApp e a pessoa vê uma
 * página visual em vez de baixar arquivo sem contexto.
 */

interface Params { slug: string }

export async function generateMetadata({
  params,
}: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const page = await prisma.linnkerPage.findUnique({
    where: { slug },
    select: { title: true, bio: true, avatarUrl: true },
  });
  if (!page) return { title: "Contato" };
  return {
    title: `Salvar contato — ${page.title}`,
    description: page.bio ?? `Adicione ${page.title} aos seus contatos`,
    openGraph: {
      title: `Salvar contato de ${page.title}`,
      description: page.bio ?? undefined,
      images: page.avatarUrl ? [page.avatarUrl] : undefined,
    },
  };
}

export default async function ContatoPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;

  const page = await prisma.linnkerPage.findUnique({
    where: { slug },
    include: {
      organization: { select: { name: true } },
    },
  });

  if (!page || !page.isPublished) notFound();

  const socialLinks = (page.socialLinks as SocialLink[] | null) ?? [];
  const phoneDigits = extractWhatsappPhone(socialLinks);

  // Lê overrides com fallback
  const ov = (page as unknown as {
    vcardOverrides?: {
      firstName?: string | null;
      lastName?: string | null;
      jobTitle?: string | null;
      company?: string | null;
      phone?: string | null;
      email?: string | null;
    } | null;
  }).vcardOverrides ?? null;

  const displayName = ov?.firstName || ov?.lastName
    ? [ov?.firstName, ov?.lastName].filter(Boolean).join(" ")
    : page.title;
  const company = ov?.company ?? page.organization?.name ?? null;
  const jobTitle = ov?.jobTitle ?? null;
  const previewPhone = ov?.phone ?? phoneDigits;

  const vcardUrl = `/api/linnker/${slug}/vcard`;

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-5 py-10"
      style={{ background: page.coverColor }}
    >
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden">
        {/* Header com avatar */}
        <div
          className="h-28 relative"
          style={{ background: page.coverColor, filter: "brightness(0.85)" }}
        >
          <div className="absolute -bottom-12 left-1/2 -translate-x-1/2">
            {page.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={page.avatarUrl}
                alt={displayName}
                className="size-24 rounded-full border-4 border-white object-cover shadow-lg"
              />
            ) : (
              <div className="size-24 rounded-full border-4 border-white bg-zinc-200 flex items-center justify-center text-3xl font-bold text-zinc-500 shadow-lg">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </div>

        {/* Dados */}
        <div className="pt-14 pb-6 px-6 text-center">
          <h1 className="text-xl font-bold text-zinc-900 leading-tight">
            {displayName}
          </h1>
          {jobTitle && (
            <p className="text-sm text-zinc-600 mt-0.5">{jobTitle}</p>
          )}
          {company && (
            <p className="text-sm font-semibold text-indigo-600 mt-1">
              {company}
            </p>
          )}

          {/* Mini-tabela com infos */}
          <div className="mt-5 space-y-2 text-left">
            {previewPhone && (
              <ContactRow
                icon="📱"
                label="WhatsApp"
                value={`+${previewPhone}`}
              />
            )}
            {ov?.email && (
              <ContactRow icon="✉️" label="Email" value={ov.email} />
            )}
            {socialLinks
              .filter((s) => s.platform?.toLowerCase() !== "whatsapp")
              .slice(0, 3)
              .map((s) => (
                <ContactRow
                  key={s.platform}
                  icon="🔗"
                  label={s.platform}
                  value={s.url.replace(/^https?:\/\//, "")}
                />
              ))}
          </div>
        </div>

        {/* CTA gigante */}
        <div className="px-5 pb-6 space-y-2">
          <a
            href={vcardUrl}
            download={`${slug}.vcf`}
            className="block w-full text-center py-4 rounded-2xl font-bold text-white text-base shadow-lg transition-transform active:scale-95"
            style={{ background: "#10b981" }}
          >
            ➕ Adicionar aos Contatos
          </a>
          <a
            href={`/l/${slug}`}
            className="block w-full text-center py-3 text-sm text-zinc-600 hover:text-zinc-900"
          >
            ← Voltar pro perfil
          </a>
        </div>

        {/* Helper text */}
        <div className="px-5 pb-5 text-[11px] text-zinc-500 leading-relaxed text-center">
          Ao clicar, baixa um arquivo <code className="font-mono">.vcf</code>.
          No iPhone abre direto "Adicionar contato". No Android pode
          ser preciso abrir manualmente pelo gerenciador de arquivos.
        </div>
      </div>
    </main>
  );
}

function ContactRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 text-xs px-2 py-1.5 rounded-lg bg-zinc-50">
      <span className="shrink-0 text-base">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
          {label}
        </p>
        <p className="font-mono text-zinc-800 truncate">{value}</p>
      </div>
    </div>
  );
}
