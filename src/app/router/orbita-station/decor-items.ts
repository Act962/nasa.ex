import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { MAX_ITEMS_PER_STATION, PLACEMENT_PROBLEM_TEXT, createPlacementContext, validatePlacement, type PlacedDecor } from "@/features/orbita-station/layout/decor-placement";
import { ROOM_APP_KEYS, ROOM_KINDS } from "@/features/orbita-station/layout/room-kinds";
import { resolveLayout } from "@/features/orbita-station/layout/station-layout";
import { getUserPermissionsForApps } from "@/features/permissions/server/app-permission";
import prisma from "@/lib/prisma";

// Decoração da estação (spec 0118). Por enquanto todo item é grátis. Os nomes caem em "Ver" (list) e "Editar"
// (place, move, pickUp) na dedução da matriz — de propósito: "add"/"delete" pediriam Criar/Excluir (D-6).

const coordinate = z.number().finite().min(-200).max(200);
const placementInput = { x: coordinate, z: coordinate, quarterTurns: z.number().int().min(0).max(3) };
const itemSelect = { id: true, itemKey: true, x: true, z: true, quarterTurns: true, version: true, updatedAt: true } as const;
const ITEMS_READ_LIMIT = MAX_ITEMS_PER_STATION + 50;

function requireOrganization(organizationId: string | null | undefined) {
  if (!organizationId) throw new ORPCError("FORBIDDEN", { message: "Escolha uma empresa para decorar a estação." });
  return organizationId;
}

/** Estação, itens colocados e as salas abertas para quem grava: tudo que a regra de posição precisa. */
async function loadPlacementState(organizationId: string, userId: string) {
  const [station, permissions] = await Promise.all([
    prisma.orbitaStation.findUnique({ where: { organizationId }, select: { id: true, templateKey: true } }),
    getUserPermissionsForApps(organizationId, userId, ROOM_APP_KEYS),
  ]);
  if (!station) throw new ORPCError("NOT_FOUND", { message: "A estação desta empresa ainda não foi criada." });
  const items = await prisma.orbitaStationItem.findMany({ where: { stationId: station.id }, select: itemSelect, take: ITEMS_READ_LIMIT });
  const layout = resolveLayout(station.templateKey);
  const isRoomOpen = (room: { kind: keyof typeof ROOM_KINDS }) => {
    const accessApp = ROOM_KINDS[room.kind].accessApp;
    return accessApp === null || permissions?.[accessApp]?.canView === true;
  };
  return { station, items, layout, isRoomOpen };
}

function rejectPlacement(problem: keyof typeof PLACEMENT_PROBLEM_TEXT): never {
  throw new ORPCError("BAD_REQUEST", { message: PLACEMENT_PROBLEM_TEXT[problem], data: { problem } });
}

/** Itens da estação da empresa ativa. */
export const listItems = base
  .use(requiredAuthMiddleware)
  .route({ method: "GET", path: "/orbita-station/items", summary: "Itens de decoração da estação 3D" })
  .handler(async ({ context }) => {
    const organizationId = requireOrganization(context.session.activeOrganizationId);
    const station = await prisma.orbitaStation.findUnique({ where: { organizationId }, select: { id: true } });
    if (!station) return { items: [] };
    const items = await prisma.orbitaStationItem.findMany({ where: { stationId: station.id }, select: itemSelect, orderBy: { createdAt: "asc" }, take: ITEMS_READ_LIMIT });
    return { items };
  });

