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

export interface Instance {
  id: string;
  token: string;
  status: "connected" | "disconnected" | "connecting";
  paircode?: string;
  qrcode?: string;
  name: string;
  profileName?: string;
  profilePicUrl?: string;
  isBusiness?: boolean;
  plataform?: string;
  systemName: string;
  owner?: string;
  lastDisconnect?: string;
  lastDisconnectReason?: string;
  adminField01?: string;
  adminField02?: string;
  openai_apikey?: string;
  chatbot_enabled?: boolean;
  chatbot_ignoreGroups?: boolean;
  chatbot_stopConversation?: string;
  chatbot_stopMinutes?: number;
  created: string;
  updated: string;
  currentPresence?: string;
}

export interface CreateInstanceResponse {
  response: string;
  instance: Instance;
  connected: boolean;
  loggedIn: boolean;
  name: string;
  token: string;
  info: string;
}

export type ListInstancesResponse = Instance[];

export interface ConnectInstanceResponse {
  connected: boolean;
  loggedIn: boolean;
  jid: string | null;
  instance: Instance;
}

export interface DisconnectInstanceResponse {
  instance: Instance;
  response: string;
  info: string;
}

export interface InstanceStatusResponse {
  instance: Instance;
  status: {
    connected: boolean;
    loggedIn: boolean;
    jid: string | null;
  };
}

export interface DeleteInstanceResponse {
  response: string;
  info: string;
}

export type WebhookEvent =
  | "connection"
  | "history"
  | "messages"
  | "messages_update"
  | "call"
  | "contacts"
  | "presence"
  | "groups"
  | "labels"
  | "chats"
  | "chat_labels"
  | "blocks"
  | "leads"
  | "sender";

export type WebhookExcludeFilter =
  | "wasSentByApi"
  | "wasNotSentByApi"
  | "fromMeYes"
  | "fromMeNo"
  | "isGroupYes"
  | "isGroupNo";

export interface WebhookPayload {
  action: "add" | "update" | "delete";
  id?: string;
  enabled?: boolean;
  url?: string;
  events?: WebhookEvent[];
  excludeMessages?: WebhookExcludeFilter[];
}

export interface Webhook {
  id: string;
  enabled: boolean;
  url: string;
  events: WebhookEvent[];
  addUrlTypesMessages: boolean;
  addUrlEvents: boolean;
  excludeMessages: WebhookExcludeFilter[];
}

export type WebhookResponse = Webhook[];

export interface SendTextPayload {
  number: string;
  text: string;
  linkPreview?: boolean;
  linkPreviewTitle?: string;
  linkPreviewDescription?: string;
  linkPreviewImage?: string;
  linkPreviewLarge?: boolean;
  replyid?: string;
  mentions?: string;
  readchat?: boolean;
  readmessages?: boolean;
  delay?: number;
  forward?: boolean;
  track_source?: string;
  track_id?: string;
  async?: boolean;
}

export interface SendTextResponse {
  id: string;
  messageid: string;
  chatid: string;
  sender: string;
  senderName: string;
  isGroup: boolean;
  fromMe: boolean;
  messageType: string;
  source: string;
  messageTimestamp: number;
  status: string;
  text: string;
  quoted?: string;
  edited?: string;
  reaction?: string;
  vote?: string;
  convertOptions?: string;
  buttonOrListid?: string;
  owner?: string;
  error?: string;
  content?: any;
  wasSentByApi: boolean;
  sendFunction: string;
  sendPayload?: any;
  fileURL?: string;
  send_folder_id?: string;
  track_source?: string;
  track_id?: string;
  ai_metadata?: {
    agent_id: string;
    request: {
      messages: any[];
      tools: any[];
      options: {
        model: string;
        temperature: number;
        maxTokens: number;
        topP: number;
        frequencyPenalty: number;
        presencePenalty: number;
      };
    };
    response: {
      choices: any[];
      toolResults: any[];
      error?: string;
    };
  };
  sender_pn?: string;
  sender_lid?: string;
  response: {
    status: string;
    message: string;
  };
}
