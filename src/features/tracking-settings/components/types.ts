import { WhatsAppInstanceStatus } from "@/generated/prisma/enums";

// Instance Types
export interface Instance {
  id: string;
  instanceName: string;
  baseUrl: string;
  apiKey: string;
  status: WhatsAppInstanceStatus;
  instanceId: string;
  phoneNumber?: string | null;
  profileName?: string | null;
}

export interface CreateInstancePayload {
  name: string;
  systemName: string;
  adminField01?: string;
  adminField02?: string;
}

export interface CreateInstanceResponse {
  success: boolean;
  instance?: {
    id: string;
    name: string;
    token: string;
    serverUrl: string;
    qrcode?: string;
  };
  message?: string;
}

// Webhook Types
export interface WebhookPayload {
  url: string;
  enabled: boolean;
  events?: string[];
}

export interface WebhookResponse {
  success: boolean;
  message?: string;
  webhook?: WebhookPayload;
}

// Instance Types
export interface ConnectInstanceResponse {
  success: boolean;
  message?: string;
  qrcode?: string;
  pairingCode?: string;
  connected?: boolean;
}

export interface DeleteInstanceResponse {
  success: boolean;
  message?: string;
}

export interface DisconnectInstanceResponse {
  success: boolean;
  message?: string;
}

export interface InstanceStatusResponse {
  success: boolean;
  connected: boolean;
  phone?: string;
  name?: string;
  platform?: string;
  profilePicUrl?: string;
}

// Send Text Types
export interface SendTextPayload {
  phone: string;
  message: string;
}

export interface SendTextResponse {
  success: boolean;
  message?: string;
  messageId?: string;
}
