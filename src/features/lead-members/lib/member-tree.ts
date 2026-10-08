// Hierarquia dos vinculados de um lead (spec 0076, RF-1): cada vinculado tem
// no máximo um pai, e a árvore é montada a partir de `parentMemberId`.

export const MAX_MEMBER_DEPTH = 6;
export const DEFAULT_MEMBER_LABELS = { singular: "Vinculado", plural: "Vinculados" } as const;

export interface MemberLabels {
  singular: string;
  plural: string;
}

export interface MemberTreeItem {
  id: string;
  parentMemberId: string | null;
}

export type MemberTreeNode<Item extends MemberTreeItem> = Item & { depth: number; children: MemberTreeNode<Item>[] };

export function resolveMemberLabels(labels: { singular?: string | null; plural?: string | null } | null | undefined): MemberLabels {
  return {
    singular: labels?.singular?.trim() || DEFAULT_MEMBER_LABELS.singular,
    plural: labels?.plural?.trim() || DEFAULT_MEMBER_LABELS.plural,
  };
}

/**
 * Monta a árvore na ordem recebida. Vinculado cujo pai não está na lista (foi
 * apagado ou filtrado) vira raiz, para nunca sumir da tela.
 */
export function buildMemberTree<Item extends MemberTreeItem>(members: readonly Item[]): MemberTreeNode<Item>[] {
  const nodeById = new Map<string, MemberTreeNode<Item>>(members.map((member) => [member.id, { ...member, depth: 0, children: [] }]));
  const roots: MemberTreeNode<Item>[] = [];
  for (const node of nodeById.values()) {
    const parent = node.parentMemberId ? nodeById.get(node.parentMemberId) : undefined;
    if (parent && parent.id !== node.id) parent.children.push(node);
    else roots.push(node);
  }
  const assignDepth = (nodes: MemberTreeNode<Item>[], depth: number) => {
    for (const node of nodes) {
      node.depth = depth;
      assignDepth(node.children, depth + 1);
    }
  };
  assignDepth(roots, 0);
  return roots;
}

function collectAncestorIds(members: readonly MemberTreeItem[], startParentId: string | null): string[] {
  const parentById = new Map(members.map((member) => [member.id, member.parentMemberId]));
  const ancestorIds: string[] = [];
  let currentId = startParentId;
  // O limite cobre dados já corrompidos com ciclo: a subida sempre termina.
  while (currentId && ancestorIds.length <= members.length) {
    ancestorIds.push(currentId);
    currentId = parentById.get(currentId) ?? null;
  }
  return ancestorIds;
}

/** Pôr `memberId` abaixo de `nextParentId` fecharia um ciclo? */
export function wouldCreateCycle(members: readonly MemberTreeItem[], memberId: string, nextParentId: string | null): boolean {
  if (!nextParentId) return false;
  return collectAncestorIds(members, nextParentId).includes(memberId);
}

/** Nível em que o vinculado ficaria (1 = ligado direto ao lead). */
export function depthUnderParent(members: readonly MemberTreeItem[], nextParentId: string | null): number {
  return collectAncestorIds(members, nextParentId).length + 1;
}

/** Altura da subárvore do vinculado, contando ele mesmo. */
export function subtreeHeight(members: readonly MemberTreeItem[], memberId: string): number {
  const childHeights = members.filter((member) => member.parentMemberId === memberId && member.id !== memberId).map((child) => subtreeHeight(members, child.id));
  return 1 + (childHeights.length > 0 ? Math.max(...childHeights) : 0);
}
