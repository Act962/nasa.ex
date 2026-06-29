import { Text, View } from "@react-pdf/renderer";
import { styles } from "./pdf-styles";

export type PdfResponseValues = Record<
  string,
  { value: string; meta?: Record<string, unknown> }
>;

export function renderLines(text: string) {
  const lines = (text ?? "").split("\n");
  return lines.map((line, index) => (
    <Text key={index} style={styles.paragraphLine}>
      {line || " "}
    </Text>
  ));
}

export function renderHelperText(helperText?: string) {
  if (!helperText) return null;
  return <Text style={styles.helperText}>{helperText}</Text>;
}

export function renderFieldLabel(label?: string, required?: boolean) {
  if (!label) return null;
  return (
    <Text style={styles.fieldLabel}>
      {label}
      {required && <Text style={styles.requiredMark}> *</Text>}
    </Text>
  );
}

export function constructUrl(key: string): string {
  if (!key) return "";
  if (key.startsWith("http://") || key.startsWith("https://")) return key;
  if (key.startsWith("/") || key.startsWith("data:")) return key;

  const bucket = process.env.NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL;
  if (!bucket || bucket === "undefined") return `/uploads/${key.replace(/^\/+/, "")}`;

  const host = bucket.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const cleanKey = key.replace(/^\/+/, "");
  return `https://${host}/${cleanKey}`;
}

export function parseMultiValue(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {}
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
