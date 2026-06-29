import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { NotificationPreferencesPanel } from "@/features/settings/components/notification-preferences-panel";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { AutomationsTab } from "@/features/alerts/components/automations-tab";

export default async function NotificationsSettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/sign-in");

  const orgId = session.session.activeOrganizationId;
  if (!orgId) redirect("/settings");

  return (
    <div className="px-4 pb-8 max-w-3xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Notificações</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure preferências de recebimento e crie automações por app.
        </p>
      </div>
      <Tabs defaultValue="preferences">
        <TabsList>
          <TabsTrigger value="preferences">Preferências</TabsTrigger>
          <TabsTrigger value="automations">Automações</TabsTrigger>
        </TabsList>
        <TabsContent value="preferences" className="pt-4">
          <NotificationPreferencesPanel organizationId={orgId} />
        </TabsContent>
        <TabsContent value="automations" className="pt-4">
          <AutomationsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
