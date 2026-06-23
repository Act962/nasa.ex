import { Image, Text, View } from "@react-pdf/renderer";
import type { FormBlockInstance } from "@/features/form/types";
import { styles } from "./pdf-styles";
import { renderFieldLabel, renderHelperText } from "./pdf-field-helpers";

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

export function renderFileUploadBlock(block: FormBlockInstance) {
  const attrs = (block.attributes ?? {}) as Record<string, any>;
  const placeholder =
    block.blockType === "ImageUpload" ? "[ Imagem ]" : "[ Arquivo ]";

  return (
    <View>
      {renderFieldLabel(attrs.label, attrs.required)}
      {renderHelperText(attrs.helperText)}
      <View style={styles.inputBox}>
        <Text style={styles.qrPlaceholderText}>{placeholder}</Text>
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
  const url: string = attrs.url ?? "";
  if (!url) return null;

  return (
    <View style={styles.imageContainer}>
      <Image
        src={url}
        style={{
          width: attrs.width ? Math.min(attrs.width, 400) : 200,
          height: attrs.height ? Math.min(attrs.height, 300) : "auto",
          objectFit: "contain",
        }}
      />
    </View>
  );
}
