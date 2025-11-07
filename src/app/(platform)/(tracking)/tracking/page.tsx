import { ModeToggle } from "@/components/mode-toggle";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LogoutButton } from "../_components/logout-button";

export default async function TrackingPage() {
  const [session, organization] = await Promise.all([
    await auth.api.getSession({
      headers: await headers(),
    }),
    await auth.api.getFullOrganization({
      headers: await headers(),
    }),
  ]);

  if (!session) {
    redirect("/sign-in");
  }

  return (
    <div className="h-full flex items-center justify-center flex-col gap-1.5">
      <h3> {session.user.name} </h3>
      <h3> {session.user.email} </h3>
      <h3> {organization?.name} </h3>
      <LogoutButton />
      <ModeToggle />
    </div>
  );
}
