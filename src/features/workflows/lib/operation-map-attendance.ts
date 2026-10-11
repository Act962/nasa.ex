// O menu do atendimento no mapa da operação (spec 0092, ajuste de 2026-10-11). Os fluxos de um funil
// costumam começar por uma tag que uma opção de menu aplica: sem isso desenhado, os retângulos parecem
// soltos. Função pura: recebe os menus salvos e os fluxos e devolve os retângulos e as ligações.

export interface MapMenuInput {
  id: string;
  name: string;
  isActive: boolean;
  /** Opções do menu salvo: `{ id, text, tagId? }`. Vem do banco como JSON livre. */
  buttons: unknown;
}

export interface MapFlowForTags {
  id: string;
  nodes: { type: string; data: unknown }[];
}

export type MenuOptionKind = "tag" | "booking" | "plain";

export interface MapMenuOption {
  id: string;
  title: string;
  kind: MenuOptionKind;
  /** Centro da linha, medido do topo do retângulo do menu: é onde a ligação sai. */
  centerY: number;
}

export interface MapMenuBox {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  options: MapMenuOption[];
}

export interface AttendanceMap {
  menus: MapMenuBox[];
  /** Opção de menu → fluxo que começa pela tag que ela aplica. */
  menuLinks: { menuId: string; optionId: string; workflowId: string }[];
  /** Opção resolvida pelo menu de botões de agendamento, que não é fluxo. */
  bookingLinks: { menuId: string; optionId: string }[];
  /** Fluxo que aplica uma tag → fluxo que começa por ela. */
  tagLinks: { fromWorkflowId: string; toWorkflowId: string }[];
  bookingBlock: { x: number; y: number; width: number; height: number } | null;
  /** Fluxos ligados a um menu, na ordem das opções. */
  linkedWorkflowOrder: string[];
  /** Os mesmos fluxos, repartidos pelos dois lados do menu (alternados, para as duas colunas ficarem da mesma altura). */
  rightWorkflowOrder: string[];
  leftWorkflowOrder: string[];
}

export const ATTENDANCE_LAYOUT = {
  menuWidth: 320,
  headerHeight: 74,
  rowHeight: 40,
  rowGap: 10,
  padding: 20,
  /** Espaço entre a coluna dos menus e os fluxos, por onde passam as ligações. */
  columnGap: 220,
  menuGap: 56,
  blockHeight: 104,
} as const;

const SINGLE_COLUMN_MAX = 3;

/** Linhas que o código acrescenta ao menu do roteiro quando o funil marca por botões (ids do menu de agendamento). */
const BOOKING_ROWS = [
  { id: "cli:book", title: "Agendar consulta" },
  { id: "cli:mine", title: "Meus horários" },
];

type Fields = Record<string, unknown>;

function asFields(value: unknown): Fields {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Fields) : {};
}

function stringsOf(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
}

/** Tags que fazem o fluxo começar (gatilho "Lead recebeu tag"). */
export function triggerTagIds(flow: MapFlowForTags): string[] {
  return flow.nodes.filter((node) => node.type === "LEAD_TAGGED").flatMap((node) => stringsOf(asFields(asFields(node.data).action).tagIds));
}

/** Tags que o fluxo aplica no lead (passo "Tag" em modo adicionar). */
export function appliedTagIds(flow: MapFlowForTags): string[] {
  return flow.nodes
    .filter((node) => node.type === "TAG")
    .flatMap((node) => {
      const action = asFields(asFields(node.data).action);
      return action.type === "REMOVE" ? [] : stringsOf(action.tagsIds);
    });
}

function readMenuOptions(buttons: unknown): { id: string; title: string; tagId: string | null }[] {
  if (!Array.isArray(buttons)) return [];
  return buttons.flatMap((button) => {
    const fields = asFields(button);
    const title = typeof fields.text === "string" ? fields.text : typeof fields.title === "string" ? fields.title : "";
    if (typeof fields.id !== "string" || !title) return [];
    return [{ id: fields.id, title, tagId: typeof fields.tagId === "string" && fields.tagId ? fields.tagId : null }];
  });
}

