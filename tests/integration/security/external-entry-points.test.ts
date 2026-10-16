// Spec 0112: a importação do N.A.S.A antigo exige login (S6) e a entrada
// externa de leads valida o corpo e registra quem chama (S7).

import { call } from "@orpc/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as receiveExternalLead } from "@/app/api/external/new-lead/route";
import { newNasaIntegration } from "@/app/router/integrations/new-nasa-total";
import { newNasaIntegrationPartial } from "@/app/router/integrations/new-nasa-partial";
import { createOrganizationWithOwner, createTrackingWithStatuses } from "../support/builders";
import { testPrisma } from "../support/database";
import { procedureContext, signInAs, signOut } from "../support/session";

vi.mock("@/lib/posthog-server", () => ({
  getPostHogClient: () => ({ capture: vi.fn(), shutdown: vi.fn(async () => undefined) }),
}));

const importProcedures = [
  { name: "integrations.newNasa", procedure: newNasaIntegration },
  { name: "integrations.newNasaPartial", procedure: newNasaIntegrationPartial },
] as const;

describe("spec 0112 — importação do N.A.S.A antigo (S6)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(importProcedures)("CA-1: $name sem sessão recusa e não chama o N.A.S.A antigo", async ({ procedure }) => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    signOut();

    await expect(call(procedure, undefined, procedureContext)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each(importProcedures)("CA-2: $name consulta o N.A.S.A antigo com o e-mail da sessão", async ({ procedure }) => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("indisponível", { status: 503, statusText: "Service Unavailable" }));
    const company = await createOrganizationWithOwner();
    signInAs(company);

    await expect(call(procedure, undefined, procedureContext)).rejects.toThrow();

    const requestBody = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body));
    expect(requestBody.email).toBe(company.user.email);
  });
});

function externalLeadRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost:3000/api/external/new-lead", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  }) as never;
}

async function seedFunnel() {
  const company = await createOrganizationWithOwner();
  const { tracking, statuses } = await createTrackingWithStatuses({
    organizationId: company.organization.id,
    name: "Funil do site",
    statusNames: ["Novo"],
  });
  return { company, tracking, status: statuses["Novo"] };
}

describe("spec 0112 — POST /api/external/new-lead (S7)", () => {
  it.each([
    ["sem nome", (ids: { trackingId: string; statusId: string }) => ({ ...ids, phone: "5511912345678" })],
    ["sem tracking", (ids: { trackingId: string; statusId: string }) => ({ statusId: ids.statusId, name: "Ana" })],
    ["JSON quebrado", () => "{nao-e-json"],
  ])("CA-3: corpo inválido (%s) responde 400 e não cria lead", async (_label, buildBody) => {
    const { tracking, status } = await seedFunnel();

    const response = await receiveExternalLead(
      externalLeadRequest(buildBody({ trackingId: tracking.id, statusId: status.id })),
    );

    expect(response.status).toBe(400);
    expect(await testPrisma.lead.count({ where: { trackingId: tracking.id } })).toBe(0);
  });

  it("CA-4: coluna de outro tracking responde 400 e não cria lead", async () => {
    const target = await seedFunnel();
    const other = await seedFunnel();

    const response = await receiveExternalLead(
      externalLeadRequest({ trackingId: target.tracking.id, statusId: other.status.id, name: "Ana" }),
    );

    expect(response.status).toBe(400);
    expect(await testPrisma.lead.count({ where: { trackingId: target.tracking.id } })).toBe(0);
  });

  it("CA-5: envio válido cria o lead e registra a origem da chamada", async () => {
    const { company, tracking, status } = await seedFunnel();

    const response = await receiveExternalLead(
      externalLeadRequest(
        { trackingId: tracking.id, statusId: status.id, name: "Ana", phone: "(11) 91234-5678" },
        { origin: "https://site-do-cliente.com.br", "user-agent": "Mozilla/5.0" },
      ),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    const lead = await testPrisma.lead.findFirstOrThrow({ where: { trackingId: tracking.id } });
    expect(lead).toMatchObject({ name: "Ana", phone: "11912345678", statusId: status.id });

    const arrival = await testPrisma.systemActivityLog.findFirstOrThrow({
      where: { organizationId: company.organization.id, action: "lead.arrived", resourceId: lead.id },
    });
    expect(arrival.metadata).toMatchObject({
      source: "FORM",
      callerOrigin: "https://site-do-cliente.com.br",
      callerUserAgent: "Mozilla/5.0",
    });
  });
});
