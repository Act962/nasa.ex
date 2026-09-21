import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getPostHogClient } from "@/lib/posthog-server";
import { z } from "zod";

const requestSchema = z.object({
  proposalId: z.string().min(1),
  gateway: z.enum(["STRIPE", "ASAAS", "MERCADOPAGO", "PIX"]),
  description: z.string().trim().max(500).optional(),
  customerEmail: z.string().email().optional().or(z.literal("")),
  customerName: z.string().trim().max(200).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const parsed = requestSchema.safeParse(await req.json());
    if (!parsed.success)
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
        { status: 422 },
      );
    const { proposalId, gateway, description, customerEmail, customerName } =
      parsed.data;

    const proposal = await prisma.forgeProposal.findUnique({
      where: { id: proposalId },
      include: {
        organization: true,
        products: {
          select: { quantity: true, unitValue: true, discount: true },
        },
      },
    });
    if (!proposal)
      return NextResponse.json(
        { error: "Proposta não encontrada." },
        { status: 404 },
      );

    const subtotal = proposal.products.reduce(
      (sum, product) =>
        sum +
        Number(product.quantity) * Number(product.unitValue) -
        Number(product.discount ?? 0),
      0,
    );
    const proposalDiscount = Number(proposal.discount ?? 0);
    const amount =
      proposal.discountType === "PERCENTUAL"
        ? subtotal * (1 - proposalDiscount / 100)
        : subtotal - proposalDiscount;
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        {
          error:
            "A proposta precisa ter um total maior que zero para gerar cobrança.",
        },
        { status: 422 },
      );
    }

    const membership = await prisma.member.findFirst({
      where: {
        organizationId: proposal.organizationId,
        userId: session.user.id,
      },
      select: { id: true },
    });
    if (!membership)
      return NextResponse.json(
        { error: "Você não tem acesso a esta proposta." },
        { status: 403 },
      );

    const settings = await prisma.forgeSettings.findUnique({
      where: { organizationId: proposal.organizationId },
    });
    const configs = (settings?.paymentGatewayConfigs ?? {}) as Record<
      string,
      Record<string, string>
    >;
    const gConfig = configs[gateway] ?? {};

    let paymentLink = "";

    switch (gateway) {
      case "ASAAS": {
        const apiKey = gConfig.apiKey ?? "";
        const env = gConfig.env === "sandbox" ? "sandbox" : "www";
        const baseUrl = `https://${env}.asaas.com/api/v3`;

        // 1. Ensure customer exists
        const custSearch = await fetch(
          `${baseUrl}/customers?email=${encodeURIComponent(customerEmail ?? "")}`,
          {
            headers: { access_token: apiKey },
          },
        );
        const custData = await custSearch.json();
        let customerId = custData?.data?.[0]?.id;

        if (!customerId) {
          const custRes = await fetch(`${baseUrl}/customers`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              access_token: apiKey,
            },
            body: JSON.stringify({ name: customerName, email: customerEmail }),
          });
          const newCust = await custRes.json();
          customerId = newCust.id;
        }

        // 2. Create payment
        const payRes = await fetch(`${baseUrl}/payments`, {
          method: "POST",
          headers: { "Content-Type": "application/json", access_token: apiKey },
          body: JSON.stringify({
            customer: customerId,
            billingType: "UNDEFINED",
            value: amount,
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
              .toISOString()
              .split("T")[0],
            description: description ?? `Proposta #${proposal.number}`,
            externalReference: proposal.id,
          }),
        });
        const payData = await payRes.json();
        paymentLink = payData.invoiceUrl ?? payData.bankSlipUrl ?? "";
        break;
      }

      case "STRIPE": {
        const secretKey = gConfig.secretKey ?? "";
        if (!secretKey.startsWith("sk_")) {
          return NextResponse.json(
            {
              error:
                "Stripe não configurado. Em FORGE → Configurações → Stripe, informe a Secret Key e salve antes de gerar o link.",
            },
            { status: 422 },
          );
        }
        const priceRes = await fetch(
          "https://api.stripe.com/v1/payment_links",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${secretKey}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              "line_items[0][price_data][currency]": "brl",
              "line_items[0][price_data][product_data][name]":
                description ?? `Proposta #${proposal.number}`,
              "line_items[0][price_data][unit_amount]": String(
                Math.round(amount * 100),
              ),
              "line_items[0][quantity]": "1",
            }),
          },
        );
        const stripeData = await priceRes.json();
        if (!priceRes.ok) {
          console.error(
            "[forge/generate-payment-link] Stripe error",
            stripeData,
          );
          return NextResponse.json(
            {
              error:
                stripeData?.error?.message ??
                "O Stripe recusou a criação do link de pagamento.",
            },
            { status: 502 },
          );
        }
        paymentLink = stripeData.url ?? "";
        break;
      }

      case "MERCADOPAGO": {
        const accessToken = gConfig.accessToken ?? "";
        const prefRes = await fetch(
          "https://api.mercadopago.com/checkout/preferences",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              items: [
                {
                  title: description ?? `Proposta #${proposal.number}`,
                  quantity: 1,
                  unit_price: amount,
                  currency_id: "BRL",
                },
              ],
              payer: { email: customerEmail },
              external_reference: proposal.id,
            }),
          },
        );
        const mpData = await prefRes.json();
        paymentLink = mpData.init_point ?? "";
        break;
      }

      case "PIX": {
        // For PIX, return the configured PIX key so the user can create a QR manually
        paymentLink = `pix:${gConfig.pixKey ?? ""}?amount=${amount}&description=${encodeURIComponent(description ?? `Proposta #${proposal.number}`)}`;
        break;
      }

      default:
        return NextResponse.json(
          { error: `Gateway ${gateway} not supported for auto-generation` },
          { status: 400 },
        );
    }

    if (!paymentLink) {
      return NextResponse.json(
        { error: "Failed to generate payment link from gateway" },
        { status: 502 },
      );
    }

    // Save the link to the proposal
    await prisma.forgeProposal.update({
      where: { id: proposalId },
      data: { paymentLink, paymentGateway: gateway as never },
    });

    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: session.user.id,
      event: "forge_payment_link_generated",
      properties: {
        proposal_id: proposalId,
        gateway,
        amount,
        organization_id: proposal.organizationId,
      },
    });
    await posthog.shutdown();

    return NextResponse.json({ ok: true, paymentLink });
  } catch (err) {
    console.error("[forge/generate-payment-link]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
