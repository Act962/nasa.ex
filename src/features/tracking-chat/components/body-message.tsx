import { Message } from "../types";

export function BodyMessage({ message }: { message: Message }) {
  return (
    <div className="whitespace-pre-wrap px-1.5">
      {(() => {
        if (!message.fromMe || !message.senderName || !message.body) {
          return message.body || "";
        }

        const lines = message.body.split("\n");
        const firstLine = lines[0].trim();

        if (firstLine.startsWith("*") && firstLine.endsWith("*")) {
          return (
            <>
              <strong>{message.senderName}</strong>
              {lines.length > 1 ? "\n" + lines.slice(1).join("\n") : ""}
            </>
          );
        }

        return message.body;
      })()}
    </div>
  );
}
