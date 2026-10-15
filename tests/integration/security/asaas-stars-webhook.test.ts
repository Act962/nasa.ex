import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/payments/asaas/webhook/route";
import {
  createAsaasGateway,
  createOrganizationWithOwner,
  createPendingStarsPayment,
  createStarPackage,
} from "../support/builders";
import { testPrisma } from "../support/database";

const WEBHOOK_TOKEN = "token-do-webhook";
const PACKAGE_STARS = 100;
const PACKAGE_PRICE = 49.9;

async function seedPendingPayment(gatewayOverrides: Parameters<typeof createAsaasGateway>[0] = {}) {
  const { organization, user } = await createOrganizationWithOwner();
  const starPackage = await createStarPackage({ stars: PACKAGE_STARS, priceBrl: PACKAGE_PRICE });
  const gateway = await createAsaasGateway({ webhookSecret: WEBHOOK_TOKEN, ...gatewayOverrides });
  const payment = await createPendingStarsPayment({
    organizationId: organization.id,
    userId: user.id,
    packageId: starPackage.id,
    starsAmount: PACKAGE_STARS,
    amountBrl: PACKAGE_PRICE,
    gatewayId: gateway.id,
  });
  return { organization, payment };
}

function webhookRequest(input: {
  paymentId: string;
  token?: string | null;
  value?: number;
  event?: string;
}) {
  const headers = new Headers({ "content-type": "application/json" });
  if (input.token) headers.set("asaas-access-token", input.token);
  return new NextRequest("http://localhost:3000/api/payments/asaas/webhook", {
    method: "POST",
    headers,
    body: JSON.stringify({
      event: input.event ?? "PAYMENT_CONFIRMED",
      payment: {
        id: "pay_asaas_1",
        status: "CONFIRMED",
        value: input.value ?? PACKAGE_PRICE,
        externalReference: input.paymentId,
      },
    }),
  });
}

async function readState(organizationId: string, paymentId: string) {
  const [organization, payment] = await Promise.all([
    testPrisma.organization.findUniqueOrThrow({ where: { id: organizationId } }),
    testPrisma.starsPayment.findUniqueOrThrow({ where: { id: paymentId } }),
  ]);
  return { starsBalance: organization.starsBalance, paymentStatus: payment.status };
}

describe("spec 0108 — webhook Asaas de recarga de Stars (S1)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("CA-1: com o token do gateway, marca como pago e credita o pacote", async () => {
    const { organization, payment } = await seedPendingPayment();

    const response = await POST(webhookRequest({ paymentId: payment.id, token: WEBHOOK_TOKEN }));

    expect(response.status).toBe(200);
    expect(await readState(organization.id, payment.id)).toEqual({
      starsBalance: PACKAGE_STARS,
      paymentStatus: "paid",
    });
  });

  it.each([
    ["sem header", null],
    ["com token errado", "token-errado"],
  ])("CA-1: %s, recusa com 401 e não credita", async (_caso, token) => {
    const { organization, payment } = await seedPendingPayment();

    const response = await POST(webhookRequest({ paymentId: payment.id, token }));

    expect(response.status).toBe(401);
    expect(await readState(organization.id, payment.id)).toEqual({
      starsBalance: 0,
      paymentStatus: "pending",
    });
  });

  it("CA-1: gateway sem segredo configurado recusa tudo, mesmo com header", async () => {
    const { organization, payment } = await seedPendingPayment({ webhookSecret: null });

    const response = await POST(webhookRequest({ paymentId: payment.id, token: "qualquer" }));

    expect(response.status).toBe(401);
    expect((await readState(organization.id, payment.id)).starsBalance).toBe(0);
  });

  it("CA-1: segredo de gateway inativo não vale", async () => {
    const { organization, payment } = await seedPendingPayment({ isActive: false });

    const response = await POST(webhookRequest({ paymentId: payment.id, token: WEBHOOK_TOKEN }));

    expect(response.status).toBe(401);
    expect((await readState(organization.id, payment.id)).starsBalance).toBe(0);
  });

  it("CA-2: valor pago menor que o da recarga não credita", async () => {
    const { organization, payment } = await seedPendingPayment();

    const response = await POST(
      webhookRequest({ paymentId: payment.id, token: WEBHOOK_TOKEN, value: 1 }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ skipped: "value_mismatch" });
    expect(await readState(organization.id, payment.id)).toEqual({
      starsBalance: 0,
      paymentStatus: "pending",
    });
  });

  it("CB-6: o mesmo pagamento entregue duas vezes credita uma vez só", async () => {
    const { organization, payment } = await seedPendingPayment();

    await POST(webhookRequest({ paymentId: payment.id, token: WEBHOOK_TOKEN }));
    const secondResponse = await POST(
      webhookRequest({ paymentId: payment.id, token: WEBHOOK_TOKEN, event: "PAYMENT_RECEIVED" }),
    );

    expect(await secondResponse.json()).toMatchObject({ alreadyProcessed: true });
    expect((await readState(organization.id, payment.id)).starsBalance).toBe(PACKAGE_STARS);
  });

  it("CB-6: duas entregas simultâneas creditam uma vez só", async () => {
    const { organization, payment } = await seedPendingPayment();

    await Promise.all([
      POST(webhookRequest({ paymentId: payment.id, token: WEBHOOK_TOKEN })),
      POST(webhookRequest({ paymentId: payment.id, token: WEBHOOK_TOKEN, event: "PAYMENT_RECEIVED" })),
    ]);

    expect((await readState(organization.id, payment.id)).starsBalance).toBe(PACKAGE_STARS);
  });

  it("RF-8: no modo log-only, chamada sem token ainda é processada", async () => {
    vi.stubEnv("ASAAS_STARS_WEBHOOK_AUTH_MODE", "log-only");
    const { organization, payment } = await seedPendingPayment();

    const response = await POST(webhookRequest({ paymentId: payment.id, token: null }));

    expect(response.status).toBe(200);
    expect((await readState(organization.id, payment.id)).starsBalance).toBe(PACKAGE_STARS);
  });

  it("evento que não é de pagamento confirmado é ignorado", async () => {
    const { organization, payment } = await seedPendingPayment();

    const response = await POST(
      webhookRequest({ paymentId: payment.id, token: WEBHOOK_TOKEN, event: "PAYMENT_OVERDUE" }),
    );

    expect(await response.json()).toMatchObject({ skipped: true });
    expect((await readState(organization.id, payment.id)).paymentStatus).toBe("pending");
  });
});
