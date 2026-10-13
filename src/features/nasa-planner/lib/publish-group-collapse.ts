/** Calendário (spec 0074, RF-14): irmãos do mesmo grupo, no mesmo status e no mesmo dia, viram um cartão só. */

interface CollapsiblePost {
  id: string;
  publishGroupId: string | null;
  status: string;
  scheduledAt: Date | string | null;
  publishedAt: Date | string | null;
}

function toDayKey(post: CollapsiblePost) {
  const rawDate = post.scheduledAt ?? post.publishedAt;
  if (!rawDate) return "sem-data";
  const date = new Date(rawDate);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** `groupPostIds`: os posts que o cartão representa. Arrastar o cartão age só neles, não no grupo inteiro. */
export interface GroupCardFields {
  groupAccountCount: number;
  groupPostIds: string[];
}

export function collapsePublishGroups<Post extends CollapsiblePost>(posts: Post[]): Array<Post & GroupCardFields> {
  const cardKeyOf = (post: Post) => `${post.publishGroupId}|${post.status}|${toDayKey(post)}`;
  const postIdsByCardKey = new Map<string, string[]>();
  for (const post of posts) {
    if (post.publishGroupId) postIdsByCardKey.set(cardKeyOf(post), [...(postIdsByCardKey.get(cardKeyOf(post)) ?? []), post.id]);
  }
  const shownCardKeys = new Set<string>();
  return posts.flatMap((post) => {
    if (!post.publishGroupId) return [{ ...post, groupAccountCount: 1, groupPostIds: [post.id] }];
    const cardKey = cardKeyOf(post);
    if (shownCardKeys.has(cardKey)) return [];
    shownCardKeys.add(cardKey);
    const groupPostIds = postIdsByCardKey.get(cardKey) ?? [post.id];
    return [{ ...post, groupAccountCount: groupPostIds.length, groupPostIds }];
  });
}

/** Entrada de `posts.schedule` para um cartão arrastado: com mais de um post, age nesses posts do grupo e só neles. */
export function toGroupScope(groupPostIds: string[] | undefined) {
  return groupPostIds && groupPostIds.length > 1 ? { scope: "group" as const, groupPostIds } : { scope: "post" as const };
}
