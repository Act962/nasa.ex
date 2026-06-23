import type { FormBlockInstance } from "@/features/form/types";
import {
  renderHeadingBlock,
  renderParagraphBlock,
  renderParagraphWithTitleBlock,
} from "./pdf-content-blocks";
import {
  renderTextFieldBlock,
  renderTextAreaBlock,
  renderRadioSelectBlock,
  renderCheckboxBlock,
  renderDropdownBlock,
  renderDatePickerBlock,
  renderStarRatingBlock,
  renderSliderBlock,
  renderUserSelectBlock,
  renderRadioMatrixBlock,
} from "./pdf-input-blocks";
import {
  renderSignatureBlock,
  renderFileUploadBlock,
  renderQrCodeBlock,
  renderImageDisplayBlock,
} from "./pdf-media-blocks";
import { renderPageBreak, renderRowLayoutBlock } from "./pdf-layout-blocks";
import type { PdfResponseValues } from "./pdf-field-helpers";

export function renderBlock(
  block: FormBlockInstance,
  responseValues?: PdfResponseValues,
): React.ReactNode {
  switch (block.blockType) {
    case "Heading":
      return renderHeadingBlock(block);
    case "Paragraph":
      return renderParagraphBlock(block);
    case "ParagraphWithTitle":
      return renderParagraphWithTitleBlock(block);
    case "TextField":
    case "MaskedField":
    case "Url":
      return renderTextFieldBlock(block, responseValues);
    case "TextArea":
      return renderTextAreaBlock(block, responseValues);
    case "RadioSelect":
      return renderRadioSelectBlock(block, responseValues);
    case "Checkbox":
      return renderCheckboxBlock(block, responseValues);
    case "Dropdown":
      return renderDropdownBlock(block, responseValues);
    case "DatePicker":
      return renderDatePickerBlock(block, responseValues);
    case "StarRating":
      return renderStarRatingBlock(block, responseValues);
    case "Slider":
      return renderSliderBlock(block, responseValues);
    case "UserSelect":
    case "MultiUserSelect":
      return renderUserSelectBlock(block, responseValues);
    case "RadioMatrix":
      return renderRadioMatrixBlock(block, responseValues);
    case "SignatureUser":
    case "SignatureClient":
      return renderSignatureBlock(block);
    case "FileUpload":
    case "ImageUpload":
      return renderFileUploadBlock(block);
    case "QrCodeMulti":
      return renderQrCodeBlock(block);
    case "ImageDisplay":
      return renderImageDisplayBlock(block);
    case "PageBreak":
      return renderPageBreak();
    case "RowLayout":
      return renderRowLayoutBlock(block, renderBlock, responseValues);
    default:
      return null;
  }
}
