import { LeadAction, LeadSource } from "@/generated/prisma/enums";
import { InfiniteData } from "@tanstack/react-query";

export interface MessageBodyProps {
  senderId: string | null;
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
    lead: {
      trackingId: string;
      phone: string | null;
      id: string;
      createdAt: Date;
      name: string;
      isActive: boolean;
      email: string | null;
      document: string | null;
      profile: string | null;
      description: string | null;
      statusId: string;
      responsibleId: string | null;
      order: number;
      source: LeadSource;
      currentAction: LeadAction;
      updatedAt: Date;
      closedAt: Date | null;
    };
  } & {
    trackingId: string;
    id: string;
    createdAt: Date;
    name: string | null;
    lastMessageAt: Date;
    isGroup: boolean;
    remoteJid: string;
    profilePicUrl: string | null;
    isActive: boolean;
    leadId: string;
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
  fromMe: boolean;
  quotedMessageId?: string | null;
  lead: {
    id: string;
    name: string;
  };
}

export type MessagePage = {
  items: Message[];
  nextCursor?: string;
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
