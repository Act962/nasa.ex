"use-client";

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { RocketIcon } from "lucide-react";

interface EmptyChatProps {
  title: string;
  description: string;
}

export function EmptyChat({ title, description }: EmptyChatProps) {
  return (
    <Empty>
      <EmptyMedia>
        <RocketIcon />
      </EmptyMedia>
      <EmptyContent>
        <EmptyHeader>
          <EmptyTitle>{title}</EmptyTitle>
          <EmptyDescription>{description}</EmptyDescription>
        </EmptyHeader>
      </EmptyContent>
    </Empty>
  );
}
