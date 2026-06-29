import { MessageResponse } from "@/components/ai-elements/message";
import { ViewLeadButton } from "./view-lead-button";
import { MessageTextPartProps } from "./types";

export function MessageTextPart({ text, isStreaming }: MessageTextPartProps) {
  const parts = text.split(/(\[VIEW_LEAD:[^|]+\|[^\]]+\])/g);

  return (
    <>
      {parts.map((part, index) => {
        const match = part.match(/\[VIEW_LEAD:([^|]+)\|([^\]]+)\]/);

        if (match) {
          const [, name, id] = match;
          return <ViewLeadButton key={index} name={name} id={id} />;
        }

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
