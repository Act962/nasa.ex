// Spec 0106: estado de uma importação da carteira do ERP (início, página a página, fim).
import "server-only";
import { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { getNerpConfig } from "@/app/router/nerp/_helpers";
import { listErpCarteira } from "@/http/nerp/erp-carteira";
import {
  EMPTY_IMPORT_REPORT,
  importErpCustomersPage,
  sumImportReports,
  type ImportPageReport,
} from "../lib/import-customers";

export const ERP_CARTEIRA_IMPORT_EVENT = "nerp/erp-carteira.import";
export type ErpCarteiraImportMode = "full" | "refresh";
export type ErpCarteiraImportEvent = { organizationId: string; mode: ErpCarteiraImportMode };

const PAGE_SIZE = 200;
const DAY_MS = 24 * 60 * 60 * 1000;

export type ImportRunSetup = {
  trackingId: string;
  statusId: string;
  cursor: string | null;
  desde: string | null;
  mode: ErpCarteiraImportMode;
};

/**
 * Marca a importação como em andamento. Uma carga completa que caiu no meio
 * retoma do cursor salvo (CB-6); a atualização diária olha um dia para trás da
 * última passada, para não perder o que mudou durante ela.
 */
export async function startImportRun(
  organizationId: string,
  requestedMode: ErpCarteiraImportMode,
): Promise<ImportRunSetup | null> {
  const record = await prisma.erpCarteiraImport.findUnique({ where: { organizationId } });
  if (!record) return null;

  const lastPassAt = record.lastRefreshAt ?? record.lastFullAt;
  const mode: ErpCarteiraImportMode =
    requestedMode === "refresh" && lastPassAt ? "refresh" : "full";
  const isResumingFull = mode === "full" && record.status === "failed" && record.mode === "full";
  const cursor = isResumingFull ? record.cursor : null;
  const desde =
    mode === "refresh" && lastPassAt ? new Date(lastPassAt.getTime() - DAY_MS).toISOString() : null;

  await prisma.erpCarteiraImport.update({
    where: { organizationId },
    data: {
      status: "running",
      mode,
      cursor,
      error: null,
      startedAt: new Date(),
      finishedAt: null,
      ...(isResumingFull ? {} : { report: EMPTY_IMPORT_REPORT }),
    },
  });
  return { trackingId: record.trackingId, statusId: record.statusId, cursor, desde, mode };
}

function readReport(value: Prisma.JsonValue | null): ImportPageReport {
  if (!value || typeof value !== "object" || Array.isArray(value)) return EMPTY_IMPORT_REPORT;
  return { ...EMPTY_IMPORT_REPORT, ...(value as Partial<ImportPageReport>) };
}

export async function importNextPage(
  organizationId: string,
  setup: ImportRunSetup,
  cursor: string | null,
): Promise<{ nextCursor: string | null; report: ImportPageReport }> {
  const { config } = await getNerpConfig(organizationId);
  const syncedAt = new Date();
  const page = await listErpCarteira(config, { cursor, desde: setup.desde, limite: PAGE_SIZE });
  const report = await importErpCustomersPage({
    organizationId,
    trackingId: setup.trackingId,
    statusId: setup.statusId,
    customers: page.clientes,
    syncedAt,
  });

  const record = await prisma.erpCarteiraImport.findUnique({
    where: { organizationId },
    select: { report: true },
  });
  await prisma.erpCarteiraImport.update({
    where: { organizationId },
    data: {
      cursor: page.proximoCursor,
      report: sumImportReports(readReport(record?.report ?? null), report),
    },
  });
  return { nextCursor: page.proximoCursor, report };
}

export async function finishImportRun(organizationId: string, mode: ErpCarteiraImportMode) {
  const finishedAt = new Date();
  await prisma.erpCarteiraImport.update({
    where: { organizationId },
    data: {
      status: "done",
      cursor: null,
      finishedAt,
      ...(mode === "full" ? { lastFullAt: finishedAt } : { lastRefreshAt: finishedAt }),
    },
  });
}

export async function failImportRun(organizationId: string, message: string) {
  await prisma.erpCarteiraImport.updateMany({
    where: { organizationId },
    data: { status: "failed", error: message.slice(0, 500), finishedAt: new Date() },
  });
}
