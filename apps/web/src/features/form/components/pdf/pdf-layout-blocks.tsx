import { View } from "@react-pdf/renderer";
import type { FormBlockInstance } from "@/features/form/types";
import { styles } from "./pdf-styles";
import type { PdfResponseValues } from "./pdf-field-helpers";

type RenderBlockFn = (
  block: FormBlockInstance,
  responseValues?: PdfResponseValues,
) => React.ReactNode;

export function renderPageBreak() {
  return <View break />;
}

export function renderRowLayoutBlock(
  block: FormBlockInstance,
  renderBlock: RenderBlockFn,
  responseValues?: PdfResponseValues,
) {
  const childblocks: FormBlockInstance[] = block.childblocks ?? [];
  if (childblocks.length === 0) return null;

  return (
    <View style={styles.rowContainer}>
      {childblocks.map((child) => (
        <View key={child.id} style={styles.rowChild}>
          {renderBlock(child, responseValues)}
        </View>
      ))}
    </View>
  );
}
