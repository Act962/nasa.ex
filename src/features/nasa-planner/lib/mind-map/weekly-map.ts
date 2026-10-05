import { addDays, format } from "date-fns";
import type { NasaPlannerPostType } from "@/generated/prisma/enums";
import { BRANCH_COLORS, ROOT_NODE_ID, childIdsOf, findDayTopic, layoutTree, type MapEdge, type MapNode } from "./map-graph";

/** Planejamento semanal em mapa mental (spec 0068): a semana no centro, um tópico por dia e os posts como cards. */

export const WEEKLY_TEMPLATE = "weekly";
const WEEKDAY_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
/** Ordem do planejamento de conteúdo: segunda a domingo. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const STORY_HOUR = 12;
const DEFAULT_HOUR = 18;

export interface WeeklyPost {
  id: string;
  type: NasaPlannerPostType;
  title: string | null;
  scheduledAt: Date | string | null;
  publishedAt: Date | string | null;
}

export interface WeeklyTheme {
  weekday: number;
  theme: string;
}

export const dayTopicId = (weekday: number) => `day-${weekday}`;
export const postNodeId = (postId: string) => `post-${postId}`;

function postWeekday(post: WeeklyPost) {
  const rawDate = post.scheduledAt ?? post.publishedAt;
  return rawDate ? new Date(rawDate).getDay() : null;
}

function buildPostNode(post: WeeklyPost): MapNode {
  return { id: postNodeId(post.id), type: "postNode", position: { x: 0, y: 0 }, data: { postId: post.id, title: post.title ?? "", format: post.type } };
}

const branchEdge = (source: string, target: string, color: string): MapEdge => ({ id: `e-${source}-${target}`, source, target, type: "custom", data: { color } });

export function weekLabel(weekMonday: Date) {
  return `Semana ${format(weekMonday, "dd/MM")}–${format(addDays(weekMonday, 6), "dd/MM")}`;
}

export function buildWeeklyMap(input: { weekMonday: Date; organizationId: string; posts: WeeklyPost[]; themes: WeeklyTheme[] }) {
  const rootColor = BRANCH_COLORS[2];
  const nodes: MapNode[] = [
    {
      id: ROOT_NODE_ID,
      type: "mindMapRoot",
      position: { x: 0, y: 0 },
      data: { label: weekLabel(input.weekMonday), color: rootColor, weekStartIso: input.weekMonday.toISOString(), organizationId: input.organizationId },
    },
  ];
  const edges: MapEdge[] = [];
  WEEK_ORDER.forEach((weekday, dayIndex) => {
    const color = BRANCH_COLORS[dayIndex % BRANCH_COLORS.length];
    nodes.push({
      id: dayTopicId(weekday),
      type: "topic",
      position: { x: 0, y: 0 },
      data: { label: WEEKDAY_NAMES[weekday], theme: input.themes.find((theme) => theme.weekday === weekday)?.theme ?? null, weekday, color, depth: 1 },
    });
    edges.push(branchEdge(ROOT_NODE_ID, dayTopicId(weekday), color));
    input.posts
      .filter((post) => postWeekday(post) === weekday)
      .sort((first, second) => new Date(first.scheduledAt ?? 0).getTime() - new Date(second.scheduledAt ?? 0).getTime())
      .forEach((post) => {
        nodes.push(buildPostNode(post));
        edges.push(branchEdge(dayTopicId(weekday), postNodeId(post.id), color));
      });
  });
  return { nodes: layoutTree(nodes, edges), edges };
}

/** "Atualizar com o roteiro": acrescenta os posts da semana que ainda não estão no mapa e atualiza o tema dos dias. Nada é apagado. */
export function mergeWeeklyPosts<NodeLike extends MapNode>(nodes: NodeLike[], edges: MapEdge[], posts: WeeklyPost[], themes: WeeklyTheme[]) {
  const existingPostIds = new Set(nodes.map((node) => node.data.postId).filter((postId): postId is string => typeof postId === "string"));
  const addedNodes: MapNode[] = [];
  const addedEdges: MapEdge[] = [];
  for (const post of posts) {
    const weekday = postWeekday(post);
    if (existingPostIds.has(post.id) || weekday === null) continue;
    const dayTopic = nodes.find((node) => node.id === dayTopicId(weekday));
    if (!dayTopic) continue;
    addedNodes.push(buildPostNode(post));
    addedEdges.push(branchEdge(dayTopic.id, postNodeId(post.id), String(dayTopic.data.color ?? BRANCH_COLORS[0])));
  }
  const withThemes = nodes.map((node) => {
    if (node.type !== "topic" || typeof node.data.weekday !== "number") return node;
    const theme = themes.find((candidate) => candidate.weekday === node.data.weekday)?.theme ?? null;
    return theme === (node.data.theme ?? null) ? node : { ...node, data: { ...node.data, theme } };
  });
  return { nodes: [...withThemes, ...(addedNodes as NodeLike[])], edges: [...edges, ...addedEdges], addedCount: addedNodes.length };
}

export interface PendingContent {
  nodeId: string;
  title: string;
  format: NasaPlannerPostType;
  weekday: number;
  dayLabel: string;
  theme: string | null;
  intendedAt: Date;
  /** Links e notas ligados ao card: entram no roteiro como referência. */
  references: string[];
}

/** Cards de conteúdo ainda sem post, dentro de um dia: é o que "Criar conteúdos" transforma em pauta. */
export function listPendingContents(nodes: MapNode[], edges: MapEdge[]): PendingContent[] {
  const root = nodes.find((node) => node.id === ROOT_NODE_ID);
  const weekStartIso = typeof root?.data.weekStartIso === "string" ? root.data.weekStartIso : null;
  if (!weekStartIso) return [];
  const weekMonday = new Date(weekStartIso);
  const nodeById = new Map(nodes.map((node) => [node.id, node] as const));
  const countByWeekday = new Map<number, number>();

  return nodes
    .filter((node) => node.type === "postNode" && !node.data.postId && String(node.data.title ?? "").trim().length > 0)
    .sort((first, second) => first.position.y - second.position.y)
    .flatMap((node): PendingContent[] => {
      const dayTopic = findDayTopic(node.id, nodes, edges);
      if (!dayTopic) return [];
      const weekday = dayTopic.data.weekday as number;
      const format = (node.data.format as NasaPlannerPostType | undefined) ?? "STATIC";
      const sameDayIndex = countByWeekday.get(weekday) ?? 0;
      countByWeekday.set(weekday, sameDayIndex + 1);
      const intendedAt = addDays(weekMonday, (weekday + 6) % 7);
      intendedAt.setHours((format === "STORY" ? STORY_HOUR : DEFAULT_HOUR) + sameDayIndex, 0, 0, 0);
      const references = childIdsOf(node.id, edges)
        .map((childId) => nodeById.get(childId))
        .filter((child): child is MapNode => Boolean(child))
        .map((child) => (child.type === "linkNode" ? `${String(child.data.label ?? "Link")}: ${String(child.data.url ?? "")}` : String(child.data.label ?? "")))
        .filter((reference) => reference.trim().length > 0);
      return [
        {
          nodeId: node.id,
          title: String(node.data.title).trim(),
          format,
          weekday,
          dayLabel: String(dayTopic.data.label ?? WEEKDAY_NAMES[weekday]),
          theme: typeof dayTopic.data.theme === "string" ? dayTopic.data.theme : null,
          intendedAt,
          references,
        },
      ];
    });
}
