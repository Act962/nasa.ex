import { Text, View } from "@react-pdf/renderer";
import type { FormBlockInstance } from "@/features/form/types";
import { styles } from "./pdf-styles";
import { renderLines } from "./pdf-field-helpers";

export function renderHeadingBlock(block: FormBlockInstance) {
  const attrs = (block.attributes ?? {}) as Record<string, any>;

  const fontSizeMap: Record<string, number> = {
    small: 11,
    medium: 13,
    large: 16,
    "x-large": 19,
    "2x-large": 22,
    "4x-large": 26,
  };
  const levelFontSize: Record<number, number> = {
    1: 20,
    2: 17,
    3: 14,
    4: 12,
    5: 11,
    6: 10,
  };
  const resolvedSize =
    fontSizeMap[attrs.fontSize] ?? levelFontSize[attrs.level] ?? 14;

  return (
    <Text
      style={[
        styles.headingText,
        {
          fontSize: resolvedSize,
          fontFamily:
            attrs.fontWeight === "bold" || attrs.fontWeight === "bolder"
              ? "Helvetica-Bold"
              : "Helvetica",
        },
      ]}
    >
      {attrs.label ?? ""}
    </Text>
  );
}

export function renderParagraphBlock(block: FormBlockInstance) {
  const attrs = (block.attributes ?? {}) as Record<string, any>;

  const fontSizeMap: Record<string, number> = {
    small: 9,
    medium: 10.5,
    large: 12,
  };

  return (
    <View
      style={[
        styles.paragraphText,
        { fontSize: fontSizeMap[attrs.fontSize] ?? 9.5 },
      ]}
    >
      {renderLines(attrs.text ?? "")}
    </View>
  );
}

export function renderParagraphWithTitleBlock(block: FormBlockInstance) {
  const attrs = (block.attributes ?? {}) as Record<string, any>;

  return (
    <View>
      {attrs.title ? (
        <Text style={[styles.headingText, { fontSize: 12, marginBottom: 4 }]}>
          {attrs.title}
        </Text>
      ) : null}
      <View style={styles.paragraphText}>
        {renderLines(attrs.body ?? "")}
      </View>
    </View>
  );
}