export function buildAttendanceMap(params: {
  menus: MapMenuInput[];
  workflows: MapFlowForTags[];
  /** Nome do menu inicial do roteiro: é nele que entram as linhas de agendamento. */
  scriptMenuName: string;
  /** O funil marca por botões (menu de botões ligado e agenda disponível). */
  hasBookingMenu: boolean;
}): AttendanceMap {
  const flowsByTriggerTag = new Map<string, string[]>();
  for (const flow of params.workflows) {
    for (const tagId of triggerTagIds(flow)) flowsByTriggerTag.set(tagId, [...(flowsByTriggerTag.get(tagId) ?? []), flow.id]);
  }

  const menus: MapMenuBox[] = [];
  const menuLinks: AttendanceMap["menuLinks"] = [];
  const bookingLinks: AttendanceMap["bookingLinks"] = [];
  const linkedWorkflowOrder: string[] = [];
  const layout = ATTENDANCE_LAYOUT;
  const menuX = -(layout.menuWidth + layout.columnGap);
  let cursorY = 0;

  for (const menu of params.menus.filter((candidate) => candidate.isActive)) {
    const storedOptions = readMenuOptions(menu.buttons);
    const isScriptMenu = menu.name === params.scriptMenuName;
    const leadsToFlow = storedOptions.some((option) => option.tagId && flowsByTriggerTag.has(option.tagId));
    // Menu que não leva a fluxo nenhum não entra: o mapa é dos fluxos, não um espelho da aba de Botões.
    if (!leadsToFlow && !isScriptMenu) continue;

    const rows = [
      ...storedOptions.map((option) => ({ ...option, kind: (option.tagId && flowsByTriggerTag.has(option.tagId) ? "tag" : "plain") as MenuOptionKind })),
      ...(isScriptMenu && params.hasBookingMenu ? BOOKING_ROWS.map((row) => ({ ...row, tagId: null, kind: "booking" as MenuOptionKind })) : []),
    ];
    if (rows.length === 0) continue;

    const options = rows.map((row, rowIndex) => ({
      id: row.id,
      title: row.title,
      kind: row.kind,
      centerY: layout.headerHeight + rowIndex * (layout.rowHeight + layout.rowGap) + layout.rowHeight / 2,
    }));
    const height = layout.headerHeight + rows.length * (layout.rowHeight + layout.rowGap) - layout.rowGap + layout.padding;
    menus.push({ id: menu.id, name: menu.name, x: menuX, y: cursorY, width: layout.menuWidth, height, options });
    cursorY += height + layout.menuGap;

    for (const row of rows) {
      if (row.kind === "booking") bookingLinks.push({ menuId: menu.id, optionId: row.id });
      if (row.kind !== "tag" || !row.tagId) continue;
      for (const workflowId of flowsByTriggerTag.get(row.tagId) ?? []) {
        menuLinks.push({ menuId: menu.id, optionId: row.id, workflowId });
        if (!linkedWorkflowOrder.includes(workflowId)) linkedWorkflowOrder.push(workflowId);
      }
    }
  }

  const tagLinks: AttendanceMap["tagLinks"] = [];
  for (const flow of params.workflows) {
    for (const tagId of new Set(appliedTagIds(flow))) {
      for (const targetWorkflowId of flowsByTriggerTag.get(tagId) ?? []) {
        const isRepeated = tagLinks.some((link) => link.fromWorkflowId === flow.id && link.toWorkflowId === targetWorkflowId);
        if (targetWorkflowId !== flow.id && !isRepeated) tagLinks.push({ fromWorkflowId: flow.id, toWorkflowId: targetWorkflowId });
      }
    }
  }

  return {
    menus,
    menuLinks,
    bookingLinks,
    tagLinks,
    bookingBlock: bookingLinks.length > 0 ? { x: menuX, y: cursorY, width: layout.menuWidth, height: layout.blockHeight } : null,
    linkedWorkflowOrder,
    // Até três fluxos cabem de um lado só; a partir daí, um para cada lado.
    rightWorkflowOrder: linkedWorkflowOrder.length <= SINGLE_COLUMN_MAX ? linkedWorkflowOrder : linkedWorkflowOrder.filter((_workflowId, orderIndex) => orderIndex % 2 === 0),
    leftWorkflowOrder: linkedWorkflowOrder.length <= SINGLE_COLUMN_MAX ? [] : linkedWorkflowOrder.filter((_workflowId, orderIndex) => orderIndex % 2 === 1),
  };
}

