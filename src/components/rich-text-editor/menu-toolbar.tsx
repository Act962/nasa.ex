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
  type LucideIcon,
  Redo,
  StrikethroughIcon,
  Undo,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { useEditorState, type Editor } from "@tiptap/react";
import { cn } from "@/lib/utils";
import { Separator } from "../ui/separator";
import { Toggle } from "../ui/toggle";

interface MenuToolbarProps {
  editor: Editor | null;
  children?: React.ReactNode;
}

interface ToolbarItem {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
}

interface ToolbarButtonProps extends ToolbarItem {}

function ToolbarButton({
  label,
  icon: Icon,
  onClick,
  isActive,
  disabled,
}: ToolbarButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Toggle
          size="sm"
          pressed={isActive}
          disabled={disabled}
          onPressedChange={onClick}
          className={cn(isActive && "bg-muted text-muted-foreground")}
        >
          <Icon />
        </Toggle>
      </TooltipTrigger>
      <TooltipContent align="center">{label}</TooltipContent>
    </Tooltip>
  );
}

export function MenuToolbar({ editor, children }: MenuToolbarProps) {
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

  const sections: ToolbarItem[][] = [
    [
      {
        label: "Negrito",
        icon: Bold,
        onClick: () => editor.chain().focus().toggleBold().run(),
        isActive: editorState.isBold,
      },
      {
        label: "Itálico",
        icon: Italic,
        onClick: () => editor.chain().focus().toggleItalic().run(),
        isActive: editorState.isItalic,
      },
      {
        label: "Tachado",
        icon: StrikethroughIcon,
        onClick: () => editor.chain().focus().toggleStrike().run(),
        isActive: editorState.isStrike,
      },
      {
        label: "Título 1",
        icon: Heading1Icon,
        onClick: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
        isActive: editorState.isHeading,
      },
      {
        label: "Título 2",
        icon: Heading2Icon,
        onClick: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
        isActive: editorState.isHeading2,
      },
      {
        label: "Título 3",
        icon: Heading3Icon,
        onClick: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
        isActive: editorState.isHeading3,
      },
      {
        label: "Lista não ordenada",
        icon: ListIcon,
        onClick: () => editor.chain().focus().toggleBulletList().run(),
        isActive: editorState.isBulletList,
      },
      {
        label: "Lista ordenada",
        icon: ListOrdered,
        onClick: () => editor.chain().focus().toggleOrderedList().run(),
        isActive: editorState.isOrderedList,
      },
    ],
    // Alinhamento
    [
      {
        label: "Alinhar à esquerda",
        icon: AlignLeft,
        onClick: () => editor.chain().focus().setTextAlign("left").run(),
        isActive: editorState.textAlignLeft,
      },
      {
        label: "Alinhar ao centro",
        icon: AlignCenter,
        onClick: () => editor.chain().focus().setTextAlign("center").run(),
        isActive: editorState.textAlignCenter,
      },
      {
        label: "Alinhar à direita",
        icon: AlignRight,
        onClick: () => editor.chain().focus().setTextAlign("right").run(),
        isActive: editorState.textAlignRight,
      },
    ],
    // Edição
    [
      {
        label: "Desfazer",
        icon: Undo,
        onClick: () => editor.chain().focus().undo().run(),
        disabled: !editorState.canUndo,
      },
      {
        label: "Refazer",
        icon: Redo,
        onClick: () => editor.chain().focus().redo().run(),
        disabled: !editorState.canRedo,
      },
    ],
  ];

  return (
    <div className="sticky top-0 z-10 flex items-center flex-wrap gap-1 border-b px-4 py-2 bg-muted rounded-t-lg">
      {sections.map((section, index) => (
        <div key={index} className="flex items-center flex-wrap gap-1">
          {section.map((item) => (
            <ToolbarButton key={item.label} {...item} />
          ))}
          {index < sections.length - 1 && (
            <Separator orientation="vertical" className="h-6! mx-1" />
          )}
        </div>
      ))}

      {children}
    </div>
  );
}
