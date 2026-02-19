"use client";

import Bold from "@tiptap/extension-bold";
import Italic from "@tiptap/extension-italic";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import { Node } from "@tiptap/core";
import { useEffect } from "react";

import styles from "@/components/editor/tiptap/floating-paragraph-editor.module.css";
import type { TipTapJsonContent } from "@/lib/poster/types";

const DocumentNode = Node.create({
  name: "doc",
  topNode: true,
  content: "paragraph+"
});

interface FloatingParagraphEditorProps {
  content: TipTapJsonContent;
  onChange: (content: TipTapJsonContent) => void;
}

export default function FloatingParagraphEditor({ content, onChange }: FloatingParagraphEditorProps) {
  const editor = useEditor({
    extensions: [DocumentNode, Paragraph, Text, Bold, Italic, Underline],
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

  return (
    <div className={styles.editor}>
      <EditorContent editor={editor} />
    </div>
  );
}
