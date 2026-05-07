import { ReactNode } from "react";
import { Message } from "../types";

const URL_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;

function renderWithLinks(text: string): ReactNode {
  if (!text) return text;
  const parts = text.split(URL_REGEX);
  return parts.map((part, i) => {
    if (i % 2 === 1) {
      const href = part.startsWith("http") ? part : `https://${part}`;
      return (
        <a
          key={i}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="underline text-blue-500 hover:text-blue-600 break-all"
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

export function BodyMessage({ message }: { message: Message }) {
  return (
    <div className="whitespace-pre-wrap px-1.5">
      {(() => {
        if (!message.fromMe || !message.senderName || !message.body) {
          return renderWithLinks(message.body || "");
        }

        const lines = message.body.split("\n");
        const firstLine = lines[0].trim();

        if (firstLine.startsWith("*") && firstLine.endsWith("*")) {
          const rest = lines.length > 1 ? "\n" + lines.slice(1).join("\n") : "";
          return (
            <>
              <strong>{message.senderName}</strong>
              {renderWithLinks(rest)}
            </>
          );
        }

        return renderWithLinks(message.body);
      })()}
    </div>
  );
}
