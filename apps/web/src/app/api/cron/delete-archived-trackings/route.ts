import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Find trackings archived more than 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const deletedTrackings = await prisma.tracking.deleteMany({
      where: {
        isArchived: true,
        archivedAt: {
          lte: thirtyDaysAgo,
        },
      },
    });

    return NextResponse.json({
      success: true,
      deletedCount: deletedTrackings.count,
    });
  } catch (error) {
    console.error("Error deleting archived trackings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
