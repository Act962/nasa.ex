import { Text, View } from "@react-pdf/renderer";
import type { FormBlockInstance } from "@/features/form/types";
import { styles } from "./pdf-styles";
import {
  renderFieldLabel,
  renderHelperText,
  parseMultiValue,
  type PdfResponseValues,
} from "./pdf-field-helpers";

export function renderTextFieldBlock(
  block: FormBlockInstance,
  responseValues?: PdfResponseValues,
) {
  const attrs = (block.attributes ?? {}) as Record<string, unknown>;
  const filledValue = responseValues?.[block.id]?.value;
  return (
    <View>
      {renderFieldLabel(attrs.label as string, attrs.required as boolean)}
      {renderHelperText(attrs.helperText as string)}
      <View style={styles.inputLine}>
        {filledValue ? (
          <Text style={styles.filledValue}>{filledValue}</Text>
        ) : null}
      </View>
    </View>
  );
}

export function renderTextAreaBlock(
  block: FormBlockInstance,
  responseValues?: PdfResponseValues,
) {
  const attrs = (block.attributes ?? {}) as Record<string, unknown>;
  const filledValue = responseValues?.[block.id]?.value;
  return (
    <View>
      {renderFieldLabel(attrs.label as string, attrs.required as boolean)}
      {renderHelperText(attrs.helperText as string)}
      <View style={styles.inputBox}>
        {filledValue ? (
          <Text style={styles.filledValue}>{filledValue}</Text>
        ) : null}
      </View>
    </View>
  );
}

