import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AstroBotSettings } from "@/features/astro-bot/components/astro-bot-settings";

export default async function AstroBotSettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/sign-in");
  if (!session.session.activeOrganizationId) redirect("/settings");

  return (
    <div className="px-4 pb-8 max-w-3xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Astro Bot WhatsApp</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Ative o canal da org e vincule seu número pessoal para conversar com
          o Astro direto pelo WhatsApp.
        </p>
      </div>
      <AstroBotSettings />
    </div>
  );
}
