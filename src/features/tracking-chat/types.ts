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
      conversationId: string | null;
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

export interface Message {
  id: string;
  body: string | null;
  mediaUrl: string | null;
  createdAt: Date;
  fromMe: boolean;
  conversation: {
    lead: {
      id: string;
      name: string;
    };
  };
}

export type MessagePage = {
  items: Message[];
  nextCursor?: string;
};

export type InfiniteMessages = InfiniteData<MessagePage>;
