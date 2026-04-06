import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-utils";
import prisma from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminSession();

    const { id } = await params;
    const body = await req.json();

    const template = await prisma.achievementPopupTemplate.update({
      where: { id },
      data: {
        name: body.name,
        type: body.type,
        title: body.title,
        message: body.message,
        primaryColor: body.primaryColor,
        accentColor: body.accentColor,
        backgroundColor: body.backgroundColor,
        textColor: body.textColor,
        iconUrl: body.iconUrl,
        enableConfetti: body.enableConfetti,
        enableSound: body.enableSound,
        dismissDuration: body.dismissDuration,
        customJson: body.customJson ?? {},
      },
    });

    return NextResponse.json(template);
  } catch (error) {
    console.error("Error updating popup template:", error);
    return NextResponse.json({ error: "Failed to update template" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminSession();

    const { id } = await params;

    await prisma.achievementPopupTemplate.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting popup template:", error);
    return NextResponse.json({ error: "Failed to delete template" }, { status: 500 });
  }
}
