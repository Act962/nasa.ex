"use client";

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  EmptyMedia,
} from "@/components/ui/empty";
import { BookOpenTextIcon } from "lucide-react";

export function EmptyConversation() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>Conversation not found</EmptyTitle>
        <EmptyDescription>Conversation not found</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <EmptyMedia>
          <BookOpenTextIcon size={48} />
        </EmptyMedia>
      </EmptyContent>
    </Empty>
  );
}
