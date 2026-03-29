import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { proposalId, gateway, amount, description, customerEmail, customerName } = await req.json();

    if (!proposalId || !gateway) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const proposal = await prisma.forgeProposal.findUnique({
      where: { id: proposalId },
      include: { organization: true },
    });
    if (!proposal) return NextResponse.json({ error: "Proposal not found" }, { status: 404 });

    const settings = await prisma.forgeSettings.findUnique({
      where: { organizationId: proposal.organizationId },
    });
    const configs = (settings?.paymentGatewayConfigs ?? {}) as Record<string, Record<string, string>>;
    const gConfig = configs[gateway] ?? {};

    let paymentLink = "";

    switch (gateway) {
      case "ASAAS": {
        const apiKey = gConfig.apiKey ?? "";
        const env = gConfig.env === "sandbox" ? "sandbox" : "www";
        const baseUrl = `https://${env}.asaas.com/api/v3`;

        // 1. Ensure customer exists
        const custSearch = await fetch(`${baseUrl}/customers?email=${encodeURIComponent(customerEmail)}`, {
          headers: { access_token: apiKey },
        });
        const custData = await custSearch.json();
        let customerId = custData?.data?.[0]?.id;

        if (!customerId) {
          const custRes = await fetch(`${baseUrl}/customers`, {
            method: "POST",
            headers: { "Content-Type": "application/json", access_token: apiKey },
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
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
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
        const priceRes = await fetch("https://api.stripe.com/v1/payment_links", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${secretKey}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            "line_items[0][price_data][currency]": "brl",
            "line_items[0][price_data][product_data][name]": description ?? `Proposta #${proposal.number}`,
            "line_items[0][price_data][unit_amount]": String(Math.round(amount * 100)),
            "line_items[0][quantity]": "1",
          }),
        });
        const stripeData = await priceRes.json();
        paymentLink = stripeData.url ?? "";
        break;
      }

      case "MERCADOPAGO": {
        const accessToken = gConfig.accessToken ?? "";
        const prefRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            items: [{ title: description ?? `Proposta #${proposal.number}`, quantity: 1, unit_price: amount, currency_id: "BRL" }],
            payer: { email: customerEmail },
            external_reference: proposal.id,
          }),
        });
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
        return NextResponse.json({ error: `Gateway ${gateway} not supported for auto-generation` }, { status: 400 });
    }

    if (!paymentLink) {
      return NextResponse.json({ error: "Failed to generate payment link from gateway" }, { status: 502 });
    }

    // Save the link to the proposal
    await prisma.forgeProposal.update({
      where: { id: proposalId },
      data: { paymentLink, paymentGateway: gateway as never },
    });

    return NextResponse.json({ ok: true, paymentLink });
  } catch (err) {
    console.error("[forge/generate-payment-link]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
