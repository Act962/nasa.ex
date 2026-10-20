// Ordem das etiquetas nas listas curtas (chat e Kanban). Sem `server-only`: roda no navegador.
import { AUTO_TAG_SLUGS } from "../default-org-template";

// Estado do atendimento e agendamento primeiro: são as etiquetas mais novas e ficavam escondidas no "+N".
const STATE_TAG_SLUGS: string[] = [
  AUTO_TAG_SLUGS.awaitingReply,
  AUTO_TAG_SLUGS.inService,
  AUTO_TAG_SLUGS.scheduled,
  AUTO_TAG_SLUGS.cancelled,
  AUTO_TAG_SLUGS.finished,
];

function stateRankOf(slug: string | null | undefined): number {
  const rank = slug ? STATE_TAG_SLUGS.indexOf(slug) : -1;
  return rank === -1 ? STATE_TAG_SLUGS.length : rank;
}

/** Etiquetas de estado na frente; as demais mantêm a ordem em que vieram. */
export function sortStateTagsFirst<TagItem extends { slug?: string | null }>(tags: TagItem[]): TagItem[] {
  return [...tags].sort((first, second) => stateRankOf(first.slug) - stateRankOf(second.slug));
}
