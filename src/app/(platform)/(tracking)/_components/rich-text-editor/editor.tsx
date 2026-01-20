"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { MenuToolbar } from "./menu-toolbar";

interface RichtTextEditorProps {
  onChange?: (value: string) => void;
}

export function RichtTextEditor({ onChange }: RichtTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      TextAlign.configure({
        types: ["paragraph", "heading"],
        alignments: ["left", "center", "right"],
      }),
    ],
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "min-h-[200px] p-4 focus-within:outline-none prose prose-sm sm:prose lg:prose-lg xl:prose-xl prose- dark:prose-invert w-full! max-w-none! prose-p:text-sm prose-h1:text-xl prose-h2:text-lg prose-h3:text-md! prose-p:my-0",
      },
    },
  });

  return (
    <div className="w-full border rounded-lg overflow-hidden bg-muted/20">
      <MenuToolbar editor={editor} onChange={onChange} />

      <EditorContent editor={editor} />
    </div>
  );
}
