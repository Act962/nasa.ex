import type { Metadata } from "next";
import { OrbitaLegalPage } from "@/features/legal/components/orbita-legal-page";
import { CookiePreferencesPanel } from "@/features/legal/components/cookie-preferences-panel";
import {
  ORBITA_COOKIES,
  ORBITA_COOKIE_CATEGORY_LABELS,
  type OrbitaCookieCategory,
} from "@/features/legal/lib/orbita-cookies";

export const metadata: Metadata = {
  title: "Política de Cookies — Órbita Hub",
  description: "Quais cookies o Órbita Hub usa, para quê, por quanto tempo e como mudar sua escolha.",
};

const STORAGE_LABELS = {
  cookie: "cookie",
  localStorage: "armazenamento local",
  sessionStorage: "armazenamento da aba",
} as const;

const CATEGORY_EXPLANATIONS: Record<OrbitaCookieCategory, string> = {
  necessary: "Sem eles a plataforma não funciona: login, segurança e registro das suas escolhas. Não dependem de consentimento.",
  analytics: "Mostram como a plataforma é usada e ajudam a encontrar erros. Só são ativados se você aceitar.",
  advertising: "Medem campanhas de divulgação do Órbita. Só são ativados se você aceitar.",
  personalization: "Lembram preferências para adaptar conteúdo e sugestões. Só são ativados se você aceitar.",
};

export default function OrbitaCookiesPage() {
  const categoriesInUse = (Object.keys(ORBITA_COOKIE_CATEGORY_LABELS) as OrbitaCookieCategory[]).filter(
    (category) => ORBITA_COOKIES.some((cookie) => cookie.category === category),
  );

  return (
    <OrbitaLegalPage
      title="Política de Cookies"
      intro="Cookies são pequenos arquivos que o site guarda no seu navegador. Esta página lista todos os que o Órbita Hub usa — a lista é gerada a partir do registro de cookies da própria plataforma — e permite mudar sua escolha a qualquer momento."
      sections={[
        ...categoriesInUse.map((category) => ({
          title: ORBITA_COOKIE_CATEGORY_LABELS[category],
          paragraphs: [CATEGORY_EXPLANATIONS[category]],
          bullets: ORBITA_COOKIES.filter((cookie) => cookie.category === category).map(
            (cookie) =>
              `${cookie.name} (${STORAGE_LABELS[cookie.storage]}, ${cookie.provider}) — ${cookie.purpose} Duração: ${cookie.duration}.`,
          ),
        })),
        {
          title: "Cookies de páginas e formulários dos clientes",
          paragraphs: [
            "Páginas, formulários e links criados por empresas clientes no Órbita podem incluir pixels e ferramentas de análise escolhidos por elas (como Meta Pixel ou Google Analytics). Esses cookies são de responsabilidade da empresa que publicou a página.",
          ],
        },
        {
          title: "Como mudar sua escolha",
          paragraphs: [
            "Use o painel no início desta página ou o cartão de privacidade no chat do ASTRO. Você também pode apagar ou bloquear cookies nas configurações do navegador — bloquear os necessários pode impedir o login.",
          ],
        },
      ]}
    >
      <CookiePreferencesPanel />
    </OrbitaLegalPage>
  );
}
