export interface AiLeadButtonProps {
  trackingId: string;
  children: React.ReactNode;
}

export interface ViewLeadButtonProps {
  name: string;
  id: string;
}

export interface MessageTextPartProps {
  text: string;
  isStreaming: boolean;
}
