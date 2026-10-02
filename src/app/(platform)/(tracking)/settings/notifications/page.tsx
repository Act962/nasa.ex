import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Bell } from "lucide-react";
import { NotificationPreferencesPanel } from "@/features/settings/components/notification-preferences-panel";

export default async function NotificationsSettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/sign-in");

  const orgId = session.session.activeOrganizationId;
  if (!orgId) redirect("/settings");

  return (
    <div className="max-w-3xl space-y-6 px-4 pb-8">
      <div>
        <h2 className="text-lg font-semibold max-md:hidden">Notificações</h2>
        <p className="mt-1 text-sm text-muted-foreground max-md:mt-0">
          O que você quer receber na plataforma. O que chega no seu WhatsApp fica no App ASTRO.
        </p>
      </div>

      <NotificationPreferencesPanel organizationId={orgId} channels={["inApp"]} />

      {/* As regras de alerta mudaram para o App ASTRO: é ele quem avisa, no
          widget e no orb, e tê-las aqui escondia essa relação. */}
      <Link
        href="/astro?aba=alertas"
        className="flex items-center gap-3 rounded-[20px] border border-line bg-card p-4 transition-colors hover:bg-accent"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-knob">
          <Bell className="size-4 text-muted-foreground" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">
            Configurar o que o ASTRO avisa
          </span>
          <span className="block text-xs text-muted-foreground">
            Lead esperando, boleto vencendo, contrato a vencer: esses avisos ficam no
            App ASTRO, junto das aprovações.
          </span>
        </span>
        <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
      </Link>
    </div>
  );
}
