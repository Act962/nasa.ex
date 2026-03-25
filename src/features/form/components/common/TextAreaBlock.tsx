import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  FormBlockInstance,
  FormBlockType,
  FormCategoryType,
  HandleBlurFunc,
  ObjectBlockType,
} from "@/@types/form-block.type";
import { ChevronDown, LetterTextIcon } from "lucide-react";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Switch } from "../ui/switch";
import { useEffect, useState } from "react";
import { useBuilder } from "@/context/builder-provider";
import { useForm } from "react-hook-form";

const blockCategory: FormCategoryType = "Field";
const blockType: FormBlockType = "TextArea";

type attributesType = {
  label: string;
  helperText: string;
  required: boolean;
  placeHolder: string;
  rows: number;
};

type PropertiesValidateSchemaType = z.infer<typeof propertiesValidateSchema>;

const propertiesValidateSchema = z.object({
  placeHolder: z.string().trim().optional(),
  label: z.string().trim().min(2).max(255),
  required: z.boolean().default(false),
  helperText: z.string().trim().max(255).optional(),
  rows: z.number().min(1).max(20).default(3),
});

export const TextAreaBlock: ObjectBlockType = {
  blockType,
  blockCategory,
  createInstance: (id: string) => ({
    id,
    blockType,
    attributes: {
      label: "Textarea",
      helperText: "",
      required: false,
      placeHolder: "Enter text here.",
      rows: 3, // Default rows
    },
  }),
  blockBtnElement: {
    icon: LetterTextIcon, // Replace with your custom icon
    label: "Textarea",
  },
  canvasComponent: TextAreaCanvasComponent,
  formComponent: TextAreaFormComponent,
  propertiesComponent: TextAreaPropertiesComponent,
};

type NewInstance = FormBlockInstance & {
  attributes: attributesType;
};

function TextAreaCanvasComponent({
  blockInstance,
}: {
  blockInstance: FormBlockInstance;
}) {
  const block = blockInstance as NewInstance;
  const { label, placeHolder, required, helperText, rows } = block.attributes; // Destructure attributes

  return (
    <div className="flex flex-col gap-2 w-full">
      <Label
        className="text-base !font-normal
       mb-2"
      >
        {label}
        {required && <span className="text-red-500">*</span>}
      </Label>
      <Textarea
        placeholder={placeHolder}
        rows={rows || 3} // Default row value if not provided
        cols={50} // Default column value if not provided
        readOnly
        className="resize-none !min-h-[50px] 
        !pointer-events-none cursor-default"
      />
      {helperText && (
        <p
          className="text-muted-foreground 
        text-[0.8rem]"
        >
          {helperText}
        </p>
      )}
    </div>
  );
}

function TextAreaFormComponent({
  blockInstance,
  handleBlur,
  isError: isSubmitError,
  errorMessage,
}: {
  blockInstance: FormBlockInstance;
  handleBlur?: HandleBlurFunc;
  isError?: boolean;
  errorMessage?: string;
}) {
  const block = blockInstance as NewInstance;
  const { label, placeHolder, required, helperText, rows } = block.attributes; // Destructure attributes

  const [value, setValue] = useState("");
  const [isError, setIsError] = useState(false);

  const validateField = (val: string) => {
    if (required) {
      return val.trim().length > 0; // Validation: Required fields must not be empty.
    }
    return true; // If not required, always valid.
  };
  return (
    <div className="flex flex-col gap-2 w-full">
      <Label
        className={`text-base !font-normal mb-2 ${
          isError || isSubmitError ? "text-red-500" : ""
        }`}
      >
        {label}
        {required && <span className="text-red-500">*</span>}
      </Label>
      <Textarea
        placeholder={placeHolder}
        rows={rows || 3} // Default row value if not provided
        cols={50} // Default column value if not provided
        className={`resize-none !min-h-[50px] ${
          isError || isSubmitError ? "!border-red-500" : ""
        }`}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={(event) => {
          const inputValue = event.target.value;
          const isValid = validateField(inputValue);
          setIsError(!isValid); // Set error state based on validation.
          if (handleBlur) {
            handleBlur(block.id, inputValue);
          }
        }}
      />
      {helperText && (
        <p className="text-muted-foreground text-[0.8rem]">{helperText}</p>
      )}

      {isError || isSubmitError ? (
        <p className="text-red-500 text-[0.8rem]">
          {required && value.trim().length === 0
            ? `This field is required.`
            : ""}
        </p>
      ) : (
        errorMessage && (
          <p className="text-red-500 text-[0.8rem]">{errorMessage}</p>
        )
      )}
    </div>
  );
}

