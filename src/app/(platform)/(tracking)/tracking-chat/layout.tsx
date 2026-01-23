import { ConversationsList } from "@/features/tracking-chat/components/conversations-list";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full flex min-w-screen">
      <ConversationsList />
      {children}
    </div>
  );
}
