import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-utils";
import prisma from "@/lib/prisma";

const ASSET_KEY = "popup:banner_patterns";

interface BannerPattern {
  id: string;
  label: string;
  url: string;
}

async function getPatterns(): Promise<BannerPattern[]> {
  const row = await prisma.platformAsset.findUnique({ where: { key: ASSET_KEY } });
  if (!row) return [];
  try { return JSON.parse(row.url) as BannerPattern[]; } catch { return []; }
}

export async function GET() {
  try {
    await requireAdminSession();
    return NextResponse.json(await getPatterns());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdminSession();
    const { id, label, url } = await req.json();
    const patterns = await getPatterns();
    const exists = patterns.findIndex((p) => p.id === id);
    if (exists >= 0) patterns[exists] = { id, label, url };
    else patterns.push({ id, label, url });
    await prisma.platformAsset.upsert({
      where: { key: ASSET_KEY },
      update: { url: JSON.stringify(patterns) },
      create: { key: ASSET_KEY, url: JSON.stringify(patterns) },
    });
    return NextResponse.json(patterns);
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireAdminSession();
    const { id } = await req.json();
    const patterns = (await getPatterns()).filter((p) => p.id !== id);
    await prisma.platformAsset.upsert({
      where: { key: ASSET_KEY },
      update: { url: JSON.stringify(patterns) },
      create: { key: ASSET_KEY, url: JSON.stringify(patterns) },
    });
    return NextResponse.json(patterns);
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
