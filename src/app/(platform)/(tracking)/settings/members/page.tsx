import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MembersTab } from "./tabs/members-tab";
import { InvitationsTab } from "./tabs/invitations-tab";

export default function Page() {
  return (
    <div>
      <Tabs
        defaultValue="members"
        orientation="vertical"
        className="flex-row gap-12"
      >
        <TabsList className="h-full flex-col">
          <TabsTrigger value="members">Membros</TabsTrigger>
          <TabsTrigger value="invitations">Convites</TabsTrigger>
        </TabsList>
        <TabsContent value="members">
          <MembersTab />
        </TabsContent>
        <TabsContent value="invitations">
          <InvitationsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
