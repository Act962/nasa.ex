import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * Server-side guard for admin pages.
 * Verifies isSystemAdmin directly from DB on every call — never trusts session cache alone.
 * Redirects to /sign-in if not authenticated, throws 403 if not system admin.
 */
export async function requireAdminSession() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect("/sign-in");
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, image: true, isSystemAdmin: true },
  });

  if (!dbUser?.isSystemAdmin) {
    redirect("/home");
  }

  return { session, adminUser: dbUser };
}
