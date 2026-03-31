import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { useCreateWorkspace } from "../../hooks/use-workspace";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import EmojiPicker, { Theme } from "emoji-picker-react";
import pt from "emoji-picker-react/dist/data/emojis-pt.json";
import { EmojiData } from "emoji-picker-react/dist/types/exposedTypes";
import { SmileIcon } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useState } from "react";

const formSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().optional(),
  icon: z.string().optional(),
});

type DataForm = z.infer<typeof formSchema>;

export function CreateWorkspaceModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [openEmoji, setOpenEmoji] = useState(false);
  const createWorkspace = useCreateWorkspace();

  const form = useForm<DataForm>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      icon: "🏢",
    },
  });

  const onSubmit = (data: DataForm) => {
    createWorkspace.mutate(data, {
      onSuccess: () => {
        onOpenChange(false);
        form.reset();
      },
    });
  };

  const isPending = createWorkspace.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Criar workspace</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup>
            <div className="w-fit">
              <Controller
                control={form.control}
                name="icon"
                render={({ field }) => (
                  <Field className="">
                    <FieldLabel>Ícone</FieldLabel>
                    <Popover open={openEmoji} onOpenChange={setOpenEmoji}>
                      <PopoverTrigger asChild disabled={isPending}>
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-10 px-2 text-2xl flex items-center justify-center"
                        >
                          {field.value || <SmileIcon className="size-6" />}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-fit p-0 border-none shadow-none">
                        <EmojiPicker
                          searchPlaceholder="Pesquisar emoji"
                          skinTonesDisabled={true}
                          previewConfig={{ showPreview: false }}
                          emojiData={pt as EmojiData}
                          theme={Theme.DARK}
                          onEmojiClick={(emoji) => {
                            field.onChange(emoji.emoji);
                            setOpenEmoji(false);
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                    <FieldError errors={[form.formState.errors.icon]} />
                  </Field>
                )}
              />
            </div>

            <Field className="">
              <FieldLabel>Nome</FieldLabel>
              <Input
                placeholder="Ex: Marketing"
                {...form.register("name")}
                disabled={isPending}
              />
              <FieldError errors={[form.formState.errors.name]} />
            </Field>

            <Field className="">
              <FieldLabel>Descrição (opcional)</FieldLabel>
              <Textarea
                placeholder="Descreva o propósito deste workspace"
                {...form.register("description")}
                disabled={isPending}
              />
              <FieldError errors={[form.formState.errors.description]} />
            </Field>
          </FieldGroup>

          <DialogFooter className="mt-8">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Spinner className="size-4" />}
              Criar workspace
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
