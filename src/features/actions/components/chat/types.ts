export interface ActionChatSender {
  id: string;
  name: string | null;
  image: string | null;
}

export interface ActionChatQuotedMessage {
  id: string;
  body: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  mimetype: string | null;
  fileName: string | null;
  senderId: string;
  senderName: string | null;
  isDeleted: boolean;
  createdAt: Date | string;
}

export interface ActionChatMessage {
  id: string;
  actionId: string;
  body: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  mimetype: string | null;
  fileName: string | null;
  quotedMessageId: string | null;
  senderId: string;
  senderName: string | null;
  sender: ActionChatSender;
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: Date | string;
  quotedMessage: ActionChatQuotedMessage | null;
}

export interface ActionChatMessageGroup {
  date: string;
  messages: ActionChatMessage[];
}

export interface ActionChatMessagePage {
  items: ActionChatMessageGroup[];
  nextCursor?: string;
}

export interface InfiniteActionChatMessages {
  pages: ActionChatMessagePage[];
  pageParams: (string | undefined)[];
}

export interface MarkedActionChatMessage {
  id: string;
  body: string | null;
  mediaUrl?: string | null;
  mediaType?: string | null;
  mimetype?: string | null;
  fileName?: string | null;
  senderId: string;
  senderName?: string | null;
  createdAt?: Date | string;
}

export interface ActionChatParticipant {
  user: {
    id: string;
    name: string | null;
    image?: string | null;
  };
}
