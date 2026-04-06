import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-utils";
import prisma from "@/lib/prisma";

export async function GET() {
  await requireAdminSession();

  const rows = await prisma.platformAsset.findMany({
    where: { key: { startsWith: "popup:mascot:" } },
  });

  const mascots = rows.map((r, i) => ({
    key: r.key,
    url: r.url,
    label: `Mascote ${i + 1}`,
  }));

  return NextResponse.json(mascots);
}