interface PlacedBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type MenuSide = "left" | "right";

export interface PlacedAttendance {
  menus: MapMenuBox[];
  bookingBlock: PlacedBox | null;
  assistantBlock: PlacedBox | null;
  /** Uma por opção ligada a um fluxo. `channelX` é a coluna onde a linha faz a curva em ângulo reto. */
  menuEdges: { menuId: string; optionId: string; workflowId: string; side: MenuSide; channelX: number }[];
  /** Opções de agendamento: a linha sai pela direita e desce reta até o bloco, logo abaixo do menu. */
  bookingEdges: { menuId: string; optionId: string; channelX: number }[];
}

const CHANNEL_START = 30;
const CHANNEL_SLOT = 16;
/** As linhas de agendamento descem coladas ao menu, por dentro da largura do bloco de agendamento. */
const BOOKING_CHANNEL_START = 16;
const BOOKING_CHANNEL_SLOT = 14;

const BLOCK_GAP = 48;
/** O bloco de agendamento avança para a direita do menu, para a linha descer reta até o topo dele. */
const BOOKING_BLOCK_SHIFT = 44;
/** Onde começam as faixas dos fluxos à direita quando há bloco de agendamento: com folga da borda dele. */
const RIGHT_START_AFTER_BOOKING = BOOKING_BLOCK_SHIFT + 26;
const ASSISTANT_BLOCK_HEIGHT = 96;

/** Borda direita da coluna de fluxos que fica à esquerda do menu. */
export const LEFT_COLUMN_RIGHT_EDGE = -(ATTENDANCE_LAYOUT.menuWidth + ATTENDANCE_LAYOUT.columnGap * 2);

/** Faixa horizontal do que fica no meio: o menu, mais o avanço do bloco de agendamento para a direita. */
export const CENTER_STACK = {
  left: -(ATTENDANCE_LAYOUT.menuWidth + ATTENDANCE_LAYOUT.columnGap),
  width: ATTENDANCE_LAYOUT.menuWidth + BOOKING_BLOCK_SHIFT,
} as const;

/** Altura do que fica no meio, entre as duas colunas: menus, bloco de agendamento e bloco da assistente. */
export function centerStackHeight(attendance: AttendanceMap): number {
  if (attendance.menus.length === 0) return 0;
  const menusHeight = attendance.menus.reduce((total, menu) => total + menu.height, 0) + (attendance.menus.length - 1) * ATTENDANCE_LAYOUT.menuGap;
  return menusHeight + (attendance.bookingBlock ? BLOCK_GAP + attendance.bookingBlock.height : 0) + (attendance.linkedWorkflowOrder.length > 0 ? BLOCK_GAP + ASSISTANT_BLOCK_HEIGHT : 0);
}

/**
 * Posiciona o menu e os blocos entre as duas colunas de fluxos e escolhe por onde cada linha passa.
 * As linhas são sempre retas (horizontal, vertical, horizontal) e não se cruzam: de cada lado, quem
 * sobe e quem desce usa faixas diferentes do corredor, na ordem que evita cruzamento.
 */
