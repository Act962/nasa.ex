import { LeadAction } from "@/generated/prisma/client";
import { LeadBox } from "./lead-box";
import { UserRoundPlusIcon } from "lucide-react";

const listLeads = [
  {
    name: "Lulano",
    description: "",
    id: "1",
    email: "",
    phone: "",
    profile: "",
    statusId: "",
    currentAction: LeadAction.ACTIVE,
    trackingId: "",
    responsibleId: "",
    order: 0,
    isActive: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    closedAt: null,
  },
  {
    name: "Cicrano",
    description: "",
    id: "2",
    email: "",
    phone: "",
    profile: "",
    statusId: "",
    currentAction: LeadAction.ACTIVE,
    trackingId: "",
    responsibleId: "",
    order: 0,
    isActive: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    closedAt: null,
  },
  {
    name: "Beltrano",
    description: "",
    id: "3",
    email: "",
    phone: "",
    profile: "",
    statusId: "",
    trackingId: "",
    responsibleId: "",
    currentAction: LeadAction.ACTIVE,
    order: 0,
    isActive: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    closedAt: null,
  },
];

export function ConversationsList() {
  const isOpen = true;

  return (
    <aside
      className={`fixed inset-y-0 pb-20 lg:pb-0 lg:w-80 lg:block overflow-y-auto border-r border-foreground/10 block w-full left-12 ${isOpen ? "hidden" : "block w-full left-0"}`}
    >
      <div className="px-5">
        <div className="flex justify-between mb-4 pt-4">
          <div className="text-xl font-medium">Tracking Chat</div>
          <div className="cursor-pointer">
            <UserRoundPlusIcon className="w-5 h-5" />
          </div>
        </div>
        <div className="flex-col gap-2">
          {listLeads.map((item) => (
            <LeadBox
              key={item.id}
              item={item}
              lastMessageText="Last nessage ai"
            />
          ))}
        </div>
      </div>
    </aside>
  );
}
