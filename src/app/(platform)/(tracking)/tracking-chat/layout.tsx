import { ConversationsList } from "@/features/tracking-chat/components/conversations-list";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen flex w-full">
      <ConversationsList />
      <div className="flex-1">{children}</div>
    </div>
  );
}
