/**
 * DataBoundBlock — renderiza dados reais do app (planos, cursos,
 * leaderboard, stats) baseado em `element.binding`.
 *
 * Layouts suportados:
 *  - grid: cards quadrados em N colunas
 *  - list: linhas empilhadas com avatar à esquerda
 *  - table: linhas tabulares com colunas
 *  - carousel: scroll horizontal (sem animação por enquanto)
 */
import {
  bgColor,
  fgColor,
  mutedColor,
  primaryColor,
  type SectionRendererProps,
} from "./sections/types";
import {
  DATA_SOURCE_LABELS,
  resolveDataSource,
  type DataSourceItem,
} from "../../lib/data-sources";
import type { DataBindingConfig } from "../../types";

export function DataBoundBlock({ element, tokens }: SectionRendererProps) {
  const binding = element.binding as DataBindingConfig | undefined;

  const primary = primaryColor(element, tokens);
  const bg = bgColor(element, tokens);
  const fg = fgColor(element, tokens);
  const muted = mutedColor(element, tokens);

  if (!binding) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          padding: 24,
          background: `${primary}10`,
          color: muted,
          border: `1px dashed ${primary}50`,
          borderRadius: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          textAlign: "center",
        }}
      >
        Configure um data source no painel de propriedades.
      </div>
    );
  }

  const items = resolveDataSource(binding);
  const sourceMeta = DATA_SOURCE_LABELS[binding.source];
  const layout = binding.layout ?? "grid";

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        padding: 20,
        background: bg,
        color: fg,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        overflow: "hidden",
      }}
    >
      {/* Header com indicador de fonte (apenas em edit) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 11,
          color: muted,
        }}
      >
        <span>{sourceMeta.icon}</span>
        <span style={{ textTransform: "uppercase", letterSpacing: "0.1em" }}>
          {sourceMeta.label}
        </span>
        <span
          style={{
            marginLeft: "auto",
            padding: "2px 6px",
            borderRadius: 4,
            background: `${primary}20`,
            color: primary,
            fontSize: 10,
          }}
        >
          {layout.toUpperCase()}
        </span>
      </div>

      {/* Layout renderers */}
      {layout === "grid" && <DataGrid items={items} primary={primary} fg={fg} muted={muted} />}
      {layout === "list" && <DataList items={items} primary={primary} fg={fg} muted={muted} />}
      {layout === "table" && <DataTable items={items} primary={primary} fg={fg} muted={muted} />}
      {layout === "carousel" && <DataCarousel items={items} primary={primary} fg={fg} muted={muted} />}
    </div>
  );
}

interface LayoutProps {
  items: DataSourceItem[];
  primary: string;
  fg: string;
  muted: string;
}

function DataGrid({ items, primary, fg, muted }: LayoutProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: 12,
      }}
    >
      {items.map((item) => (
        <div
          key={item.id}
          style={{
            padding: 16,
            borderRadius: 12,
            background: `${primary}10`,
            border: `1px solid ${primary}30`,
          }}
        >
          {item.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.image}
              alt=""
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                marginBottom: 8,
                objectFit: "cover",
              }}
            />
          )}
          <div style={{ fontSize: 14, fontWeight: 700, color: fg }}>
            {item.title}
          </div>
          {item.subtitle && (
            <div style={{ fontSize: 11, color: muted, marginTop: 2 }}>
              {item.subtitle}
            </div>
          )}
          {item.value && (
            <div
              style={{
                marginTop: 8,
                fontSize: 18,
                fontWeight: 900,
                color: primary,
              }}
            >
              {item.value}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function DataList({ items, primary, fg, muted }: LayoutProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {items.map((item, i) => (
        <div
          key={item.id}
          style={{
            padding: 10,
            display: "flex",
            alignItems: "center",
            gap: 10,
            borderRadius: 8,
            background: `${fg}05`,
          }}
        >
          <span style={{ fontSize: 12, color: muted, width: 20 }}>
            #{i + 1}
          </span>
          {item.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.image}
              alt=""
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                objectFit: "cover",
              }}
            />
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: fg }}>
              {item.title}
            </div>
            {item.subtitle && (
              <div style={{ fontSize: 11, color: muted }}>{item.subtitle}</div>
            )}
          </div>
          {item.value && (
            <span style={{ fontSize: 13, fontWeight: 700, color: primary }}>
              {item.value}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function DataTable({ items, primary, fg, muted }: LayoutProps) {
  return (
    <table
      style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}
    >
      <tbody>
        {items.map((item) => (
          <tr key={item.id} style={{ borderBottom: `1px solid ${fg}10` }}>
            <td style={{ padding: 8, color: fg }}>{item.title}</td>
            {item.subtitle && (
              <td style={{ padding: 8, color: muted }}>{item.subtitle}</td>
            )}
            {item.value && (
              <td
                style={{
                  padding: 8,
                  textAlign: "right",
                  color: primary,
                  fontWeight: 700,
                }}
              >
                {item.value}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DataCarousel({ items, primary, fg, muted }: LayoutProps) {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        overflowX: "auto",
        paddingBottom: 8,
      }}
    >
      {items.map((item) => (
        <div
          key={item.id}
          style={{
            flexShrink: 0,
            minWidth: 180,
            padding: 16,
            borderRadius: 12,
            background: `${primary}10`,
            border: `1px solid ${primary}30`,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700, color: fg }}>
            {item.title}
          </div>
          {item.subtitle && (
            <div style={{ fontSize: 11, color: muted, marginTop: 4 }}>
              {item.subtitle}
            </div>
          )}
          {item.value && (
            <div
              style={{
                marginTop: 8,
                fontSize: 16,
                fontWeight: 900,
                color: primary,
              }}
            >
              {item.value}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
