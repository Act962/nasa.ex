// Desenha, num SVG, o mapa da operação de um funil como a disposição automática o monta (spec 0092):
// menu no meio, fluxos dos dois lados, linhas retas. Serve para conferir o resultado de "Organizar"
// sem abrir a tela. Só leitura. Rodar:
//   pnpm tsx --conditions=react-server scripts/render-operation-map.ts <trackingId> <arquivo.svg>
import "./astro-qa/load-env";
import { writeFileSync } from "node:fs";

const [trackingId, outputPath] = process.argv.slice(2);

async function main() {
  const prisma = (await import("../src/lib/prisma")).default;
  const { layoutOperationMap } = await import("../src/features/workflows/lib/operation-map-graph");
  const { CENTER_STACK, LEFT_COLUMN_RIGHT_EDGE, buildAttendanceMap, centerStackHeight, placeAttendance } = await import("../src/features/workflows/lib/operation-map-attendance");
  const { richNodeSize } = await import("../src/features/editor/components/rich/rich-node-types");
  const [workflows, presets] = await Promise.all([
    prisma.workflow.findMany({ where: { trackingId }, select: { id: true, name: true, isActive: true, agentMode: true, folderId: true, nodes: { select: { id: true, type: true, position: true, data: true } }, connections: { select: { id: true, fromNodeId: true, toNodeId: true, fromOutput: true } } } }),
    prisma.aiButtonPreset.findMany({ where: { trackingId }, select: { id: true, name: true, isActive: true, buttons: true } }),
  ]);
  const attendance = buildAttendanceMap({ menus: presets, workflows: workflows as never, scriptMenuName: "Menu inicial do atendimento", hasBookingMenu: true });
  const { groups, centerY } = layoutOperationMap({
    workflows: workflows as never,
    folderOrder: [],
    sizeOfStep: (stepType: string) => richNodeSize(stepType) ?? { width: 64, height: 64 },
    preferredOrder: attendance.linkedWorkflowOrder,
    menuColumns: { right: attendance.rightWorkflowOrder, left: attendance.leftWorkflowOrder, leftColumnRightEdge: LEFT_COLUMN_RIGHT_EDGE, centerStackHeight: centerStackHeight(attendance), centerStackLeft: CENTER_STACK.left, centerStackWidth: CENTER_STACK.width },
  });
  const placed = placeAttendance(attendance, groups, centerY);
  const boxes = [...groups, ...placed.menus, ...(placed.bookingBlock ? [placed.bookingBlock] : []), ...(placed.assistantBlock ? [placed.assistantBlock] : [])];
  const left = Math.min(...boxes.map((box) => box.x)) - 30;
  const top = Math.min(...boxes.map((box) => box.y)) - 30;
  const width = Math.max(...boxes.map((box) => box.x + box.width)) + 30 - left;
  const height = Math.max(...boxes.map((box) => box.y + box.height)) + 30 - top;
  const escapeText = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const parts: string[] = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${left} ${top} ${width} ${height}" width="${Math.round(width / 2)}" height="${Math.round(height / 2)}" font-family="-apple-system,sans-serif"><rect x="${left}" y="${top}" width="${width}" height="${height}" fill="#fff"/>`];
  for (const group of groups) {
    parts.push(`<rect x="${group.x}" y="${group.y}" width="${group.width}" height="${group.height}" rx="24" fill="${group.isActive ? "#eff6ff" : "#f4f4f5"}" stroke="${group.isActive ? "#0b7de3" : "#a1a1aa"}" stroke-width="4" stroke-dasharray="${group.isActive ? "0" : "14 10"}"/><text x="${group.x + 26}" y="${group.y + 46}" font-size="28" font-weight="600">${escapeText(group.name.slice(0, 40))}</text>`);
    for (const step of group.steps) parts.push(`<rect x="${group.x + step.x}" y="${group.y + step.y}" width="${step.width}" height="${step.height}" rx="16" fill="#fff" stroke="#71717a" stroke-width="3"/>`);
  }
  for (const menu of placed.menus) {
    parts.push(`<rect x="${menu.x}" y="${menu.y}" width="${menu.width}" height="${menu.height}" rx="24" fill="#f0fdf4" stroke="#16a34a" stroke-width="4"/><text x="${menu.x + 20}" y="${menu.y + 40}" font-size="21" font-weight="700">${escapeText(menu.name)}</text>`);
    for (const option of menu.options) parts.push(`<rect x="${menu.x + 20}" y="${menu.y + option.centerY - 20}" width="${menu.width - 40}" height="40" rx="12" fill="#fff" stroke="${option.kind === "booking" ? "#16a34a" : "#d4d4d8"}" stroke-width="2"/><text x="${menu.x + 34}" y="${menu.y + option.centerY + 7}" font-size="19">${escapeText(option.title)}</text>`);
  }
  const drawBlock = (box: { x: number; y: number; width: number; height: number } | null, title: string, color: string) => {
    if (box) parts.push(`<rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" rx="24" fill="#fff" stroke="${color}" stroke-width="3" stroke-dasharray="10 8"/><text x="${box.x + 20}" y="${box.y + 44}" font-size="21" font-weight="700">${title}</text>`);
  };
  drawBlock(placed.bookingBlock, "Agendamento por botões", "#16a34a");
  drawBlock(placed.assistantBlock, "Assistente (IA)", "#a1a1aa");
  const menuOf = (menuId: string) => placed.menus.find((menu) => menu.id === menuId)!;
  for (const edge of placed.menuEdges) {
    const menu = menuOf(edge.menuId);
    const option = menu.options.find((candidate) => candidate.id === edge.optionId)!;
    const target = groups.find((group) => group.workflowId === edge.workflowId)!;
    const sourceX = edge.side === "right" ? menu.x + menu.width : menu.x;
    const targetX = edge.side === "right" ? target.x : target.x + target.width;
    parts.push(`<path d="M ${sourceX} ${menu.y + option.centerY} L ${edge.channelX} ${menu.y + option.centerY} L ${edge.channelX} ${target.y + target.height / 2} L ${targetX} ${target.y + target.height / 2}" fill="none" stroke="#0b7de3" stroke-width="5"/>`);
  }
  for (const edge of placed.bookingEdges) {
    const menu = menuOf(edge.menuId);
    const option = menu.options.find((candidate) => candidate.id === edge.optionId)!;
    parts.push(`<path d="M ${menu.x + menu.width} ${menu.y + option.centerY} L ${edge.channelX} ${menu.y + option.centerY} L ${edge.channelX} ${placed.bookingBlock!.y}" fill="none" stroke="#16a34a" stroke-width="5" stroke-dasharray="14 10"/>`);
  }
  writeFileSync(outputPath, `${parts.join("")}</svg>`);
  console.log(`desenhado: ${groups.length} fluxos, ${placed.menus.length} menu(s), ${placed.menuEdges.length + placed.bookingEdges.length} linhas`);
}

main().then(() => process.exit(0)).catch((scriptError) => { console.error(String(scriptError).slice(0, 600)); process.exit(1); });
