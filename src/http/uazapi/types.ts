export interface WebhookBody {
  BaseUrl: string;
  EventType: string;
  chat: Chat;
  chatSource: string;
  instanceName: string;
  message: Message;
  owner: string;
  token: string;
}

export interface Chat {
  chatbot_agentResetMemoryAt: number;
  chatbot_disableUntil: number;
  chatbot_lastTriggerAt: number;
  chatbot_lastTrigger_id: string;

  id: string;
  image: string;
  imagePreview: string;

  lead_assignedAttendant_id: string;
  lead_fullName: string;
  lead_isTicketOpen: boolean;
  lead_kanbanOrder: number;
  lead_name: string;
  lead_notes: string;
  lead_personalid: string;
  lead_status: string;
  lead_tags: string[];

  name: string;
  owner: string;
  phone: string;

  wa_archived: boolean;
  wa_chatid: string;
  wa_chatlid: string;
  wa_contactName: string;
  wa_ephemeralExpiration: number;
  wa_fastid: string;
  wa_isBlocked: boolean;
  wa_isGroup: boolean;
  wa_isGroup_admin: boolean;
  wa_isGroup_announce: boolean;
  wa_isGroup_community: boolean;
  wa_isGroup_member: boolean;
  wa_isPinned: boolean;
  wa_label: string[];
  wa_lastMessageSender: string;
  wa_lastMessageTextVote: string;
  wa_lastMessageType: string;
  wa_lastMsgTimestamp: number;
  wa_muteEndTime: number;
  wa_name: string;
  wa_unreadCount: number;
}

export interface Message {
  buttonOrListid: string;
  chatid: string;
  content: string;
  convertOptions: string;
  edited: string;
  fromMe: boolean;
  groupName: string;
  id: string;
  isGroup: boolean;
  mediaType: string;
  messageTimestamp: number;
  messageType: TypeMessage;
  messageid: string;
  owner: string;
  quoted: string;
  reaction: string;
  sender: string;
  senderName: string;
  sender_lid: string;
  sender_pn: string;
  source: string;
  status: string;
  text: string;
  track_id: string;
  track_source: string;
  type: string;
  vote: string;
  wasSentByApi: boolean;
}

export type TypeMessage =
  | "ExtendedTextMessage"
  | "ImageMessage"
  | "AudioMessage"
  | "VideoMessage"
  | "DocumentMessage"
  | "StickerMessage"
  | "Conversation";
