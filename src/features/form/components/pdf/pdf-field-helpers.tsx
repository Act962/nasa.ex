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
