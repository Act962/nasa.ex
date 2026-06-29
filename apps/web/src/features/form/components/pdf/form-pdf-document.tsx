import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { FormBlockInstance } from "@/features/form/types";
import { styles } from "./pdf-styles";
import { renderBlock } from "./pdf-render-block";
import type { PdfResponseValues } from "./pdf-field-helpers";

type FormPdfDocumentProps = {
  blocks: FormBlockInstance[];
  formName: string;
  leadName?: string;
  responseValues?: PdfResponseValues;
};

export function FormPdfDocument({
  blocks,
  formName,
  leadName,
  responseValues,
}: FormPdfDocumentProps) {
  return (
    <Document
      language="pt-BR"
      title={formName}
      creator="NASA Platform"
      producer="NASA Platform"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.pageHeader} fixed>
          <Text style={styles.formTitle}>{formName}</Text>
          {leadName && <Text style={styles.leadName}>Lead: {leadName}</Text>}
        </View>

        {blocks.map((block) => {
          const rendered = renderBlock(block, responseValues);
          if (!rendered) return null;
          return (
            <View key={block.id} style={styles.block}>
              {rendered}
            </View>
          );
        })}

        <View style={styles.pageFooter} fixed>
          <Text style={styles.footerText}>{formName}</Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) =>
              `${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
