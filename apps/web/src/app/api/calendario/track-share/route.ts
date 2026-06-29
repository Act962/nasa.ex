import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get("s");
  const to = url.searchParams.get("to");

  if (!token) {
    return NextResponse.json({ error: "missing_token" }, { status: 400 });
  }

  const share = await prisma.publicActionShare.findUnique({
    where: { sharerToken: token },
    select: { id: true, actionId: true, action: { select: { publicSlug: true } } },
  });

  if (!share) {
    return NextResponse.json({ error: "invalid_token" }, { status: 404 });
  }

  await prisma.publicActionShare.update({
    where: { id: share.id },
    data: { clicks: { increment: 1 } },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? url.origin;
  const redirectTo =
    to ||
    (share.action.publicSlug
      ? `${appUrl}/calendario/evento/${share.action.publicSlug}?s=${token}`
      : `${appUrl}/calendario`);

  return NextResponse.redirect(redirectTo);
}
