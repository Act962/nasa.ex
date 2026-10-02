"use client";

import { Fragment, type ReactNode } from "react";
import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { GUIDE_GLOSSARY, type GuideGlossaryTerm } from "../lib/guide-glossary";

/** Texto do guia com um ⓘ depois de cada termo técnico (só na primeira vez); tocar abre a explicação. */

interface TermMatch {
  start: number;
  end: number;
  term: GuideGlossaryTerm;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findTermMatches(text: string, skippedTermIds: ReadonlySet<string> = new Set()): TermMatch[] {
  const found: TermMatch[] = [];
  for (const term of GUIDE_GLOSSARY) {
    if (skippedTermIds.has(term.id)) continue;
    for (const match of term.matches) {
      const result = new RegExp(`(^|[^\\p{L}])(${escapeRegExp(match)})(?![\\p{L}])`, "iu").exec(text);
      if (!result) continue;
      const start = result.index + result[1].length;
      found.push({ start, end: start + result[2].length, term });
      break;
    }
  }
  // Termos que se sobrepõem: fica o que começa antes (e, empatado, o mais longo).
  return found
    .sort((first, second) => first.start - second.start || second.end - first.end)
    .filter((match, index, sorted) => index === 0 || match.start >= sorted[index - 1].end);
}

export function GuideTermsText({ text }: { text: string }) {
  // **trecho** destaca o que a pessoa precisa fazer; o resto ganha o ⓘ dos termos técnicos.
  const segments = text.split(/\*\*(.+?)\*\*/g);
  // O ⓘ de cada termo aparece só uma vez no texto inteiro, mesmo atravessando os destaques.
  const explainedTermIds = new Set<string>();
  const segmentMatches = segments.map((segment) => {
    const matches = findTermMatches(segment, explainedTermIds);
    matches.forEach((match) => explainedTermIds.add(match.term.id));
    return matches;
  });
  return (
    <>
      {segments.map((segment, index) =>
        index % 2 === 1 ? (
          <strong key={index} className="font-semibold text-foreground">
            <TermsSegment text={segment} matches={segmentMatches[index]} />
          </strong>
        ) : (
          <TermsSegment key={index} text={segment} matches={segmentMatches[index]} />
        ),
      )}
    </>
  );
}

function TermsSegment({ text, matches }: { text: string; matches: TermMatch[] }) {
  if (matches.length === 0) return <>{text}</>;

  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const match of matches) {
    parts.push(text.slice(cursor, match.end));
    parts.push(<TermInfoButton key={match.term.id} term={match.term} />);
    cursor = match.end;
  }
  parts.push(text.slice(cursor));
  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={index}>{part}</Fragment>
      ))}
    </>
  );
}

function TermInfoButton({ term }: { term: GuideGlossaryTerm }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`O que é: ${term.title}`}
          onClick={(event) => event.stopPropagation()}
          className="mx-0.5 inline-grid size-4 translate-y-[2px] place-items-center rounded-full bg-info/15 text-info transition-colors hover:bg-info/25"
        >
          <Info className="size-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" className="w-72 max-w-[calc(100vw-1rem)] p-3.5 text-left">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Info className="size-4 text-info" /> {term.title}
        </p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{term.text}</p>
      </PopoverContent>
    </Popover>
  );
}
