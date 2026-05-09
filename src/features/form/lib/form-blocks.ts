import { FormBlocksType } from "@/features/form/types";
import { HeadingBlock } from "@/features/form/components/common/blocks/heading-block";
import { RowLayoutBlock } from "@/features/form/components/common/blocks/row-layout";
import { ParagraphBlock } from "@/features/form/components/common/blocks/paragraph-block";
import { RadioSelectBlock } from "@/features/form/components/common/blocks/radio-select-block";
import { RadioMatrixBlock } from "@/features/form/components/common/blocks/radio-matrix-block";
import { StarRatingBlock } from "@/features/form/components/common/blocks/star-rating-block";
import { TextAreaBlock } from "@/features/form/components/common/blocks/text-area-block";
import { TextFieldBlock } from "@/features/form/components/common/blocks/text-field";
import { CheckboxBlock } from "@/features/form/components/common/blocks/checkbox-block";
import { DropdownBlock } from "@/features/form/components/common/blocks/dropdown-block";
import { DatePickerBlock } from "@/features/form/components/common/blocks/date-picker-block";
import {
  UserSelectBlock,
  MultiUserSelectBlock,
} from "@/features/form/components/common/blocks/user-select-block";
import { FileUploadBlock } from "@/features/form/components/common/blocks/file-upload-block";
import { ImageUploadBlock } from "@/features/form/components/common/blocks/image-upload-block";
import { ImageDisplayBlock } from "@/features/form/components/common/blocks/image-display-block";
import { ParagraphWithTitleBlock } from "@/features/form/components/common/blocks/paragraph-with-title-block";
import {
  SignatureUserBlock,
  SignatureClientBlock,
} from "@/features/form/components/common/blocks/signature-blocks";
import { SliderBlock } from "@/features/form/components/common/blocks/slider-block";
import { UrlBlock } from "@/features/form/components/common/blocks/url-block";
import { MaskedFieldBlock } from "@/features/form/components/common/blocks/masked-field-block";
import { PageBreakBlock } from "@/features/form/components/common/blocks/page-break-block";
import { QrCodeMultiBlock } from "@/features/form/components/common/blocks/qr-code-multi-block";

export const FormBlocks: FormBlocksType = {
  RowLayout: RowLayoutBlock,
  Heading: HeadingBlock,
  Paragraph: ParagraphBlock,
  TextField: TextFieldBlock,
  TextArea: TextAreaBlock,
  RadioSelect: RadioSelectBlock,
  RadioMatrix: RadioMatrixBlock,
  StarRating: StarRatingBlock,
  Checkbox: CheckboxBlock,
  Dropdown: DropdownBlock,
  DatePicker: DatePickerBlock,
  UserSelect: UserSelectBlock,
  MultiUserSelect: MultiUserSelectBlock,
  FileUpload: FileUploadBlock,
  ImageUpload: ImageUploadBlock,
  ImageDisplay: ImageDisplayBlock,
  ParagraphWithTitle: ParagraphWithTitleBlock,
  SignatureUser: SignatureUserBlock,
  SignatureClient: SignatureClientBlock,
  Slider: SliderBlock,
  Url: UrlBlock,
  MaskedField: MaskedFieldBlock,
  PageBreak: PageBreakBlock,
  QrCodeMulti: QrCodeMultiBlock,
};
