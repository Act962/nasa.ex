import { Image, Text, View } from "@react-pdf/renderer";
import type { FormBlockInstance } from "@/features/form/types";
import { styles } from "./pdf-styles";
import { renderFieldLabel, renderHelperText, constructUrl } from "./pdf-field-helpers";

export function renderSignatureBlock(block: FormBlockInstance) {
  const attrs = (block.attributes ?? {}) as Record<string, any>;
  const defaultLabel =
    block.blockType === "SignatureUser"
      ? "Assinatura do Responsável"
      : "Assinatura do Cliente";

  return (
    <View>
      {renderFieldLabel(attrs.label || defaultLabel, attrs.required)}
      {renderHelperText(attrs.helperText)}
      <View style={styles.signatureBox}>
        <Text style={styles.signatureLabel}>Assine aqui</Text>
      </View>
    </View>
  );
}

type PdfResponseValues = import("./pdf-field-helpers").PdfResponseValues;

export function renderFileUploadBlock(
  block: FormBlockInstance,
  responseValues?: PdfResponseValues,
) {
  const attrs = (block.attributes ?? {}) as Record<string, any>;
  const filledValue = responseValues?.[block.id]?.value ?? "";

  const isImage = block.blockType === "ImageUpload";
  const itemUrls = filledValue
    ? filledValue.split(",").map((u: string) => u.trim()).filter(Boolean)
    : [];
  const itemCount = itemUrls.length;
  const label = isImage
    ? itemCount > 0
      ? `${itemCount} imagem${itemCount > 1 ? "ns" : ""} em anexo`
      : "[ Imagem ]"
    : itemCount > 0
      ? `${itemCount} arquivo${itemCount > 1 ? "s" : ""} em anexo`
      : "[ Arquivo ]";

  return (
    <View>
      {renderFieldLabel(attrs.label, attrs.required)}
      {renderHelperText(attrs.helperText)}
      <View style={styles.inputBox}>
        <Text style={itemCount > 0 ? styles.filledValue : styles.qrPlaceholderText}>
          {label}
        </Text>
      </View>
    </View>
  );
}

export function renderQrCodeBlock(block: FormBlockInstance) {
  const attrs = (block.attributes ?? {}) as Record<string, any>;

  return (
    <View>
      {attrs.helperText ? (
        <Text style={styles.fieldLabel}>{attrs.helperText}</Text>
      ) : null}
      <View style={styles.qrPlaceholder}>
        <Text style={styles.qrPlaceholderText}>
          [QR Code — gerado no preenchimento]
        </Text>
      </View>
    </View>
  );
}

export function renderImageDisplayBlock(block: FormBlockInstance) {
  const attrs = (block.attributes ?? {}) as Record<string, any>;
  const rawUrl: string = attrs.url ?? "";
  if (!rawUrl) return null;

  const resolvedUrl = constructUrl(rawUrl);
  const fitToPage = attrs.fitToPage === true;

  const imageStyle = fitToPage
    ? { width: 515, objectFit: "contain" as const }
    : {
        width: attrs.width ? Math.min(Number(attrs.width), 515) : 200,
        height: attrs.height ? Math.min(Number(attrs.height), 400) : undefined,
        objectFit: "contain" as const,
      };

  return (
    <View style={styles.imageContainer}>
      <Image src={resolvedUrl} style={imageStyle} />
    </View>
  );
}
