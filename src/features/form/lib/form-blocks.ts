import { FormBlocksType } from "@/features/form/types";
import { HeadingBlock } from "@/features/form/components/common/HeadingBlock";
import { RowLayoutBlock } from "@/features/form/components/common/layouts/RowLayout";
import { ParagraphBlock } from "@/features/form/components/common/ParagraphBlock";
import { RadioSelectBlock } from "@/features/form/components/common/RadioSelectBlock";
import { StarRatingBlock } from "@/features/form/components/common/StarRatingBlock";
import { TextAreaBlock } from "@/features/form/components/common/TextAreaBlock";
import { TextFieldBlock } from "@/features/form/components/common/TextField";

export const FormBlocks: FormBlocksType = {
  RowLayout: RowLayoutBlock,
  Heading: HeadingBlock,
  Paragraph: ParagraphBlock,
  TextField: TextFieldBlock,
  TextArea: TextAreaBlock,
  RadioSelect: RadioSelectBlock,
  StarRating: StarRatingBlock,
};