function TextAreaPropertiesComponent({
  positionIndex,
  parentId,
  blockInstance,
}: {
  positionIndex?: number;
  parentId?: string;
  blockInstance: FormBlockInstance;
}) {
  const block = blockInstance as NewInstance;
  const { updateChildBlock } = useBuilder();

  // Use the form hook to manage the form state and validation
  const form = useForm<PropertiesValidateSchemaType>({
    resolver: zodResolver(propertiesValidateSchema),
    defaultValues: {
      label: block.attributes.label,
      helperText: block.attributes.helperText,
      required: block.attributes.required,
      placeHolder: block.attributes.placeHolder,
      rows: block.attributes.rows,
    },
    mode: "onBlur",
  });

  useEffect(() => {
    form.reset({
      label: block.attributes.label,
      helperText: block.attributes.helperText,
      required: block.attributes.required,
      placeHolder: block.attributes.placeHolder,
      rows: block.attributes.rows,
    });
  }, [block.attributes, form]);

  function setChanges(values: PropertiesValidateSchemaType) {
    if (!parentId) return null;
    updateChildBlock(parentId, block.id, {
      ...block,
      attributes: {
        ...block.attributes,
        ...values, // Merge new values into block's attributes
      },
    });
  }

  return (
    <div className="w-full  pb-4">
      <div className="w-full flex flex-row items-center justify-between gap-1 bg-gray-100 h-auto p-1 px-2 mb-[10px]">
        <span className="text-sm font-medium text-gray-600 tracking-wider">
          Textarea {positionIndex}
        </span>
        <ChevronDown className="w-4 h-4" />
      </div>

      <Form {...form}>
        <form
          onSubmit={(e) => e.preventDefault()}
          className="w-full space-y-3 px-4"
        >
          <FormField
            control={form.control}
            name="label"
            render={({ field }) => (
              <FormItem className="text-end">
                <div className="flex items-baseline justify-between w-full gap-2">
                  <FormLabel className="text-[13px] font-normal">
                    Label
                  </FormLabel>
                  <div className="w-full max-w-[187px]">
                    <FormControl>
                      <Input
                        {...field}
                        className="max-w-[187px]"
                        onChange={(e) => {
                          field.onChange(e);
                          setChanges({
                            ...form.getValues(),
                            label: e.target.value,
                          });
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") event.currentTarget.blur();
                        }}
                      />
                    </FormControl>
                    <FormDescription></FormDescription>
                  </div>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="helperText"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-baseline justify-between w-full gap-2">
                  <FormLabel className="text-[13px] font-normal">
                    Note
                  </FormLabel>
                  <div className="w-full max-w-[187px]">
                    <FormControl>
                      <Input
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          setChanges({
                            ...form.getValues(),
                            helperText: e.target.value,
                          });
                        }}
                      />
                    </FormControl>
                    <FormDescription className="text-[11px] mt-2 pl-1">
                      Provide a short note to guide users
                    </FormDescription>
                  </div>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="placeHolder"
            render={({ field }) => (
              <FormItem className="text-end">
                <div className="flex items-baseline justify-between w-full gap-2">
                  <FormLabel className="text-[13px] font-normal">
                    Placeholder
                  </FormLabel>
                  <div className="w-full max-w-[187px]">
                    <FormControl>
                      <Input
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          setChanges({
                            ...form.getValues(),
                            placeHolder: e.target.value,
                          });
                        }}
                      />
                    </FormControl>
                    <FormDescription></FormDescription>
                  </div>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="rows"
            render={({ field }) => (
              <FormItem className="text-end">
                <div className="flex items-baseline justify-between w-full gap-2">
                  <FormLabel className="text-[13px] font-normal">
                    Rows
                  </FormLabel>
                  <div className="w-full max-w-[187px]">
                    <FormControl>
                      <Input
                        type="number"
                        defaultValue={3}
                        onChange={(e) => {
                          field.onChange(e);
                          setChanges({
                            ...form.getValues(),
                            rows: Number(e.target.value),
                          });
                        }}
                      />
                    </FormControl>
                    <FormDescription></FormDescription>
                  </div>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="required"
            render={({ field }) => (
              <FormItem className="text-end">
                <div className="flex items-center justify-between w-full gap-2">
                  <FormLabel className="text-[13px] font-normal">
                    Required
                  </FormLabel>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={(value) => {
                        field.onChange(value);
                        setChanges({
                          ...form.getValues(),
                          required: value,
                        });
                      }}
                    />
                  </FormControl>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>
    </div>
  );
}
