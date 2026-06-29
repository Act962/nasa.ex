import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

export async function GET(req: NextRequest) {
  const existing = req.cookies.get("vid")?.value;
  const response = NextResponse.json({ ok: true, vid: existing ?? null });

  if (!existing) {
    const vid = randomUUID();
    response.cookies.set("vid", vid, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      secure: process.env.NODE_ENV === "production",
    });
    return NextResponse.json({ ok: true, vid }, { headers: response.headers });
  }

  return response;
}
