export type WhatsAppConversationCategory =
  | "MARKETING"
  | "UTILITY"
  | "AUTHENTICATION"
  | "AUTHENTICATION_INTERNATIONAL"
  | "SERVICE";

export interface WhatsAppAnalyticsReport {
  currency: string;
  summary: {
    sent: number;
    delivered: number;
    conversations: number;
    totalCost: number;
  };
  messagesByDay: Array<{
    date: string;
    sent: number;
    delivered: number;
  }>;
  conversationsByCategory: Array<{
    category: WhatsAppConversationCategory;
    conversations: number;
    cost: number;
  }>;
}
