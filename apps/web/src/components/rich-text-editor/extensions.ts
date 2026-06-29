import StarterKit from "@tiptap/starter-kit";
import FileHandler from "@tiptap/extension-file-handler";
import TextAlign from "@tiptap/extension-text-align";
import Image from "@tiptap/extension-image";
import { Dropcursor } from "@tiptap/extensions";
import { Placeholder, Gapcursor } from "@tiptap/extensions";

export const baseExtensions = [
  StarterKit.configure({
    codeBlock: false,
  }),
  TextAlign.configure({
    types: ["heading", "paragraph"],
  }),
];

export const editorExtensions = ({ placeholder }: { placeholder?: string }) => [
  ...baseExtensions,
  Placeholder.configure({
    placeholder: placeholder ?? "Digite sua nota",
  }),
  Image.configure({
    resize: {
      enabled: true,
      alwaysPreserveAspectRatio: true,
    },
    HTMLAttributes: {
      class: "tiptap-image",
    },
  }),
  Dropcursor,
  Gapcursor,
  FileHandler.configure({
    allowedMimeTypes: ["image/png", "image/jpeg", "image/gif", "image/webp"],
    onDrop: (currentEditor, files, pos) => {
      files.forEach((file) => {
        const fileReader = new FileReader();

        fileReader.readAsDataURL(file);
        fileReader.onload = () => {
          currentEditor
            .chain()
            .insertContentAt(pos, {
              type: "image",
              attrs: {
                src: fileReader.result,
              },
            })
            .focus()
            .run();
        };
      });
    },
    onPaste: (currentEditor, files, htmlContent) => {
      files.forEach((file) => {
        if (htmlContent) {
          return false;
        }

        const fileReader = new FileReader();

        fileReader.readAsDataURL(file);
        fileReader.onload = () => {
          currentEditor
            .chain()
            .insertContentAt(currentEditor.state.selection.anchor, {
              type: "image",
              attrs: {
                src: fileReader.result,
              },
            })
            .focus()
            .run();
        };
      });
    },
  }),
];
