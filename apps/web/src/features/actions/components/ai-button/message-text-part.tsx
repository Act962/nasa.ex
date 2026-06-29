import { MessageResponse } from "@/components/ai-elements/message";
import { ViewActionButton } from "./view-action-button";
import { MessageTextPartProps } from "./types";

export function MessageTextPart({
  text,
  isStreaming,
  onViewAction,
}: MessageTextPartProps) {
  // Separa tokens de botão customizado do restante do markdown
  const parts = text.split(/(\[VIEW_ACTION:[^|]+\|[^\]]+\])/g);

  return (
    <>
      {parts.map((part, index) => {
        const match = part.match(/\[VIEW_ACTION:([^|]+)\|([^\]]+)\]/);

        if (match) {
          const [, title, id] = match;
          return (
            <ViewActionButton
              key={index}
              title={title}
              id={id}
              onView={onViewAction}
            />
          );
        }

        // ✅ Usa MessageResponse (Streamdown) para renderizar markdown com streaming
        return (
          <MessageResponse
            key={index}
            parseIncompleteMarkdown={isStreaming}
            className="prose prose-zinc prose-invert max-w-none text-sm"
          >
            {part}
          </MessageResponse>
        );
      })}
    </>
  );
}
