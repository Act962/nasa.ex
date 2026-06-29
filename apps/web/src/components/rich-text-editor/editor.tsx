"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import { MenuToolbar } from "./menu-toolbar";
import { editorExtensions } from "./extensions";

interface RichtTextEditorProps {
  field?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  children?: React.ReactNode;
  placeholder?: string;
}

export function RichtTextEditor({
  onChange,
  field,
  disabled,
  children,
  placeholder,
}: RichtTextEditorProps) {
  const editor = useEditor({
    extensions: editorExtensions({ placeholder }),
    content: (() => {
      if (!field) return "";
      try {
        return JSON.parse(field);
      } catch {
        return field;
      }
    })(),
    onUpdate: ({ editor }) => {
      if (onChange) {
        onChange(JSON.stringify(editor.getJSON()));
      }
    },
    editable: !disabled,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "min-h-50 p-4 focus-within:outline-none prose prose-sm sm:prose lg:prose-lg xl:prose-xl  dark:prose-invert w-full! max-w-none! prose-p:text-sm prose-h1:text-xl prose-h2:text-lg prose-h3:text-md! prose-p:my-0 placeholder:text-muted-foreground",
      },
    },
  });

  return (
    <div className="relative w-full border rounded-lg bg-muted/20">
      <MenuToolbar editor={editor}>{children}</MenuToolbar>

      <EditorContent editor={editor} />
    </div>
  );
}
