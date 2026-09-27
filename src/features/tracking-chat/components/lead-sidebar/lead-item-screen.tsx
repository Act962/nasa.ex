"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { JourneyTimeline } from "@/features/leads/components/journey-timeline";
import { LeadAttachmentsByFolder } from "@/features/leads/components/lead-files/lead-attachments-by-folder";
import { LeadFormResponses } from "@/features/leads/components/lead-form-responses";
import { LeadContracts } from "@/features/leads/components/lead-contracts";
import { LEAD_SIDEBAR_ITEMS, type LeadSidebarItemId } from "./sidebar-items";
import { AgendaScreen } from "./screens/agenda-screen";
import { CampaignsScreen } from "./screens/campaigns-screen";
import { CommandsScreen } from "./screens/commands-screen";
import { DocumentsScreen } from "./screens/documents-screen";
import { StarFriendScreen } from "./screens/star-friend-screen";

export interface LeadScreenLead {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  trackingId: string;
}

function ScreenBody({
  itemId,
  lead,
  conversationId,
}: {
  itemId: LeadSidebarItemId;
  lead: LeadScreenLead;
  conversationId: string;
}) {
  switch (itemId) {
    case "journey":
      return <JourneyTimeline leadId={lead.id} />;
    case "files":
      return <LeadAttachmentsByFolder leadId={lead.id} />;
    case "forms":
      return <LeadFormResponses leadId={lead.id} trackingId={lead.trackingId} />;
    case "contracts":
      return <LeadContracts leadId={lead.id} />;
    case "documents":
      return (
        <DocumentsScreen
          conversationId={conversationId}
          lead={{ id: lead.id, name: lead.name, phone: lead.phone ?? null }}
        />
      );
    case "starFriend":
      return <StarFriendScreen />;
    case "agenda":
      return <AgendaScreen leadId={lead.id} leadName={lead.name} leadPhone={lead.phone} leadEmail={lead.email} />;
    case "campaigns":
      return <CampaignsScreen leadId={lead.id} />;
    case "commands":
      return <CommandsScreen leadId={lead.id} leadName={lead.name} />;
  }
}

interface LeadItemScreenProps {
  itemId: LeadSidebarItemId | null;
  lead: LeadScreenLead;
  conversationId: string;
  onClose: () => void;
}

export function LeadItemScreen({ itemId, lead, conversationId, onClose }: LeadItemScreenProps) {
  const item = LEAD_SIDEBAR_ITEMS.find((candidate) => candidate.id === itemId);
  return (
    <Dialog open={Boolean(item)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex h-[80vh] flex-col sm:max-w-4xl">
        {item && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <item.icon className="size-4" />
                {item.label} · {lead.name}
              </DialogTitle>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <ScreenBody itemId={item.id} lead={lead} conversationId={conversationId} />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
