import { useEffect } from "react";
import { ChevronDown, Pilcrow } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  FormBlockInstance,
  FormBlockType,
  FormCategoryType,
  ObjectBlockType,
} from "@/features/form/types";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useBuilderStore } from "@/features/form/context/builder-form-provider";

const blockCategory: FormCategoryType = "Layout";
const blockType: FormBlockType = "ParagraphWithTitle";

type AttributesType = {
  title: string;
  body: string;
};

const propertiesValidateSchema = z.object({
  title: z.string().trim().max(255),
  body: z.string().trim().max(4000),
});
type PropertiesType = z.input<typeof propertiesValidateSchema>;

export const ParagraphWithTitleBlock: ObjectBlockType = {
  blockType,
  blockCategory,
  createInstance: (id) => ({
    id,
    blockType,
    attributes: {
      title: "Seção",
      body: "Texto descritivo da seção.",
    } satisfies AttributesType,
  }),
  blockBtnElement: { icon: Pilcrow, label: "Parágrafo com título" },
  canvasComponent: View,
  formComponent: View,
  propertiesComponent: PropertiesView,
};

type Instance = FormBlockInstance & { attributes: AttributesType };

function View({ blockInstance }: { blockInstance: FormBlockInstance }) {
  const { title, body } = (blockInstance as Instance).attributes;
  return (
    <div className="flex flex-col gap-1 w-full">
      {title && (
        <h3 className="text-base font-semibold break-words whitespace-normal leading-snug">
          {title}
        </h3>
      )}
      {body && (
        <p className="text-sm text-muted-foreground whitespace-pre-line break-words">
          {body}
        </p>
      )}
    </div>
  );
}

function PropertiesView({
  positionIndex,
  parentId,
  blockInstance,
}: {
  positionIndex?: number;
  parentId?: string;
  blockInstance: FormBlockInstance;
}) {
  const block = blockInstance as Instance;
  const { updateChildBlock } = useBuilderStore();
  const form = useForm<PropertiesType>({
    resolver: zodResolver(propertiesValidateSchema),
    mode: "onBlur",
    defaultValues: { ...block.attributes },
  });

  useEffect(() => form.reset({ ...block.attributes }), [block.attributes, form]);

  function commit(partial: Partial<AttributesType>) {
    if (!parentId) return;
    updateChildBlock(parentId, block.id, {
      ...block,
      attributes: { ...block.attributes, ...partial },
    });
  }

  return (
    <div className="w-full pb-4">
      <div className="w-full flex flex-row items-center justify-between gap-1 bg-foreground/10 rounded-md h-auto p-1 px-2 mb-[10px]">
        <span className="text-sm font-medium text-muted-foreground tracking-wider">
          Parágrafo com título {positionIndex}
        </span>
        <ChevronDown className="w-4 h-4" />
      </div>
      <Form {...form}>
        <form onSubmit={(e) => e.preventDefault()} className="w-full space-y-3 px-4">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[13px] font-normal">Título</FormLabel>
                <FormControl>
                  <Input {...field} onChange={(e) => { field.onChange(e); commit({ title: e.target.value }); }} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="body"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[13px] font-normal">Texto</FormLabel>
                <FormControl>
                  <Textarea
                    rows={4}
                    {...field}
                    onChange={(e) => {
                      field.onChange(e);
                      commit({ body: e.target.value });
                    }}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </form>
      </Form>
    </div>
  );
}
