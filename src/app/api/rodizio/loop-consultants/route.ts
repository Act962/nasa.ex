import prisma from "@/lib/prisma";
import { normalizePhone } from "@/utils/format-phone";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const json = await request.json();
  console.log(json);
  const { userCrmId, leadId } = json;

  try {
    return Response.json({ success: true });
  } catch (e) {
    console.log(e);
    return Response.json({ success: false });
  }
}
