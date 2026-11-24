import "server-only";
import { Document, Font, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { formatDecimalToMoney } from "@/utils/mask-money";
import { reaisPorExtenso } from "@/features/forge/utils/reais-por-extenso";
import { describeSalePayment } from "@/features/forge/lib/sale-payment";
import type { SaleReceiptData } from "@/features/forge/components/public/sale-receipt";

// PDF do recibo para os comprovantes do Financeiro (spec 0151, RF-11). Mesmo conteúdo da página pública,
// em layout simples: sem logo, para não depender de baixar imagem no servidor.

// Sem isso o react-pdf hifeniza palavras em português no meio da linha.
Font.registerHyphenationCallback((word) => [word]);

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const INK = "#111111";
const MUTED = "#555555";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, color: INK, fontFamily: "Helvetica" },
  header: { flexDirection: "row", justifyContent: "space-between", backgroundColor: INK, color: "#ffffff", padding: 18, borderRadius: 6 },
  companyName: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  title: { fontSize: 24, fontFamily: "Helvetica-Bold", letterSpacing: 3, textAlign: "right" },
  headerMuted: { fontSize: 9, color: "#cccccc", textAlign: "right", marginTop: 2 },
  numberRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 20, marginBottom: 14 },
  numberText: { fontSize: 13, fontFamily: "Helvetica-Bold" },
  totalBadge: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  paragraph: { lineHeight: 1.6, marginBottom: 14 },
  bold: { fontFamily: "Helvetica-Bold" },
  table: { borderWidth: 1.5, borderColor: INK, borderRadius: 4 },
  tableHeader: { flexDirection: "row", backgroundColor: INK, color: "#ffffff", padding: 8, fontFamily: "Helvetica-Bold", fontSize: 10 },
  tableRow: { flexDirection: "row", padding: 8, borderTopWidth: 0.5, borderTopColor: "#cccccc" },
  colName: { flex: 1 },
  colQty: { width: 40, textAlign: "center" },
  colValue: { width: 90, textAlign: "right" },
  description: { fontSize: 9, color: MUTED, marginTop: 2 },
  totalRow: { flexDirection: "row", padding: 8, borderTopWidth: 0.5, borderTopColor: "#cccccc", backgroundColor: "#f2f2f2", fontFamily: "Helvetica-Bold" },
  signature: { marginTop: 50, alignItems: "center" },
  signatureLine: { width: 220, borderTopWidth: 1.5, borderTopColor: INK, marginBottom: 6 },
  footer: { marginTop: 30, fontSize: 9, color: MUTED, textAlign: "center" },
});

function ReceiptPdfDocument({ receipt }: { receipt: SaleReceiptData & { number: number } }) {
  const subtotal = receipt.items.reduce((sum, item) => sum + item.quantity * item.unitValue, 0);
  const discount = receipt.items.reduce((sum, item) => sum + item.discount, 0) + receipt.proposalDiscount;
  const total = subtotal - discount;
  const paidAt = new Date(receipt.paidAt);
  const organization = receipt.organization;
  const city = [organization.city, organization.state].filter(Boolean).join(" - ");
  const payment = describeSalePayment(receipt.paymentMethod, receipt.installments);
  const purchased = receipt.items.map((item) => `${item.quantity} ${item.name}`).join(", ");

  return (
    <Document title={`Recibo ${String(receipt.number).padStart(4, "0")} - ${organization.name}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.companyName}>{organization.name}</Text>
          <View>
            <Text style={styles.title}>RECIBO</Text>
            {organization.cnpj ? <Text style={styles.headerMuted}>CNPJ {organization.cnpj}</Text> : null}
            <Text style={styles.headerMuted}>{[city, organization.contactPhone].filter(Boolean).join(" | ")}</Text>
          </View>
        </View>

        <View style={styles.numberRow}>
          <Text style={styles.numberText}>Nº {String(receipt.number).padStart(4, "0")}</Text>
          <Text style={styles.totalBadge}>{formatDecimalToMoney(total)}</Text>
        </View>

        <Text style={styles.paragraph}>
          Recebemos de <Text style={styles.bold}>{receipt.client?.name ?? "________________"}</Text>, CPF/CNPJ{" "}
          <Text style={styles.bold}>{receipt.client?.document ?? "________________"}</Text>
          {receipt.client?.address ? `, endereço ${receipt.client.address}` : ""}, a importância de{" "}
          <Text style={styles.bold}>{formatDecimalToMoney(total)}</Text>{" "}
          <Text style={styles.bold}>{`(${reaisPorExtenso(total)})`}</Text>, referente à
          compra de {purchased}, conforme abaixo.
        </Text>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.colName}>DESCRIÇÃO</Text>
            <Text style={styles.colQty}>QTD</Text>
            <Text style={styles.colValue}>VALOR</Text>
          </View>
          {receipt.items.map((item, index) => (
            <View key={index} style={styles.tableRow}>
              <View style={styles.colName}>
                <Text>{item.name}</Text>
                {item.description ? <Text style={styles.description}>{item.description}</Text> : null}
              </View>
              <Text style={styles.colQty}>{item.quantity}</Text>
              <Text style={styles.colValue}>{formatDecimalToMoney(item.quantity * item.unitValue)}</Text>
            </View>
          ))}
          {discount > 0 ? (
            <View style={styles.tableRow}>
              <Text style={styles.colName}>Desconto</Text>
              <Text style={styles.colValue}>- {formatDecimalToMoney(discount)}</Text>
            </View>
          ) : null}
          <View style={styles.totalRow}>
            <Text style={styles.colName}>TOTAL RECEBIDO</Text>
            <Text style={styles.colValue}>{formatDecimalToMoney(total)}</Text>
          </View>
        </View>

        {payment ? (
          <Text style={[styles.paragraph, { marginTop: 14 }]}>
            Forma de pagamento: <Text style={styles.bold}>{payment}</Text>
          </Text>
        ) : null}
        <Text style={styles.paragraph}>
          {organization.city ?? "Local"}, {paidAt.getDate()} de {MONTHS[paidAt.getMonth()]} de {paidAt.getFullYear()}.
        </Text>

        <View style={styles.signature}>
          <View style={styles.signatureLine} />
          <Text style={styles.bold}>{organization.name}</Text>
          {organization.cnpj ? <Text style={styles.description}>CNPJ {organization.cnpj}</Text> : null}
        </View>

        {organization.addressLine ? <Text style={styles.footer}>{[organization.addressLine, city].filter(Boolean).join(" | ")}</Text> : null}
      </Page>
    </Document>
  );
}

export function renderReceiptPdf(receipt: SaleReceiptData & { number: number }): Promise<Buffer> {
  return renderToBuffer(<ReceiptPdfDocument receipt={receipt} />);
}
