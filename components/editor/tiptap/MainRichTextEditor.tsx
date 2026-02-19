"use client";

import { BubbleMenu, EditorContent, useEditor } from "@tiptap/react";
import { useEffect } from "react";

import type { TipTapJsonContent } from "@/lib/poster/types";
import { mainExtensions } from "@/components/editor/tiptap/MainExtensions";
import styles from "@/components/editor/tiptap/main-rich-text-editor.module.css";
import { uploadPosterAsset } from "@/lib/supabase/assets-client";

interface MainRichTextEditorProps {
  posterId: string;
  content: TipTapJsonContent;
  onChange: (content: TipTapJsonContent) => void;
  onError?: (message: string) => void;
}

const promptImageSrc = (): string | null => {
  const input = globalThis.prompt("Image URL");
  if (!input) {
    return null;
  }

  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export default function MainRichTextEditor({ posterId, content, onChange, onError }: MainRichTextEditorProps) {
  const editor = useEditor({
    extensions: mainExtensions,
    content,
    immediatelyRender: false,
    onUpdate: ({ editor: activeEditor }) => {
      onChange(activeEditor.getJSON() as TipTapJsonContent);
    }
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    const current = editor.getJSON() as TipTapJsonContent;
    if (JSON.stringify(current) === JSON.stringify(content)) {
      return;
    }

    editor.commands.setContent(content, false);
  }, [content, editor]);

  if (!editor) {
    return null;
  }

  const insertBlockImage = () => {
    const src = promptImageSrc();
    if (!src) {
      return;
    }

    editor.chain().focus().setImage({ src, alt: "Poster image" }).run();
  };

  const insertInlineImage = () => {
    const src = promptImageSrc();
    if (!src) {
      return;
    }

    editor
      .chain()
      .focus()
      .insertContent({
        type: "inlineImage",
        attrs: { src, alt: "Inline image" }
      })
      .run();
  };

  const uploadAndInsert = (mode: "block" | "inline") => {
    const picker = document.createElement("input");
    picker.type = "file";
    picker.accept = "image/*";
    picker.onchange = async () => {
      const file = picker.files?.[0];
      if (!file) {
        return;
      }

      try {
        const uploaded = await uploadPosterAsset(posterId, file);

        if (mode === "block") {
          editor.chain().focus().setImage({ src: uploaded.signedUrl, alt: file.name }).run();
          return;
        }

        editor
          .chain()
          .focus()
          .insertContent({
            type: "inlineImage",
            attrs: { src: uploaded.signedUrl, alt: file.name }
          })
          .run();
      } catch (error) {
        onError?.(error instanceof Error ? error.message : "Image upload failed");
      }
    };
    picker.click();
  };

  return (
    <div className={styles.wrapper}>
      <BubbleMenu editor={editor} tippyOptions={{ duration: 120 }}>
        <div className={styles.bubble}>
          <button
            type="button"
            className={`${styles.tool} ${editor.isActive("heading", { level: 2 }) ? styles.toolActive : ""}`}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          >
            H2
          </button>
          <button
            type="button"
            className={`${styles.tool} ${editor.isActive("paragraph") ? styles.toolActive : ""}`}
            onClick={() => editor.chain().focus().setParagraph().run()}
          >
            P
          </button>
          <button
            type="button"
            className={`${styles.tool} ${editor.isActive("bold") ? styles.toolActive : ""}`}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            B
          </button>
          <button
            type="button"
            className={`${styles.tool} ${editor.isActive("italic") ? styles.toolActive : ""}`}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            I
          </button>
          <button
            type="button"
            className={`${styles.tool} ${editor.isActive("underline") ? styles.toolActive : ""}`}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          >
            U
          </button>
        </div>
      </BubbleMenu>

      <div className={styles.editor}>
        <EditorContent editor={editor} />
      </div>

      <div className={styles.inlineTools}>
        <button type="button" className={styles.toolGhost} onClick={insertBlockImage}>
          Image block
        </button>
        <button type="button" className={styles.toolGhost} onClick={insertInlineImage}>
          Inline image
        </button>
        <button type="button" className={styles.toolGhost} onClick={() => uploadAndInsert("block")}>
          Upload block
        </button>
        <button type="button" className={styles.toolGhost} onClick={() => uploadAndInsert("inline")}>
          Upload inline
        </button>
      </div>
    </div>
  );
}
