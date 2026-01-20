import { convertJsonToHtml } from "@/lib/json-to-html";
import { type JSONContent } from "@tiptap/react";
import DOMPurify from "dompurify";
import parse from "html-react-parser";

interface SafeContentProps {
  content: JSONContent;
  className?: string;
}

export function SafeContent({ content, className }: SafeContentProps) {
  const html = convertJsonToHtml(content);

  const clean = DOMPurify.sanitize(html);

  try {
    return <div className={className}>{parse(clean)}</div>;
  } catch {
    return <div className={className}></div>;
  }
}