/** Coloca um item novo (RF-2). A mesma `requestKey` devolve o mesmo item, sem duplicar (RF-4). */
export const placeItem = base
  .use(requiredAuthMiddleware)
  .route({ method: "POST", path: "/orbita-station/items", summary: "Coloca um item de decoração na estação 3D" })
  .input(z.object({ requestKey: z.string().uuid(), itemKey: z.string().min(1).max(80), ...placementInput }))
  .handler(async ({ input, context }) => {
    const organizationId = requireOrganization(context.session.activeOrganizationId);
    const existing = await prisma.orbitaStationItem.findUnique({
      where: { organizationId_requestKey: { organizationId, requestKey: input.requestKey } },
      select: itemSelect,
    });
    if (existing) {
      if (existing.itemKey !== input.itemKey) throw new ORPCError("CONFLICT", { message: "Pedido repetido com outro item.", data: { problem: "REQUEST_KEY_REUSED" } });
      return { item: existing };
    }

    const { station, items, layout, isRoomOpen } = await loadPlacementState(organizationId, context.user.id);
    if (items.length >= MAX_ITEMS_PER_STATION) {
      throw new ORPCError("BAD_REQUEST", {
        message: `A estação já tem ${MAX_ITEMS_PER_STATION} itens. Tire algum para colocar outro.`,
        data: { problem: "LIMIT_REACHED" },
      });
    }
    const result = validatePlacement(createPlacementContext(layout, items, isRoomOpen), input);
    if (!result.ok) rejectPlacement(result.problem);

    try {
      const item = await prisma.orbitaStationItem.create({
        data: {
          organizationId,
          stationId: station.id,
          itemKey: input.itemKey,
          requestKey: input.requestKey,
          x: input.x,
          z: input.z,
          quarterTurns: input.quarterTurns,
          createdById: context.user.id,
          updatedById: context.user.id,
        },
        select: itemSelect,
      });
      return { item };
    } catch (error) {
      // Dois envios da mesma chave ao mesmo tempo (CB-1): o segundo devolve o que o primeiro criou.
      if ((error as { code?: string } | null)?.code !== "P2002") throw error;
      const item = await prisma.orbitaStationItem.findUniqueOrThrow({
        where: { organizationId_requestKey: { organizationId, requestKey: input.requestKey } },
        select: itemSelect,
      });
      return { item };
    }
  });

/** Move ou gira um item. Grava só com a versão lida; se alguém mexeu antes, `CONFLICT` com o item atual (D-2). */
export const moveItem = base
  .use(requiredAuthMiddleware)
  .route({ method: "PATCH", path: "/orbita-station/items/{id}", summary: "Move um item de decoração da estação 3D" })
  .input(z.object({ id: z.string().min(1), version: z.number().int().min(0), ...placementInput }))
  .handler(async ({ input, context }) => {
    const organizationId = requireOrganization(context.session.activeOrganizationId);
    const { items, layout, isRoomOpen } = await loadPlacementState(organizationId, context.user.id);
    const current = items.find((item) => item.id === input.id);
    if (!current) throw new ORPCError("NOT_FOUND", { message: "Item não encontrado." });
    const result = validatePlacement(createPlacementContext(layout, items as PlacedDecor[], isRoomOpen), {
      itemKey: current.itemKey,
      x: input.x,
      z: input.z,
      quarterTurns: input.quarterTurns,
      ignoreId: current.id,
    });
    if (!result.ok) rejectPlacement(result.problem);

    const { count } = await prisma.orbitaStationItem.updateMany({
      where: { id: input.id, organizationId, version: input.version },
      data: { x: input.x, z: input.z, quarterTurns: input.quarterTurns, updatedById: context.user.id, version: { increment: 1 } },
    });
    const item = await prisma.orbitaStationItem.findFirst({ where: { id: input.id, organizationId }, select: itemSelect });
    if (!item) throw new ORPCError("NOT_FOUND", { message: "Item não encontrado." });
    if (count === 0) throw new ORPCError("CONFLICT", { message: "Outra pessoa mexeu neste item antes de você.", data: { item } });
    return { item };
  });

/** Tira o item da estação. Grátis, então ele é apagado (RF-8). */
export const pickUpItem = base
  .use(requiredAuthMiddleware)
  .route({ method: "DELETE", path: "/orbita-station/items/{id}", summary: "Tira um item de decoração da estação 3D" })
  .input(z.object({ id: z.string().min(1), version: z.number().int().min(0) }))
  .handler(async ({ input, context }) => {
    const organizationId = requireOrganization(context.session.activeOrganizationId);
    const { count } = await prisma.orbitaStationItem.deleteMany({ where: { id: input.id, organizationId, version: input.version } });
    if (count > 0) return { id: input.id };
    const item = await prisma.orbitaStationItem.findFirst({ where: { id: input.id, organizationId }, select: itemSelect });
    if (!item) throw new ORPCError("NOT_FOUND", { message: "Item não encontrado." });
    throw new ORPCError("CONFLICT", { message: "Outra pessoa mexeu neste item antes de você.", data: { item } });
  });
