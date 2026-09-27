/**
 * Seletores que o cartão do ASTRO mostra no lugar de "digite o nome" ou
 * "digite a data" (spec 0033, RF-1 e RF-3). Sem `server-only`: o servidor
 * descreve o seletor e o widget o desenha.
 *
 * A resposta volta como mensagem normal, com o id do registro escolhido no
 * fim ("Maria Clara [ref:cm…]"). Assim o ciclo guiado segue igual, e o
 * servidor resolve pelo id — homônimo ou nome com erro deixam de existir.
 */

export type AstroSearchEntity =
  | "lead"
  | "agenda"
  | "tracking"
  | "proposal"
  | "product"
  | "payment_entry"
  | "workspace"
  | "member"
  | "form"
  | "appointment";

export type AstroPicker =
  | {
      kind: "entity";
      entity: AstroSearchEntity;
      placeholder?: string;
      /** Saída sem registro, ex.: "Sem lead (compromisso interno)". */
      noneOption?: { label: string; answer: string };
      /** Vários de uma vez, com quantidade (produtos da proposta). */
      multiple?: boolean;
    }
  | {
      kind: "datetime";
      /** Dia já entendido (ISO), para o seletor abrir nele. */
      suggestedIso?: string;
      /** "time" quando o dia já está certo e falta só a hora; "date" sem horário (vencimento). */
      mode: "datetime" | "time" | "date";
      /** Aceita dia que já passou (conta vencida). */
      allowPast?: boolean;
      /** Campo opcional: botão que dispensa, ex.: "Sem prazo". */
      skipOption?: { label: string; answer: string };
    }
  /** Texto curto, já preenchido com a sugestão do ASTRO (ex.: título). */
  | {
      kind: "text";
      suggestion?: string;
      placeholder?: string;
      maxLength?: number;
      /** Campo opcional: botão que dispensa, ex.: "Sem telefone". */
      skipOption?: { label: string; answer: string };
    }
  /** Opções fixas, sem busca (ex.: Online ou Presencial). */
  | { kind: "select"; options: { label: string; answer: string }[] };

const PICKED_REF = /\s*\[ref:([a-z0-9]{10,})\]\s*$/i;

export function buildPickedAnswer(label: string, id: string): string {
  return `${label} [ref:${id}]`;
}

/** Separa o que o usuário vê do id escolhido no seletor. */
export function parsePickedAnswer(text: string): { label: string; id?: string } {
  const match = text.match(PICKED_REF);
  if (!match) return { label: text.trim() };
  return { label: text.slice(0, match.index).trim(), id: match[1] };
}

/** "26/09/2026 às 13:00" — formato que `parseDateTime` lê sem ambiguidade. */
export function formatPickedDateTime(date: string, time: string): string {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year} às ${time}`;
}

/** "2 Setup [ref:…], 1 Consultoria [ref:…]" — o formato que `splitProductRequests` lê. */
export function buildPickedList(items: { label: string; id: string; quantity: number }[]): string {
  return items.map((item) => `${item.quantity} ${buildPickedAnswer(item.label, item.id)}`).join(", ");
}

/** "05/10/2026" — vencimento sem horário, no formato que `parseWhen` lê. */
export function formatPickedDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}
