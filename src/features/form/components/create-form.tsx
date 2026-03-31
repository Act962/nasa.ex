"use client";
import { useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Loader, PlusIcon } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
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

import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useMutationCreateForm } from "../hooks/use-form";

export function CreateForm() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const mutate = useMutationCreateForm();

  const formSchema = z.object({
    name: z.string().min(2, {
      message: "Name must be at least 2 characters.",
    }),
    description: z.string(),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    mutate.mutate(
      {
        name: values.name,
        description: values.description,
      },
      {
        onSuccess: (data) => {
          setIsOpen(false);
          toast("Formulário criado com sucesso");
          router.push(`/form/builder/${data.form?.id}`);
        },
        onError: () => {
          toast("Algo deu errado!");
        },
      },
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="bg-primary! font-medium! gap-1">
          <PlusIcon />
          Criar formulário
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Criar novo formulário</DialogTitle>
          <DialogDescription>
            Este formulário será criado com as informações fornecidas.
          </DialogDescription>
        </DialogHeader>

        <div className="w-full dialog-content">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Titulo</FormLabel>
                    <FormControl>
                      <Input
                        autoComplete="off"
                        placeholder="Titulo do formulário"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Descrição do formulário"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                disabled={form.formState.isSubmitting}
                className="px-5 flex place-self-end bg-primary!"
              >
                {form.formState.isSubmitting && (
                  <Loader className="w-4 h-4 animate-spin" />
                )}
                Criar
              </Button>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
