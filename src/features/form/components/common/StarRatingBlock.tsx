import { Rating } from "@smastrom/react-rating";
import { ChevronDown, StarIcon } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useForm } from "react-hook-form";
import {
  FormBlockInstance,
  FormBlockType,
  FormCategoryType,
  HandleBlurFunc,
  ObjectBlockType,
} from "@/@types/form-block.type";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useBuilder } from "@/context/builder-provider";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

import { defaultPrimaryColor } from "@/constant";
import { Label } from "../ui/label";

import "@smastrom/react-rating/style.css";
import { useEffect, useState } from "react";

const blockCategory: FormCategoryType = "Field";
const blockType: FormBlockType = "StarRating";

type attributesType = {
  label: string;
  helperText: string;
  required: boolean;
  maxStars: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
};

type PropertiesValidateSchemaType = z.infer<typeof propertiesValidateSchema>;

const propertiesValidateSchema = z.object({
  label: z.string().trim().min(2).max(255),
  maxStars: z.number().min(1),
  required: z.boolean().default(false),
});

export const StarRatingBlock: ObjectBlockType = {
  blockType,
  blockCategory,
  createInstance: (id: string) => ({
    id,
    blockType: "StarRating",
    attributes: {
      label: "Star Rating",
      helperText: "",
      maxStars: 5, // Default to 5 stars
      required: true,
    },
  }),
  blockBtnElement: {
    icon: StarIcon, // Replace with your star icon
    label: "Star Rating",
  },
  canvasComponent: StarRatingCanvasComponent,
  formComponent: StarRatingFormComponent,
  propertiesComponent: StarRatingPropertiesComponent,
};

type NewInstance = FormBlockInstance & {
  attributes: attributesType;
};

function StarRatingCanvasComponent({
  blockInstance,
}: {
  blockInstance: FormBlockInstance;
}) {
  const block = blockInstance as NewInstance;
  const { label, required, maxStars, helperText } = block.attributes; // Destructure attributes

  return (
    <div className="flex flex-col gap-2 w-full">
      <Label className="text-base !font-normal mb-1">
        {label}
        {required && <span className="text-red-500">*</span>}
      </Label>
      <div className="flex items-center gap-10 justify-center">
        <Rating
          style={{ maxWidth: 420 }}
          value={0}
          items={maxStars}
          radius="large"
          spaceBetween="large"
          readOnly={true}
          className="!fill-primary"
          itemStyles={{
            itemShapes: StarDrawing,
            activeFillColor: defaultPrimaryColor,
            inactiveFillColor: "#fff",
            activeStrokeColor: defaultPrimaryColor,
            inactiveStrokeColor: defaultPrimaryColor,
            itemStrokeWidth: 1,
          }}
        />
      </div>
      {helperText && (
        <p className="text-muted-foreground text-[0.8rem]">{helperText}</p>
      )}
    </div>
  );
}

