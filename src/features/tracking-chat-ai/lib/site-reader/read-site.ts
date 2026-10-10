import "server-only";
import { fetchPublicPage } from "./fetch-page";
import { extractPageLinks, extractPageText, extractPageTitle, type PageLink } from "./html-text";
import { parsePublicSiteUrl, siteKey } from "./safe-address";

const MAX_INNER_PAGES = 7;
const MAX_PAGE_CHARS = 12_000;
/** Mesmo teto que a Auto Inteligência aplica ao que entra no prompt. */
const MAX_SITE_CHARS = 60_000;
const READ_BUDGET_MS = 45_000;

/** Páginas que costumam ter o que um atendimento precisa saber. */
const USEFUL_PAGE_PATTERN =
  /servic|exame|especialidad|tratament|procediment|produt|catalog|plano|preco|valor|tabela|unidade|endereco|localiza|contato|fale|convenio|sobre|quem-somos|empresa|institucional|horario|agend|duvida|faq|perguntas|equipe|corpo-clinico|medic/;
const SKIPPED_PAGE_PATTERN = /login|entrar|carrinho|checkout|cart|minha-conta|wp-admin|wp-login|politica|privacidade|termos|cookie|\.(pdf|jpe?g|png|gif|webp|zip|mp4|docx?|xlsx?)$/;

export interface SitePage {
  url: string;
  title: string;
  text: string;
}

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function chooseInnerPages(links: PageLink[], homeUrl: string): string[] {
  const homeSite = siteKey(new URL(homeUrl).hostname);
  const scoredByUrl = new Map<string, number>();
  for (const link of links) {
    const url = new URL(link.url);
    if (siteKey(url.hostname) !== homeSite) continue;
    url.search = "";
    const cleanUrl = url.toString();
    if (cleanUrl.replace(/\/$/, "") === homeUrl.replace(/\/$/, "")) continue;
    const haystack = normalize(`${url.pathname} ${link.label}`);
    if (SKIPPED_PAGE_PATTERN.test(haystack)) continue;
    const depth = url.pathname.split("/").filter(Boolean).length;
    const score = (USEFUL_PAGE_PATTERN.test(haystack) ? 10 : 0) - depth;
    scoredByUrl.set(cleanUrl, Math.max(score, scoredByUrl.get(cleanUrl) ?? -Infinity));
  }
  return [...scoredByUrl.entries()]
    .filter(([, score]) => score > 0)
    .sort((first, second) => second[1] - first[1])
    .slice(0, MAX_INNER_PAGES)
    .map(([url]) => url);
}

/** Lê a página informada e as páginas internas mais úteis do mesmo site. */
export async function readSite(rawUrl: string): Promise<{ homeUrl: string; pages: SitePage[] }> {
  const startedAt = Date.now();
  const home = await fetchPublicPage(parsePublicSiteUrl(rawUrl).toString());
  const pages: SitePage[] = [
    { url: home.url, title: extractPageTitle(home.html), text: extractPageText(home.html).slice(0, MAX_PAGE_CHARS) },
  ];
  let totalChars = pages[0].text.length;

  const innerUrls = chooseInnerPages(extractPageLinks(home.html, home.url), home.url);
  const innerResults = await Promise.allSettled(
    innerUrls.map(async (innerUrl) => {
      const page = await fetchPublicPage(innerUrl);
      return { url: page.url, title: extractPageTitle(page.html), text: extractPageText(page.html).slice(0, MAX_PAGE_CHARS) };
    }),
  );
  for (const result of innerResults) {
    if (result.status !== "fulfilled" || result.value.text.length < 80) continue;
    if (Date.now() - startedAt > READ_BUDGET_MS || totalChars + result.value.text.length > MAX_SITE_CHARS) break;
    if (pages.some((page) => page.url === result.value.url)) continue;
    totalChars += result.value.text.length;
    pages.push(result.value);
  }
  return { homeUrl: home.url, pages };
}
