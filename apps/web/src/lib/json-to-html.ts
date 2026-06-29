import { baseExtensions } from "@/components/rich-text-editor/extensions";
import { type JSONContent, generateHTML } from "@tiptap/react";

export function convertJsonToHtml(json: JSONContent): string {
  try {
    const content = typeof json === "string" ? JSON.parse(json) : json;

    return generateHTML(content, baseExtensions);
  } catch {
    console.error("Error converting JSON to HTML");
    return "";
  }
}
