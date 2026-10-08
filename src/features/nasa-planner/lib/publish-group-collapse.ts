/** Calendário (spec 0074, RF-14): irmãos do mesmo grupo, no mesmo status e no mesmo dia, viram um cartão só. */

interface CollapsiblePost {
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

export function collapsePublishGroups<Post extends CollapsiblePost>(posts: Post[]): Array<Post & { groupAccountCount: number }> {
  const cardKeyOf = (post: Post) => `${post.publishGroupId}|${post.status}|${toDayKey(post)}`;
  const countByCardKey = new Map<string, number>();
  for (const post of posts) {
    if (post.publishGroupId) countByCardKey.set(cardKeyOf(post), (countByCardKey.get(cardKeyOf(post)) ?? 0) + 1);
  }
  const shownCardKeys = new Set<string>();
  return posts.flatMap((post) => {
    if (!post.publishGroupId) return [{ ...post, groupAccountCount: 1 }];
    const cardKey = cardKeyOf(post);
    if (shownCardKeys.has(cardKey)) return [];
    shownCardKeys.add(cardKey);
    return [{ ...post, groupAccountCount: countByCardKey.get(cardKey) ?? 1 }];
  });
}