export function placeAttendance(attendance: AttendanceMap, groups: (PlacedBox & { workflowId: string })[], centerY: number): PlacedAttendance {
  const groupById = new Map(groups.map((group) => [group.workflowId, group]));
  const linkedGroups = attendance.linkedWorkflowOrder.flatMap((workflowId) => (groupById.has(workflowId) ? [groupById.get(workflowId)!] : []));

  // Tudo o que fica no meio é centrado na altura das colunas (`centerY`): é o que deixa as linhas curtas.
  // É o mesmo espaço que a disposição dos fluxos reserva, então nenhum fluxo cai em cima do menu.
  const menuX = CENTER_STACK.left;
  let cursorY = centerY - centerStackHeight(attendance) / 2;
  const menus = attendance.menus.map((menu, menuIndex) => {
    const placedMenu = { ...menu, x: menuX, y: cursorY };
    cursorY += menu.height + (menuIndex < attendance.menus.length - 1 ? ATTENDANCE_LAYOUT.menuGap : 0);
    return placedMenu;
  });
  const menuRight = menuX + ATTENDANCE_LAYOUT.menuWidth;
  const bookingBlock = attendance.bookingBlock ? { x: menuX + BOOKING_BLOCK_SHIFT, y: cursorY + BLOCK_GAP, width: ATTENDANCE_LAYOUT.menuWidth, height: attendance.bookingBlock.height } : null;
  if (bookingBlock) cursorY = bookingBlock.y + bookingBlock.height;
  const assistantBlock = linkedGroups.length > 0 ? { x: menuX, y: cursorY + BLOCK_GAP, width: ATTENDANCE_LAYOUT.menuWidth, height: ASSISTANT_BLOCK_HEIGHT } : null;

  const sideOf = (workflowId: string): MenuSide => (attendance.leftWorkflowOrder.includes(workflowId) ? "left" : "right");
  const rawEdges = attendance.menuLinks.flatMap((link) => {
    const menu = menus.find((candidate) => candidate.id === link.menuId);
    const option = menu?.options.find((candidate) => candidate.id === link.optionId);
    const target = groupById.get(link.workflowId);
    if (!menu || !option || !target) return [];
    return [{ ...link, side: sideOf(link.workflowId), sourceY: menu.y + option.centerY, targetY: target.y + target.height / 2 }];
  });
  const slotOf = new Map<string, number>();
  for (const side of ["left", "right"] as const) {
    const sideEdges = rawEdges.filter((edge) => edge.side === side);
    // Quem sobe: a opção mais alta faz a curva mais perto do menu. Quem desce: a mais baixa.
    const rising = sideEdges.filter((edge) => edge.targetY < edge.sourceY - 1).sort((first, second) => first.sourceY - second.sourceY);
    const falling = sideEdges.filter((edge) => edge.targetY > edge.sourceY + 1).sort((first, second) => second.sourceY - first.sourceY);
    rising.forEach((edge, slotIndex) => slotOf.set(`${edge.optionId}:${edge.workflowId}`, slotIndex));
    falling.forEach((edge, slotIndex) => slotOf.set(`${edge.optionId}:${edge.workflowId}`, slotIndex));
  }
  // À direita, as faixas mais próximas do menu são das linhas de agendamento, que descem até o bloco.
  const rightStart = bookingBlock ? RIGHT_START_AFTER_BOOKING : CHANNEL_START;
  const menuEdges = rawEdges.map((edge) => {
    const offset = (edge.side === "right" ? rightStart : CHANNEL_START) + (slotOf.get(`${edge.optionId}:${edge.workflowId}`) ?? 0) * CHANNEL_SLOT;
    return { menuId: edge.menuId, optionId: edge.optionId, workflowId: edge.workflowId, side: edge.side, channelX: edge.side === "right" ? menuRight + offset : menuX - offset };
  });

  // A opção de agendamento mais alta desce mais longe do menu, para a de baixo não cruzar a linha dela.
  const bookingEdges = bookingBlock
    ? attendance.bookingLinks.map((link, linkIndex) => ({ menuId: link.menuId, optionId: link.optionId, channelX: menuRight + BOOKING_CHANNEL_START + (attendance.bookingLinks.length - 1 - linkIndex) * BOOKING_CHANNEL_SLOT }))
    : [];

  return { menus, bookingBlock, assistantBlock, menuEdges, bookingEdges };
}
