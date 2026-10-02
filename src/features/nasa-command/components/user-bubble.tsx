import React from "react";
import { buildHighlightedHTML } from "../utils";

export function UserBubble({ command }: { command: string }) {
  return (
    <div className="flex justify-center py-2">
      <div
        className="max-w-2xl w-full bg-card/60 border border-line/50 rounded-2xl px-5 py-3 text-sm leading-relaxed"
        dangerouslySetInnerHTML={{ __html: buildHighlightedHTML(command) }}
        style={{ color: "var(--card-foreground)" }}
      />
    </div>
  );
}
