interface ConversationsLayoutProps {
  children: React.ReactNode;
}

export function ConversationsLayout({ children }: ConversationsLayoutProps) {
  return <div>{children}</div>;
}