export function renderRadioSelectBlock(
  block: FormBlockInstance,
  responseValues?: PdfResponseValues,
) {
  const attrs = (block.attributes ?? {}) as Record<string, unknown>;
  const options = (attrs.options as { value: string }[]) ?? [];
  const isMultiple = attrs.allowMultiple === true;
  const filledValue = responseValues?.[block.id]?.value ?? "";
  const selectedValues = filledValue ? parseMultiValue(filledValue) : [];

  return (
    <View>
      {renderFieldLabel(attrs.label as string, attrs.required as boolean)}
      {renderHelperText(attrs.helperText as string)}
      {options.map((option, index) => {
        const isSelected = selectedValues.includes(option.value);
        return (
          <View key={index} style={styles.optionRow}>
            <View
              style={
                isSelected
                  ? isMultiple
                    ? styles.filledOptionSquare
                    : styles.filledOptionCircle
                  : isMultiple
                    ? styles.optionSquare
                    : styles.optionCircle
              }
            />
            <Text style={styles.optionText}>{option.value}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function renderCheckboxBlock(
  block: FormBlockInstance,
  responseValues?: PdfResponseValues,
) {
  const attrs = (block.attributes ?? {}) as Record<string, unknown>;
  const options = (attrs.options as { value: string }[]) ?? [];
  const filledValue = responseValues?.[block.id]?.value ?? "";
  const selectedValues = filledValue ? parseMultiValue(filledValue) : [];

  if (options.length > 0) {
    return (
      <View>
        {renderFieldLabel(attrs.label as string, attrs.required as boolean)}
        {renderHelperText(attrs.helperText as string)}
        {options.map((option, index) => {
          const isSelected = selectedValues.includes(option.value);
          return (
            <View key={index} style={styles.optionRow}>
              <View
                style={
                  isSelected ? styles.filledOptionSquare : styles.optionSquare
                }
              />
              <Text style={styles.optionText}>{option.value}</Text>
            </View>
          );
        })}
      </View>
    );
  }

  const isSingleChecked = filledValue === "true";
  return (
    <View style={styles.optionRow}>
      <View
        style={isSingleChecked ? styles.filledOptionSquare : styles.optionSquare}
      />
      {attrs.label ? (
        <Text style={styles.optionText}>{attrs.label as string}</Text>
      ) : null}
    </View>
  );
}

export function renderDropdownBlock(
  block: FormBlockInstance,
  responseValues?: PdfResponseValues,
) {
  const attrs = (block.attributes ?? {}) as Record<string, unknown>;
  const options = (attrs.options as { value: string }[]) ?? [];
  const filledValue = responseValues?.[block.id]?.value;

  return (
    <View>
      {renderFieldLabel(attrs.label as string, attrs.required as boolean)}
      {renderHelperText(attrs.helperText as string)}
      <View style={styles.dropdownBox}>
        <Text
          style={
            filledValue ? styles.filledValue : styles.dropdownPlaceholder
          }
        >
          {filledValue ?? (options.length > 0 ? `${options.length} opção(ões)` : "Selecione...")}
        </Text>
        <Text style={styles.dropdownArrow}>▾</Text>
      </View>
    </View>
  );
}

export function renderDatePickerBlock(
  block: FormBlockInstance,
  responseValues?: PdfResponseValues,
) {
  const attrs = (block.attributes ?? {}) as Record<string, unknown>;
  const filledValue = responseValues?.[block.id]?.value;

  let displayDate = filledValue ?? "";
  if (filledValue) {
    try {
      const date = new Date(filledValue);
      if (!isNaN(date.getTime())) {
        const day = String(date.getDate()).padStart(2, "0");
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const year = date.getFullYear();
        displayDate = attrs.withTime
          ? `${day}/${month}/${year} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
          : `${day}/${month}/${year}`;
      }
    } catch {}
  }

  return (
    <View>
      {renderFieldLabel(attrs.label as string, attrs.required as boolean)}
      {renderHelperText(attrs.helperText as string)}
      <View style={styles.dateBox}>
        <Text style={displayDate ? styles.filledValue : styles.dateText}>
          {displayDate || (attrs.withTime ? "DD/MM/AAAA HH:MM" : "DD/MM/AAAA")}
        </Text>
      </View>
    </View>
  );
}

export function renderStarRatingBlock(
  block: FormBlockInstance,
  responseValues?: PdfResponseValues,
) {
  const attrs = (block.attributes ?? {}) as Record<string, unknown>;
  const maxStars = (attrs.maxStars as number) ?? 5;
  const filledValue = responseValues?.[block.id]?.value;
  const rating = filledValue ? parseInt(filledValue, 10) : 0;

  return (
    <View>
      {renderFieldLabel(attrs.label as string, attrs.required as boolean)}
      {renderHelperText(attrs.helperText as string)}
      <View style={styles.starsRow}>
        {Array.from({ length: maxStars }).map((_, index) => (
          <Text
            key={index}
            style={index < rating ? styles.starFilled : styles.starText}
          >
            {index < rating ? "★" : "☆"}
          </Text>
        ))}
      </View>
    </View>
  );
}

export function renderSliderBlock(
  block: FormBlockInstance,
  responseValues?: PdfResponseValues,
) {
  const attrs = (block.attributes ?? {}) as Record<string, unknown>;
  const min = (attrs.min as number) ?? 0;
  const max = (attrs.max as number) ?? 100;
  const unit = (attrs.unit as string) ?? "";
  const filledValue = responseValues?.[block.id]?.value;

  return (
    <View>
      {renderFieldLabel(attrs.label as string, attrs.required as boolean)}
      {renderHelperText(attrs.helperText as string)}
      {filledValue ? (
        <Text style={[styles.filledValue, { marginTop: 4 }]}>
          {filledValue}
          {unit}
        </Text>
      ) : null}
      <View style={styles.sliderTrack} />
      <View style={styles.sliderRange}>
        <Text style={styles.sliderRangeText}>
          {min}
          {unit}
        </Text>
        <Text style={styles.sliderRangeText}>
          {max}
          {unit}
        </Text>
      </View>
    </View>
  );
}

export function renderUserSelectBlock(
  block: FormBlockInstance,
  responseValues?: PdfResponseValues,
) {
  const attrs = (block.attributes ?? {}) as Record<string, unknown>;
  const isMulti = block.blockType === "MultiUserSelect";
  const filledValue = responseValues?.[block.id]?.value;

  return (
    <View>
      {renderFieldLabel(attrs.label as string, attrs.required as boolean)}
      {renderHelperText(attrs.helperText as string)}
      <View style={styles.dropdownBox}>
        <Text
          style={
            filledValue ? styles.filledValue : styles.dropdownPlaceholder
          }
        >
          {filledValue ??
            (isMulti ? "Selecione usuários..." : "Selecione um usuário...")}
        </Text>
        <Text style={styles.dropdownArrow}>▾</Text>
      </View>
    </View>
  );
}

export function renderRadioMatrixBlock(
  block: FormBlockInstance,
  responseValues?: PdfResponseValues,
) {
  const attrs = (block.attributes ?? {}) as Record<string, unknown>;
  const rows = (attrs.rows as { id: string; label: string }[]) ?? [];
  const columns = (attrs.columns as { id: string; label: string }[]) ?? [];

  let matrixAnswer: Record<string, string> = {};
  const filledValue = responseValues?.[block.id]?.value;
  if (filledValue) {
    try {
      matrixAnswer = JSON.parse(filledValue) as Record<string, string>;
    } catch {}
  }

  return (
    <View>
      {renderFieldLabel(attrs.label as string, attrs.required as boolean)}
      {renderHelperText(attrs.helperText as string)}
      <View style={styles.matrixTable}>
        <View style={styles.matrixHeaderRow}>
          <View style={styles.matrixLabelCell}>
            <Text> </Text>
          </View>
          {columns.map((col) => (
            <View key={col.id} style={styles.matrixHeaderCell}>
              <Text style={{ fontSize: 8.5, fontFamily: "Helvetica-Bold", color: "#374151" }}>
                {col.label}
              </Text>
            </View>
          ))}
        </View>
        {rows.map((row, rowIndex) => (
          <View
            key={row.id}
            style={
              rowIndex === rows.length - 1
                ? styles.matrixRowLast
                : styles.matrixRow
            }
          >
            <View style={styles.matrixLabelCell}>
              <Text style={{ fontSize: 8.5, color: "#374151" }}>
                {row.label}
              </Text>
            </View>
            {columns.map((col) => {
              const isSelected = matrixAnswer[row.id] === col.id;
              return (
                <View key={col.id} style={styles.matrixCell}>
                  <View
                    style={
                      isSelected
                        ? styles.filledOptionCircle
                        : styles.optionCircle
                    }
                  />
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}
