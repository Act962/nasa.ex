"use client";

import { authClient } from "@/lib/auth-client";
import { NotificationPreferencesPanel } from "@/features/settings/components/notification-preferences-panel";
import { RecordNoticePreferences } from "@/features/form-records/components/record-notice-preferences";

/**
 * O que o ASTRO te manda no WhatsApp (spec 0029).
 *
 * Vivia em Configurações › Notificações, numa coluna ao lado do canal da
 * plataforma. Quem entrega é o bot configurado logo acima nesta aba, e ter a
 * escolha em outra tela escondia essa ligação.
 */
export function WhatsAppNotificationPreferences() {
  const { data: session } = authClient.useSession();
  const organizationId = session?.session.activeOrganizationId;
  if (!organizationId) return null;

  return (
    <section className="space-y-4 pt-8">
      <div>
        <h3 className="text-sm font-medium">O que o ASTRO te manda no WhatsApp</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Sua escolha, não a da organização: vale para o seu número.
        </p>
      </div>
      <NotificationPreferencesPanel organizationId={organizationId} channels={["whatsApp"]} />
      <RecordNoticePreferences />
    </section>
  );
}