function StarRatingFormComponent({
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
  const block = blockInstance as any;
  const { label, required, maxStars, helperText } = block.attributes;

  const [rating, setRating] = useState(0);
  const [isError, setIsError] = useState(false);

  const handleStarChange = (newRating: number) => {
    setRating(newRating);
    const isValid = validateField(newRating);
    setIsError(!isValid);

    if (handleBlur) {
      handleBlur(block.id, newRating?.toString());
    }
  };

  // Function to validate the field
  const validateField = (newRating: number) => {
    if (required) {
      return newRating > 0;
    }
    return true;
  };

  return (
    <div className="flex flex-col gap-2 w-full mb-1">
      <Label
        className={`text-base !font-normal mb-1 ${
          isError || isSubmitError ? "text-red-500" : ""
        }`}
      >
        {label}
        {required && <span className="text-red-500">*</span>}
      </Label>
      <div className="flex items-center gap-10 justify-center">
        {/* Render stars */}
        <Rating
          style={{ maxWidth: 420 }}
          value={rating}
          onChange={handleStarChange} // Update the rating when a star is selected
          items={maxStars}
          readOnly={false}
          className="!fill-primary"
          radius="large"
          spaceBetween="large"
          itemStyles={{
            itemShapes: StarDrawing,
            activeFillColor: defaultPrimaryColor,
            inactiveFillColor: "#fff",
            activeStrokeColor: defaultPrimaryColor,
            inactiveStrokeColor:
              isError || isSubmitError ? "#ef4444" : defaultPrimaryColor,
            itemStrokeWidth: 1,
          }}
        />
      </div>
      {isError || isSubmitError ? (
        <p className="text-red-500 text-[0.8rem]">
          {required && rating === 0 ? "This field is required." : ""}
        </p>
      ) : (
        errorMessage && (
          <p className="text-red-500 text-[0.8rem]">{errorMessage}</p>
        )
      )}

      {helperText && (
        <p className="text-muted-foreground text-[0.8rem]">{helperText}</p>
      )}
    </div>
  );
}

function StarRatingPropertiesComponent({
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

  // Initialize the form with validation and default values
  const form = useForm<PropertiesValidateSchemaType>({
    resolver: zodResolver(propertiesValidateSchema),
    defaultValues: {
      label: block.attributes.label,
      required: block.attributes.required,
      maxStars: Number(block.attributes.maxStars) || 5,
    },
    mode: "onBlur",
  });

  // Reset form values when block attributes change
  useEffect(() => {
    form.reset({
      label: block.attributes.label,
      required: block.attributes.required,
      maxStars: Number(block.attributes.maxStars) || 5,
    });
  }, [block.attributes, form]);

  // Function to update block attributes
  function setChanges(values: PropertiesValidateSchemaType) {
    if (!parentId) return null;

    updateChildBlock(parentId, block.id, {
      ...block,
      attributes: {
        ...block.attributes,
        ...values,
      },
    });
  }

  return (
    <div className="w-full pb-4">
      <div className="w-full flex flex-row items-center justify-between gap-1 bg-gray-100 h-auto p-1 px-2 mb-[10px]">
        <span className="text-sm font-medium text-gray-600 tracking-wider">
          Rating {positionIndex}
        </span>
        <ChevronDown className="w-4 h-4" />
      </div>

      <Form {...form}>
        <form
          onSubmit={(e) => e.preventDefault()}
          className="w-full space-y-3 px-4"
        >
          {/* Label Field */}
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
                        onChange={(e) => {
                          field.onChange(e);
                          setChanges({
                            ...form.getValues(),
                            label: e.target.value,
                          });
                        }}
                      />
                    </FormControl>
                  </div>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Required Field */}
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

const StarDrawing = (
  <path
    fillRule="evenodd"
    clipRule="evenodd"
    d="M24 9.30056C24 9.57278 23.8125 9.82987 23.625 10.0265L18.3894 15.38L19.6298 22.9414C19.6443 23.0472 19.6443 23.1379 19.6443 23.2438C19.6443 23.6371 19.4712 24 19.0528 24C18.8509 24 18.649 23.9243 18.476 23.8186L12 20.2496L5.52403 23.8186C5.33653 23.9243 5.14903 24 4.94712 24C4.52884 24 4.34134 23.6371 4.34134 23.2438C4.34134 23.1379 4.35577 23.0472 4.37019 22.9414L5.61057 15.38L0.360577 10.0265C0.1875 9.82987 0 9.57278 0 9.30056C0 8.84688 0.447116 8.66541 0.807693 8.60491L8.04809 7.50094L11.2933 0.620038C11.4231 0.332702 11.6683 0 12 0C12.3317 0 12.5769 0.332702 12.7067 0.620038L15.9519 7.50094L23.1923 8.60491C23.5385 8.66541 24 8.84688 24 9.30056Z"
    fill=""
  />
);
