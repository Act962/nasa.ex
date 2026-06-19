import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/inngest/client";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.FOCUS_NFE_WEBHOOK_SECRET;
  const authorizationHeader = req.headers.get("authorization");

  if (!webhookSecret || authorizationHeader !== webhookSecret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const ref = typeof body.ref === "string" ? body.ref : null;
  if (!ref) {
    return NextResponse.json({ ok: true });
  }

  try {
    await inngest.send({ name: "fiscal/nfse.status-changed", data: { ref } });
  } catch (err) {
    console.error("[focus-nfe/webhook] failed to dispatch inngest event", err);
    return NextResponse.json({ error: "dispatch failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
