import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { verifyVoiceCallToken } from "@/features/astro/server/voice/voice-call-token";
import { chargeVoiceMinute } from "@/features/astro/server/voice/charge-voice-minute";

/** Batimento de minuto da chamada de voz: cobra o minuto seguinte e diz se a chamada continua (spec 0054, D-4). */

export const runtime = "nodejs";

const heartbeatSchema = z.object({
  callToken: z.string().min(10),
  minuteNumber: z.number().int().min(2).max(20),
});

export async function POST(request: Request) {
  const sessionData = await auth.api.getSession({ headers: await headers() });
  if (!sessionData?.user) {
    return NextResponse.json({ action: "stop", reason: "UNAUTHORIZED" }, { status: 401 });
  }

  const payload = heartbeatSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ action: "stop", reason: "INVALID" }, { status: 400 });
  }

  const claims = verifyVoiceCallToken(payload.data.callToken);
  if (!claims || claims.userId !== sessionData.user.id) {
    return NextResponse.json({ action: "stop", reason: "CALL_EXPIRED" });
  }
  if (claims.isOwnKey) {
    return NextResponse.json({ action: "continue" });
  }

  const { hasBalance } = await chargeVoiceMinute({
    organizationId: claims.organizationId,
    userId: claims.userId,
    voiceCallId: claims.voiceCallId,
    minuteNumber: payload.data.minuteNumber,
  });
  return NextResponse.json(hasBalance ? { action: "continue" } : { action: "stop", reason: "NO_BALANCE" });
}
