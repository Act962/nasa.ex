import { Image, Text, View } from "@react-pdf/renderer";
import type { FormBlockInstance } from "@/features/form/types";
import { parseImageMarkers } from "@/features/form-records/lib/image-markers-value";
import { parseItemListMeta, readConfigItems } from "@/features/form-records/lib/item-list-value";
import { findMeasureUnit, formatCents } from "@/features/form-records/lib/measure-units";
import { constructUrl, renderFieldLabel, renderHelperText, type PdfResponseValues } from "./pdf-field-helpers";

// PDF dos blocos de ficha (spec 0075): lista de itens e marcações na imagem.

const CELL_TEXT = { fontSize: 8.5, color: "#374151" } as const;
const HEADER_TEXT = { ...CELL_TEXT, fontFamily: "Helvetica-Bold" } as const;
const ROW = { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#d1d5db", paddingVertical: 3 } as const;
const PAGE_CONTENT_WIDTH = 515;
const MARKER_DOT = {
  position: "absolute",
  width: 12,
  height: 12,
  marginLeft: -6,
  marginTop: -6,
  borderRadius: 6,
  backgroundColor: "#dc2626",
  alignItems: "center",
  justifyContent: "center",
} as const;
const MARKER_NUMBER = { fontSize: 6.5, color: "#ffffff", fontFamily: "Helvetica-Bold" } as const;

function unitSymbol(unit: string): string {
  return findMeasureUnit(unit)?.symbol ?? unit;
}

export function renderItemListBlock(block: FormBlockInstance, responseValues?: PdfResponseValues) {
  const attributes = (block.attributes ?? {}) as Record<string, unknown>;
  const savedMeta = parseItemListMeta(responseValues?.[block.id]?.meta);
  // Em branco imprime a lista toda, para preencher à mão; preenchida, só o que foi usado.
  const rows = savedMeta
    ? savedMeta.items.map((item) => ({
        key: item.itemId,
        name: item.name,
        quantity: `${item.quantity.toLocaleString("pt-BR")} ${unitSymbol(item.unit)}`,
        unitPrice: item.unitPriceCents === null ? "—" : formatCents(item.unitPriceCents),
        total: item.unitPriceCents === null || item.billingMode === "INFO" ? "—" : formatCents(item.lineTotalCents),
      }))
    : readConfigItems(block as never).map((item) => ({
        key: item.itemId,
        name: item.name,
        quantity: `____ ${unitSymbol(item.unit)}`,
        unitPrice: "",
        total: "",
      }));

  return (
    <View>
      {renderFieldLabel(attributes.label as string, attributes.required as boolean)}
      {renderHelperText(attributes.helperText as string)}
      <View style={{ borderTopWidth: 0.5, borderTopColor: "#d1d5db", marginTop: 4 }}>
        <View style={ROW}>
          <Text style={{ ...HEADER_TEXT, flex: 3 }}>Item</Text>
          <Text style={{ ...HEADER_TEXT, flex: 1, textAlign: "right" }}>Qtd.</Text>
          <Text style={{ ...HEADER_TEXT, flex: 1, textAlign: "right" }}>Preço</Text>
          <Text style={{ ...HEADER_TEXT, flex: 1, textAlign: "right" }}>Total</Text>
        </View>
        {rows.map((row) => (
          <View key={row.key} style={ROW} wrap={false}>
            <Text style={{ ...CELL_TEXT, flex: 3 }}>{row.name}</Text>
            <Text style={{ ...CELL_TEXT, flex: 1, textAlign: "right" }}>{row.quantity}</Text>
            <Text style={{ ...CELL_TEXT, flex: 1, textAlign: "right" }}>{row.unitPrice}</Text>
            <Text style={{ ...CELL_TEXT, flex: 1, textAlign: "right" }}>{row.total}</Text>
          </View>
        ))}
        {savedMeta && (
          <View style={{ flexDirection: "row", paddingVertical: 4 }}>
            <Text style={{ ...HEADER_TEXT, flex: 5, textAlign: "right" }}>Total dos itens</Text>
            <Text style={{ ...HEADER_TEXT, flex: 1, textAlign: "right" }}>{formatCents(savedMeta.usageTotalCents)}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

export function renderImageMarkerBlock(block: FormBlockInstance, responseValues?: PdfResponseValues) {
  const attributes = (block.attributes ?? {}) as Record<string, unknown>;
  const imageUrl = typeof attributes.imageUrl === "string" ? attributes.imageUrl : "";
  const markers = parseImageMarkers(responseValues?.[block.id]?.meta);

  return (
    <View>
      {renderFieldLabel(attributes.label as string, attributes.required as boolean)}
      {imageUrl ? (
        <View style={{ position: "relative", width: PAGE_CONTENT_WIDTH, marginTop: 4 }} wrap={false}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- Image do react-pdf não tem alt */}
          <Image src={constructUrl(imageUrl)} style={{ width: PAGE_CONTENT_WIDTH }} />
          {markers.map((marker, index) => (
            <View
              key={marker.id}
              style={{ ...MARKER_DOT, left: `${marker.xPercent}%`, top: `${marker.yPercent}%` }}
            >
              <Text style={MARKER_NUMBER}>{index + 1}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {markers.map((marker, index) => (
        <Text key={marker.id} style={{ ...CELL_TEXT, marginTop: 2 }}>
          {index + 1}. {marker.note || "Marcação sem legenda"}
        </Text>
      ))}
    </View>
  );
}
