import { EyeIcon, Link2, Palette, QrCode, type LucideIcon } from "lucide-react";

export type LinnkerEditorSection = "links" | "appearance" | "qrcode" | "scans";

export const LINNKER_EDITOR_SECTIONS: Record<
  LinnkerEditorSection,
  { label: string; icon: LucideIcon }
> = {
  links: { label: "Links", icon: Link2 },
  appearance: { label: "Aparência", icon: Palette },
  qrcode: { label: "QR Code", icon: QrCode },
  scans: { label: "Visitas", icon: EyeIcon },
};

export const LINNKER_EDITOR_SECTION_ORDER: LinnkerEditorSection[] = ["links", "appearance", "qrcode", "scans"];

export function isLinnkerEditorSection(value: string): value is LinnkerEditorSection {
  return Object.hasOwn(LINNKER_EDITOR_SECTIONS, value);
}
