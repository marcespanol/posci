"use client";

import { BubbleMenu, EditorContent, useEditor } from "@tiptap/react";
import Bold from "@tiptap/extension-bold";
import Italic from "@tiptap/extension-italic";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import Underline from "@tiptap/extension-underline";
import { useEffect } from "react";
import { Node } from "@tiptap/core";

import type { TipTapJsonContent } from "@/lib/poster/types";
import styles from "@/components/editor/tiptap/rich-text-marks-editor.module.css";

interface RichTextMarksEditorProps {
  content: TipTapJsonContent;
  onChange: (content: TipTapJsonContent) => void;
  singleLine?: boolean;
}

const normalizeSingleLineText = (text: string): string => text.replace(/\s*\n+\s*/g, " ");
const TopLevelDocument = Node.create({
  name: "doc",
  topNode: true,
  content: "paragraph+"
});

export default function RichTextMarksEditor({ content, onChange, singleLine = false }: RichTextMarksEditorProps) {
  const editor = useEditor({
    extensions: [TopLevelDocument, Paragraph, Text, Bold, Italic, Underline],
    content,
    immediatelyRender: false,
    editorProps: {
      handleKeyDown: (_view, event) => {
        if (singleLine && event.key === "Enter") {
          event.preventDefault();
          return true;
        }

        return false;
      },
      handlePaste: (_view, event) => {
        if (!singleLine) {
          return false;
        }

        const text = event.clipboardData?.getData("text/plain");
        if (!text) {
          return false;
        }

        event.preventDefault();
        editor?.commands.insertContent(normalizeSingleLineText(text));
        return true;
      }
    },
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

  return (
    <div className={styles.wrapper}>
      <BubbleMenu editor={editor} tippyOptions={{ duration: 120 }}>
        <div className={styles.bubble}>
          <button
            type="button"
            className={`${styles.markButton} ${editor.isActive("bold") ? styles.markButtonActive : ""}`}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            B
          </button>
          <button
            type="button"
            className={`${styles.markButton} ${editor.isActive("italic") ? styles.markButtonActive : ""}`}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            I
          </button>
          <button
            type="button"
            className={`${styles.markButton} ${editor.isActive("underline") ? styles.markButtonActive : ""}`}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          >
            U
          </button>
        </div>
      </BubbleMenu>

      <div className={`${styles.editor} ${singleLine ? styles.editorSingleLine : ""}`}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
