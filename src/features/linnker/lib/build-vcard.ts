/**
 * Gerador de vCard 3.0 a partir de uma LinnkerPage.
 *
 * VCARD 3.0 é o formato mais aceito (iOS Contatos, Google
 * Contacts, Outlook). Decidi não ir pra 4.0 pra evitar
 * incompatibilidade no iPhone — alguns campos `KIND:`/`PHOTO:`
 * mudam de comportamento.
 *
 * Inputs vêm do `prisma.linnkerPage.findUnique(...)` com
 * `organization` + `user` + `socialLinks` carregados.
 *
 * Compatibilidade testada:
 *   - iOS Contatos (via "Adicionar contato")
 *   - Android (Google Contacts)
 *   - macOS Contatos
 */

import type { SocialLink } from "./extract-whatsapp-phone";

export interface VCardOverrides {
  /** Sobrescreve first name (default = split do fullName). */
  firstName?: string | null;
  /** Sobrescreve last name (default = split do fullName). */
  lastName?: string | null;
  /** Cargo / função — TITLE no vCard. */
  jobTitle?: string | null;
  /** Sobrescreve nome da empresa (default = organization.name). */
  company?: string | null;
  /** Sobrescreve telefone E.164 sem `+` (default = WhatsApp socialLink). */
  phone?: string | null;
  /** Sobrescreve email (default = User.email). */
  email?: string | null;
  /** Data de aniversário YYYY-MM-DD — BDAY no vCard. */
  birthday?: string | null;
  /** Website pessoal — URL extra (não substitui o linnkerUrl). */
  website?: string | null;
  /** Notas livres — sobrescreve a bio no NOTE. */
  notes?: string | null;
}

export interface BuildVCardInput {
  /** Nome cheio — ex: "Weydson Lima". Será splitado em FN/N. */
  fullName: string;
  /** Nome da empresa (ORG). */
  organizationName?: string;
  /** Email principal (User.email no NASA). */
  email?: string | null;
  /** Phone E.164 sem `+` (ex: "5586999990000"). Vai pro TEL. */
  phoneDigits?: string | null;
  /** URL pública da página Linnker (canônica). */
  linnkerUrl: string;
  /** URL do avatar — vai pro PHOTO. */
  avatarUrl?: string | null;
  /** Bio — vai pro NOTE. */
  bio?: string | null;
  /** Social links — viram X-SOCIALPROFILE entries. */
  socialLinks?: SocialLink[];
  /** Título do contato (opcional, vai pro TITLE). */
  title?: string;
  /** Overrides editáveis pelo dono no editor do Linnker. */
  overrides?: VCardOverrides | null;
}

/**
 * Escape de valores conforme RFC 6350 §3.4 — backslash, vírgula,
 * ponto-e-vírgula, newline.
 */
function escapeVCard(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

/**
 * Split `"Weydson Lima"` → `{ first: "Weydson", last: "Lima" }`.
 * `"Maria das Graças Silva"` → `{ first: "Maria", last: "das Graças Silva" }`.
 * Nome único → vira `first` e `last` fica vazio.
 */
function splitName(full: string): { first: string; last: string } {
  const trimmed = full.trim();
  const space = trimmed.indexOf(" ");
  if (space === -1) return { first: trimmed, last: "" };
  return {
    first: trimmed.slice(0, space).trim(),
    last: trimmed.slice(space + 1).trim(),
  };
}

export function buildVCard(
  input: BuildVCardInput,
  revIso?: string,
): string {
  const ov = input.overrides ?? {};

  // Resolve nome (overrides > split do fullName)
  const split = splitName(input.fullName);
  const first = (ov.firstName ?? split.first) || "";
  const last = (ov.lastName ?? split.last) || "";
  const displayName = (() => {
    if (ov.firstName || ov.lastName) {
      return `${first}${last ? " " + last : ""}`.trim() || input.fullName;
    }
    return input.fullName;
  })();

  // Outros campos com override
  const company = ov.company ?? input.organizationName ?? null;
  const phone = ov.phone ?? input.phoneDigits ?? null;
  const email = ov.email ?? input.email ?? null;
  const jobTitle = ov.jobTitle ?? input.title ?? null;
  const notes = ov.notes ?? input.bio ?? null;
  const extraWebsite = ov.website ?? null;
  const birthday = ov.birthday ?? null;

  const lines: string[] = [];
  lines.push("BEGIN:VCARD");
  lines.push("VERSION:3.0");
  // PRODID identifica o gerador — iOS e Outlook usam pra decidir
  // ícones e fluxo "Adicionar contato". Sem isso, alguns clients
  // tratam como texto puro.
  lines.push("PRODID:-//NASA.ex//Linnker vCard//PT");

  // FN é display name. N é estruturado: LastName;FirstName;MiddleName;Prefix;Suffix
  lines.push(`FN:${escapeVCard(displayName)}`);
  lines.push(`N:${escapeVCard(last)};${escapeVCard(first)};;;`);

  if (company) {
    lines.push(`ORG:${escapeVCard(company)}`);
  }

  if (jobTitle) {
    lines.push(`TITLE:${escapeVCard(jobTitle)}`);
  }

  if (phone) {
    // E.164 com `+` na frente — formato canônico.
    lines.push(`TEL;TYPE=CELL,VOICE:+${phone}`);
  }

  if (email) {
    lines.push(`EMAIL;TYPE=WORK:${escapeVCard(email)}`);
  }

  if (input.linnkerUrl) {
    lines.push(`URL;TYPE=WORK:${escapeVCard(input.linnkerUrl)}`);
  }

  if (extraWebsite) {
    lines.push(`URL;TYPE=HOME:${escapeVCard(extraWebsite)}`);
  }

  if (birthday) {
    // BDAY no formato ISO (YYYY-MM-DD). iOS Contatos suporta
    // sem zero ano (--MM-DD pra dia/mês sem ano).
    lines.push(`BDAY:${escapeVCard(birthday)}`);
  }

  if (input.avatarUrl) {
    // PHOTO via URL é aceito pelo iOS e Android e evita inline
    // base64 (que infla o tamanho do .vcf).
    lines.push(`PHOTO;VALUE=URL:${escapeVCard(input.avatarUrl)}`);
  }

  if (notes) {
    // NOTE costuma ser texto livre, max ~1000 chars sem quebrar
    // clients antigos.
    lines.push(`NOTE:${escapeVCard(notes.slice(0, 1000))}`);
  }

  // Socials — usar X-SOCIALPROFILE (Apple extension, suportado
  // pelo iOS) com TYPE indicando o nome da plataforma. Skip o
  // WhatsApp porque já está no TEL.
  if (input.socialLinks && Array.isArray(input.socialLinks)) {
    for (const sl of input.socialLinks) {
      if (!sl?.platform || !sl?.url) continue;
      const platform = sl.platform.toLowerCase();
      if (platform === "whatsapp") continue;
      lines.push(`X-SOCIALPROFILE;TYPE=${platform}:${escapeVCard(sl.url)}`);
    }
  }

  // REV — timestamp da última modificação. Ajuda clients a
  // distinguir "atualização" de "novo contato" quando re-importam.
  lines.push(`REV:${revIso ?? "2026-06-05T17:00:00Z"}`);

  lines.push("END:VCARD");

  // RFC 6350 manda CRLF.
  return lines.join("\r\n") + "\r\n";
}
