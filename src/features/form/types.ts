import { Form, FormSettings } from "@/generated/prisma/client";

export type FormCategoryType = "Layout" | "Field";

export type FormBlockType =
  | "RowLayout"
  | "RadioSelect"
  | "TextField"
  | "TextArea"
  | "StarRating"
  | "Heading"
  | "Paragraph";

export type HandleBlurFuncWithTagId = (
  key: string,
  value: { value: string; tagId: string | null },
) => void;

export type FormErrorsType = {
  [key: string]: string;
};

export type HandleBlurValue =
  | string
  | { value: string; tagId: string | null }
  | Record<string, unknown>; // extensível para o futuro

export type FieldValue = {
  value: string;
  meta?: Record<string, unknown>;
};

export type HandleBlurFunc = (key: string, value: FieldValue) => void;

export type ObjectBlockType = {
  blockCategory: FormCategoryType;
  blockType: FormBlockType;

  createInstance: (id: string) => FormBlockInstance;

  blockBtnElement: {
    icon: React.ElementType;
    label: string;
  };

  canvasComponent: React.FC<{
    blockInstance: FormBlockInstance;
    settings?: FormSettings | null;
  }>;
  formComponent: React.FC<{
    blockInstance: FormBlockInstance;
    isError?: boolean;
    errorMessage?: string;
    handleBlur?: HandleBlurFunc;
    formErrors?: FormErrorsType;
    settings?: FormSettings | null;
  }>;

  propertiesComponent: React.FC<{
    positionIndex?: number;
    parentId?: string;
    blockInstance: FormBlockInstance;
  }>;
};

export type FormBlockInstance = {
  id: string;
  blockType: FormBlockType;
  attributes?: Record<string, any>;
  childblocks?: FormBlockInstance[];
  isLocked?: boolean;
};

export type FormBlocksType = {
  [key in FormBlockType]: ObjectBlockType;
};

export type FormWithSettings = Form & { settings: FormSettings | null };
