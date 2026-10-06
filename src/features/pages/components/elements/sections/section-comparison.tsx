/**
 * Section Comparison — tabela "o que está incluso" comparando planos/opções lado a lado.
 * No celular a tabela rola na horizontal com a primeira coluna fixa.
 */
import { Check, X } from "lucide-react";
import { bgColor, fgColor, mutedColor, primaryColor, type SectionRendererProps } from "./types";
import { renderHighlightedText } from "./highlight-text";

export const COMPARISON_CELL_YES = "yes";
export const COMPARISON_CELL_NO = "no";

export interface ComparisonRow {
  id: string;
  label: string;
  /** Um valor por coluna: COMPARISON_CELL_YES, COMPARISON_CELL_NO ou texto livre. */
  values: string[];
}

export function SectionComparison({ element, tokens }: SectionRendererProps) {
  const eyebrow = (element.eyebrow as string | undefined) ?? "";
  const heading = (element.heading as string | undefined) ?? "";
  const subheading = (element.subheading as string | undefined) ?? "";
  const featureColumnLabel = (element.featureColumnLabel as string | undefined) ?? "";
  const columns = (element.columns as string[] | undefined) ?? [];
  const rows = (element.rows as ComparisonRow[] | undefined) ?? [];
  const highlightedColumn = (element.highlightedColumn as number | undefined) ?? -1;
  const anchorId = (element.anchorId as string | undefined) || undefined;

  const primary = primaryColor(element, tokens);
  const bg = bgColor(element, tokens);
  const fg = fgColor(element, tokens);
  const muted = mutedColor(element, tokens);
  const lineColor = `${fg}1a`;
  const highlightBackground = `${primary}1f`;

  return (
    <section
      id={anchorId}
      className="w-full scroll-mt-20 px-4 py-14 sm:px-6 sm:py-20 lg:px-8"
      style={{ background: bg, color: fg }}
    >
      <div className="mx-auto max-w-5xl">
        {(eyebrow || heading || subheading) && (
          <div data-cascade-item className="mx-auto mb-10 max-w-2xl text-center">
            {eyebrow && (
              <p className="mb-3 text-xs font-semibold tracking-[0.2em] uppercase" style={{ color: primary }}>
                {eyebrow}
              </p>
            )}
            {heading && (
              <h2 className="text-2xl leading-tight font-bold sm:text-4xl">
                {renderHighlightedText(heading, element, primary)}
              </h2>
            )}
            {subheading && (
              <p className="mt-4 text-sm leading-relaxed sm:text-base" style={{ color: muted }}>
                {subheading}
              </p>
            )}
          </div>
        )}

        <div data-cascade-item className="overflow-x-auto rounded-2xl border" style={{ borderColor: lineColor }}>
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr>
                <th
                  className="sticky left-0 z-10 px-4 py-4 text-left text-xs font-semibold tracking-wider uppercase"
                  style={{ background: bg, color: muted }}
                >
                  {featureColumnLabel}
                </th>
                {columns.map((columnName, columnIndex) => (
                  <th
                    key={`${columnName}-${columnIndex}`}
                    className="px-4 py-4 text-center text-xs font-bold tracking-wider uppercase"
                    style={{
                      color: columnIndex === highlightedColumn ? primary : fg,
                      background: columnIndex === highlightedColumn ? highlightBackground : undefined,
                    }}
                  >
                    {columnName}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t" style={{ borderColor: lineColor }}>
                  <td className="sticky left-0 z-10 px-4 py-3.5 text-left" style={{ background: bg }}>
                    {row.label}
                  </td>
                  {columns.map((columnName, columnIndex) => {
                    const cellValue = row.values[columnIndex] ?? COMPARISON_CELL_NO;
                    return (
                      <td
                        key={`${columnName}-${columnIndex}`}
                        className="px-4 py-3.5 text-center"
                        style={{ background: columnIndex === highlightedColumn ? highlightBackground : undefined }}
                      >
                        {cellValue === COMPARISON_CELL_YES ? (
                          <Check className="mx-auto size-5" style={{ color: primary }} aria-label="Incluso" />
                        ) : cellValue === COMPARISON_CELL_NO ? (
                          <X className="mx-auto size-5 opacity-50" style={{ color: muted }} aria-label="Não incluso" />
                        ) : (
                          <span className="font-medium">{cellValue}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
