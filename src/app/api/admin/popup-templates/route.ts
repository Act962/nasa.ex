import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-utils";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    await requireAdminSession();

    const templates = await prisma.achievementPopupTemplate.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(templates);
  } catch (error) {
    console.error("Error fetching popup templates:", error);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdminSession();

    const body = await req.json();

    const template = await prisma.achievementPopupTemplate.create({
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
        enableConfetti: body.enableConfetti ?? true,
        enableSound: body.enableSound ?? true,
        dismissDuration: body.dismissDuration ?? 5000,
        customJson: body.customJson ?? {},
        isActive: true,
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error("Error creating popup template:", error);
    return NextResponse.json({ error: "Failed to create template" }, { status: 500 });
  }
}
