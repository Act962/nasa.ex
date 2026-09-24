"use client";

import { use } from "react";
import { AutomationEditor } from "@/features/comments/components/automation-editor";

export default function CommentsAutomationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <main className="min-h-0 flex-1">
      <AutomationEditor automationId={id} />
    </main>
  );
}
