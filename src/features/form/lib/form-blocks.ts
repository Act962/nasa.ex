import { FormBlocksType } from "@/features/form/types";
import { HeadingBlock } from "@/features/form/components/common/blocks/heading-block";
import { RowLayoutBlock } from "@/features/form/components/common/blocks/row-layout";
import { ParagraphBlock } from "@/features/form/components/common/blocks/paragraph-block";
import { RadioSelectBlock } from "@/features/form/components/common/blocks/radio-select-block";
import { StarRatingBlock } from "@/features/form/components/common/blocks/star-rating-block";
import { TextAreaBlock } from "@/features/form/components/common/blocks/text-area-block";
import { TextFieldBlock } from "@/features/form/components/common/blocks/text-field";

export const FormBlocks: FormBlocksType = {
  RowLayout: RowLayoutBlock,
  Heading: HeadingBlock,
  Paragraph: ParagraphBlock,
  TextField: TextFieldBlock,
  TextArea: TextAreaBlock,
  RadioSelect: RadioSelectBlock,
  StarRating: StarRatingBlock,
};
