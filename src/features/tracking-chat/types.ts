import { LeadSource } from "@/generated/prisma/enums";
import { InfiniteData } from "@tanstack/react-query";

export interface MessageBodyProps {
  senderId: string | null;
  senderName?: string | null;
  messageId: string;
  conversationId: string;
  fromMe: boolean;
  body: string | null;
  id: string;
  createdAt: Date;
  status: string;
  mediaUrl: string | null;
  mediaType: string | null;
  mediaCaption: string | null;
  mimetype: string | null;
  fileName: string | null;
  quotedMessageId: string | null;
  conversation: {
    id: string;
    lead: {
      id: string;
      name: string;
    };
  };
}

export interface CreatedMessageProps extends MessageBodyProps {
  currentUserId: string;
}

export enum MessageStatus {
  SENT = "SENT",
  SEEN = "SEEN",
}

export interface Message {
  id: string;
  messageId: string;
  senderName?: string | null;
  body: string | null;
  mediaUrl: string | null;
  quotedMessageId?: string | null;
  mimetype?: string | null;
  createdAt: Date;
  fromMe: boolean;
  fileName?: string | null;
  status: MessageStatus | string;
  conversation?: {
    lead: {
      id: string;
      name: string;
    };
  };
  quotedMessage?: Message | null;
}

export interface MarkedMessage {
  id: string;
  body: string | null;
  messageId: string;
  senderName?: string | null;
  fromMe: boolean;
  quotedMessageId?: string | null;
  mediaUrl?: string | null;
  mimetype?: string | null;
  fileName?: string | null;
  lead: {
    id: string;
    name: string;
  };
}

export type MessageGroup = {
  date: string;
  messages: Message[];
};

export type MessagePage = {
  items: MessageGroup[];
  nextCursor?: string;
  remoteJid?: string;
};

export interface conversationProps {
  id: string;
  name: string | null;
  trackingId: string;
  createdAt: Date;
  isActive: boolean;
  remoteJid: string;
  lastMessageAt: Date;
  isGroup: boolean;
  lastMessageId: string | null;
  profilePicUrl: string | null;
  leadId: string;
}

export type InfiniteMessages = InfiniteData<MessagePage>;

export type ConversationPage = {
  items: conversationProps[];
  nextCursor?: string;
};

export type InfiniteConversations = InfiniteData<ConversationPage>;

export interface Instance {
  token: string;
  isBusiness: boolean;
  phoneNumber: string | null;
}
