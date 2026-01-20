"use client";

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  Italic,
  ListIcon,
  ListOrdered,
  Redo,
  StrikethroughIcon,
  Undo,
} from "lucide-react";
import { Toggle } from "../../../../../components/ui/toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../../../../components/ui/tooltip";
import { useEditorState, type Editor } from "@tiptap/react";
import { cn } from "@/lib/utils";
import { Separator } from "../../../../../components/ui/separator";
import { Button } from "../../../../../components/ui/button";

interface MenuToolbarProps {
  editor: Editor | null;
  onChange?: (value: string) => void;
}

export function MenuToolbar({ editor, onChange }: MenuToolbarProps) {
  if (!editor) {
    return null;
  }

  const editorState = useEditorState({
    editor,
    selector: ({ editor }) => {
      return {
        isBold: editor.isActive("bold"),
        isItalic: editor.isActive("italic"),
        isStrike: editor.isActive("strike"),
        isHeading: editor.isActive("heading", { level: 1 }),
        isHeading2: editor.isActive("heading", { level: 2 }),
        isHeading3: editor.isActive("heading", { level: 3 }),
        isBulletList: editor.isActive("bulletList"),
        isOrderedList: editor.isActive("orderedList"),
        textAlignLeft: editor.isActive({ textAlign: "left" }),
        textAlignCenter: editor.isActive({ textAlign: "center" }),
        textAlignRight: editor.isActive({ textAlign: "right" }),
        canUndo: editor.can().undo(),
        canRedo: editor.can().redo(),
      };
    },
  });

  return (
    <div className="flex items-center flex-wrap gap-2 border-b px-4 py-2">
      <div className="flex items-center flex-wrap gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Toggle
              size={"sm"}
              pressed={editorState.isBold}
              onPressedChange={() => editor.chain().focus().toggleBold().run()}
              className={cn(
                editorState.isBold && "bg-muted text-muted-foreground",
              )}
            >
              <Bold />
            </Toggle>
          </TooltipTrigger>
          <TooltipContent align="center">Negrito</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Toggle
              size={"sm"}
              pressed={editorState.isItalic}
              onPressedChange={() =>
                editor.chain().focus().toggleItalic().run()
              }
              className={cn(
                editorState.isItalic && "bg-muted text-muted-foreground",
              )}
            >
              <Italic />
            </Toggle>
          </TooltipTrigger>
          <TooltipContent align="center">Itálico</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Toggle
              size={"sm"}
              pressed={editorState.isStrike}
              onPressedChange={() =>
                editor.chain().focus().toggleStrike().run()
              }
              className={cn(
                editorState.isStrike && "bg-muted text-muted-foreground",
              )}
            >
              <StrikethroughIcon />
            </Toggle>
          </TooltipTrigger>
          <TooltipContent align="center">Tachado</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Toggle
              size={"sm"}
              pressed={editorState.isHeading}
              onPressedChange={() =>
                editor.chain().focus().toggleHeading({ level: 1 }).run()
              }
              className={cn(
                editorState.isHeading && "bg-muted text-muted-foreground",
              )}
            >
              <Heading1Icon />
            </Toggle>
          </TooltipTrigger>
          <TooltipContent align="center">Título 1</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Toggle
              size={"sm"}
              pressed={editorState.isHeading2}
              onPressedChange={() =>
                editor.chain().focus().toggleHeading({ level: 2 }).run()
              }
              className={cn(
                editorState.isHeading2 && "bg-muted text-muted-foreground",
              )}
            >
              <Heading2Icon />
            </Toggle>
          </TooltipTrigger>
          <TooltipContent align="center">Título 2</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Toggle
              size={"sm"}
              pressed={editorState.isHeading3}
              onPressedChange={() =>
                editor.chain().focus().toggleHeading({ level: 3 }).run()
              }
              className={cn(
                editorState.isHeading3 && "bg-muted text-muted-foreground",
              )}
            >
              <Heading3Icon />
            </Toggle>
          </TooltipTrigger>
          <TooltipContent align="center">Título 3</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Toggle
              size={"sm"}
              pressed={editorState.isBulletList}
              onPressedChange={() =>
                editor.chain().focus().toggleBulletList().run()
              }
              className={cn(
                editorState.isBulletList && "bg-muted text-muted-foreground",
              )}
            >
              <ListIcon />
            </Toggle>
          </TooltipTrigger>
          <TooltipContent align="center">Lista não ordenada</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Toggle
              size={"sm"}
              pressed={editorState.isOrderedList}
              onPressedChange={() =>
                editor.chain().focus().toggleOrderedList().run()
              }
              className={cn(
                editorState.isOrderedList && "bg-muted text-muted-foreground",
              )}
            >
              <ListOrdered />
            </Toggle>
          </TooltipTrigger>
          <TooltipContent align="center">Lista ordenada</TooltipContent>
        </Tooltip>
      </div>

      <Separator orientation="vertical" className="h-6!" />

      <div className="flex items-center flex-wrap gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Toggle
              size={"sm"}
              pressed={editorState.textAlignLeft}
              onPressedChange={() =>
                editor.chain().focus().setTextAlign("left").run()
              }
              className={cn(
                editorState.textAlignLeft && "bg-muted text-muted-foreground",
              )}
            >
              <AlignLeft />
            </Toggle>
          </TooltipTrigger>
          <TooltipContent align="center">Alinhar à esquerda</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Toggle
              size={"sm"}
              pressed={editorState.textAlignCenter}
              onPressedChange={() =>
                editor.chain().focus().setTextAlign("center").run()
              }
              className={cn(
                editorState.textAlignCenter && "bg-muted text-muted-foreground",
              )}
            >
              <AlignCenter />
            </Toggle>
          </TooltipTrigger>
          <TooltipContent align="center">Alinhar ao centro</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Toggle
              size={"sm"}
              pressed={editorState.textAlignRight}
              onPressedChange={() =>
                editor.chain().focus().setTextAlign("right").run()
              }
              className={cn(
                editorState.textAlignRight && "bg-muted text-muted-foreground",
              )}
            >
              <AlignRight />
            </Toggle>
          </TooltipTrigger>
          <TooltipContent align="center">Alinhar à direita</TooltipContent>
        </Tooltip>
      </div>

      <Separator orientation="vertical" className="h-6!" />

      <div className="flex items-center flex-wrap gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size={"sm"}
              variant={"ghost"}
              type="button"
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editorState.canUndo}
            >
              <Undo />
            </Button>
          </TooltipTrigger>
          <TooltipContent align="center">Desfazer</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size={"sm"}
              variant={"ghost"}
              type="button"
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editorState.canRedo}
            >
              <Redo />
            </Button>
          </TooltipTrigger>
          <TooltipContent align="center">Refazer</TooltipContent>
        </Tooltip>
      </div>

      <Button className="ml-auto" onClick={() => onChange?.(editor.getHTML())}>
        Adicionar nota
      </Button>
    </div>
  );
}
