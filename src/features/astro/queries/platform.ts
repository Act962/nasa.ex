import "server-only";
import prisma from "@/lib/prisma";
import type { AstroQuery } from "./types";

// Perguntas sobre a própria plataforma respondidas em código: saldo de Stars
// e Apps que o ASTRO ainda não lê. As duas caíam no orquestrador (~23 mil
// tokens) — e, sem acesso ao App, ele respondia vago ou arriscava número.

const starsBalance: AstroQuery = {
  key: "stars.balance",
  app: "stars",
  appKey: "astro",
  matches: (text) =>
    /\b(stars?|estrelas?)\b/.test(text) && /\b(quanto|quantas?|saldo|tenho|temos|restam|sobrou)\b/.test(text),
  run: async ({ ctx }) => {
    const organization = await prisma.organization.findUnique({
      where: { id: ctx.organizationId },
      select: { starsBalance: true, starsBonusBalance: true },
    });
    if (!organization) return null;
    const total = organization.starsBalance + organization.starsBonusBalance;
    return {
      text:
        `Você tem ${total.toLocaleString("pt-BR")} Stars` +
        (organization.starsBonusBalance > 0
          ? ` (${organization.starsBalance.toLocaleString("pt-BR")} do plano e ${organization.starsBonusBalance.toLocaleString("pt-BR")} de bônus).`
          : "."),
    };
  },
};

/** Apps cujos dados o ASTRO ainda não lê. A resposta é o caminho, não um palpite. */
const UNREADABLE_APPS: { pattern: RegExp; appName: string; href: string }[] = [
  { pattern: /\b(instagram|comments?|comentarios?|direct)\b/, appName: "Comments", href: "/comments" },
  { pattern: /\b(campanhas?|disparos?)\b/, appName: "Campanhas", href: "/campanhas" },
  { pattern: /\b(planner|posts?|publicacoes?)\b/, appName: "Planner", href: "/nasa-planner" },
  { pattern: /\b(trafego|anuncios?|meta ads|facebook ads)\b/, appName: "trafeGO", href: "/trafego/painel" },
  { pattern: /\b(cursos?|alunos?|route)\b/, appName: "ÓRBITA Route", href: "/nasa-route" },
];

const QUESTION = /\?|\b(quantos?|quantas?|qual|quais|como|tem|teve|recebeu|recebi)\b/;

const notReadableApp: AstroQuery = {
  key: "apps.not_readable",
  app: "astro",
  appKey: "astro",
  matches: (text) => QUESTION.test(text) && UNREADABLE_APPS.some((app) => app.pattern.test(text)),
  run: async ({ text }) => {
    const app = UNREADABLE_APPS.find((candidate) => candidate.pattern.test(text));
    if (!app) return null;
    return {
      text: `Ainda não consigo ler os dados do ${app.appName} por aqui. Você encontra essa informação em ${app.href}.`,
    };
  },
};

export const PLATFORM_QUERIES: AstroQuery[] = [starsBalance, notReadableApp];
