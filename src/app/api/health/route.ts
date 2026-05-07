import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("db timeout")), 2000),
      ),
    ]);
    return Response.json({ status: "ok" }, { status: 200 });
  } catch {
    return Response.json({ status: "degraded" }, { status: 503 });
  }
}
