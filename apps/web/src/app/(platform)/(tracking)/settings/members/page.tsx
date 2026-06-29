import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MembersTab } from "@/features/settings/components/tabs/members-tab";
import { InvitationsTab } from "@/features/settings/components/tabs/invitations-tab";
import { InviteLinksTab } from "@/features/settings/components/tabs/invite-links-tab";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export default async function Page() {
  const organization = await auth.api.getFullOrganization({
    headers: await headers(),
  });

  return (
    <div className="px-4">
      <Tabs
        defaultValue="members"
        orientation="vertical"
        className="flex-col sm:flex-row gap-12"
      >
        <TabsList className="h-full flex-col">
          <TabsTrigger value="members">Membros</TabsTrigger>
          <TabsTrigger value="invitations">Convites</TabsTrigger>
          <TabsTrigger value="invite-links">Links de Convite</TabsTrigger>
        </TabsList>
        <TabsContent value="members">
          <MembersTab members={organization?.members || []} />
        </TabsContent>
        <TabsContent value="invitations">
          <InvitationsTab
            invitations={organization?.invitations || []}
            members={organization?.members || []}
          />
        </TabsContent>
        <TabsContent value="invite-links">
          <InviteLinksTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
