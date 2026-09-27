import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AstroChatApp } from "@/features/astro-chat/components/astro-chat-app";

/** App ASTRO CHAT — o ASTRO no site do cliente (spec 0031). */
export default async function AstroChatPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/sign-in");
  if (!session.session.activeOrganizationId) redirect("/settings");

  return (
    <Suspense>
      <AstroChatApp />
    </Suspense>
  );
}
