import Link from "next/link";
import { Fragment } from "react";

const MARKDOWN_LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g;

/** Legendas vindas de tools trazem links em markdown; aqui viram links de verdade em vez de código cru. */
export function AstroInlineLinks({ text }: { text: string }) {
  const segments: React.ReactNode[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(MARKDOWN_LINK)) {
    const [fullMatch, label, href] = match;
    const matchIndex = match.index ?? 0;
    if (matchIndex > lastIndex) segments.push(text.slice(lastIndex, matchIndex));
    const isInternal = href.startsWith("/");
    segments.push(
      isInternal ? (
        <Link key={matchIndex} href={href} className="font-medium text-info underline-offset-2 hover:underline">
          {label}
        </Link>
      ) : (
        <a
          key={matchIndex}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-info underline-offset-2 hover:underline"
        >
          {label}
        </a>
      ),
    );
    lastIndex = matchIndex + fullMatch.length;
  }
  if (lastIndex < text.length) segments.push(text.slice(lastIndex));
  return <Fragment>{segments}</Fragment>;
}
