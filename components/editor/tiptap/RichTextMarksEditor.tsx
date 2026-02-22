"use client";

import { BubbleMenu, EditorContent, useEditor } from "@tiptap/react";
import { Node } from "@tiptap/core";
import Bold from "@tiptap/extension-bold";
import Italic from "@tiptap/extension-italic";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import Underline from "@tiptap/extension-underline";
import { useEffect, useRef } from "react";

import type { TipTapJsonContent } from "@/lib/poster/types";
import styles from "@/components/editor/tiptap/rich-text-marks-editor.module.css";

interface RichTextMarksEditorProps {
  content: TipTapJsonContent;
  onChange: (content: TipTapJsonContent) => void;
  singleLine?: boolean;
  variant?: "panel" | "artboardHeader" | "artboardFooter";
}

const normalizeSingleLineText = (text: string): string => text.replace(/\s*\n+\s*/g, " ");
const TopLevelDocument = Node.create({
  name: "doc",
  topNode: true,
  content: "paragraph+"
});

const AlignedParagraph = Paragraph.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      textAlign: {
        default: "left",
        parseHTML: (element) => {
          const value = element.style.textAlign || element.getAttribute("data-text-align") || "left";
          return ["left", "center", "right"].includes(value) ? value : "left";
        },
        renderHTML: (attributes) => {
          const value = typeof attributes.textAlign === "string" ? attributes.textAlign : "left";
          if (!["left", "center", "right"].includes(value) || value === "left") {
            return {};
          }

          return {
            "data-text-align": value,
            style: `text-align:${value};`
          };
        }
      }
    };
  },
  addCommands() {
    return this.parent?.() ?? {};
  }
});

export default function RichTextMarksEditor({
  content,
  onChange,
  singleLine = false,
  variant = "panel"
}: RichTextMarksEditorProps) {
  const lastEmittedJsonRef = useRef<string | null>(null);

  const editor = useEditor({
    extensions: [TopLevelDocument, AlignedParagraph, Text, Bold, Italic, Underline],
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
      const next = structuredClone(activeEditor.getJSON() as TipTapJsonContent);
      lastEmittedJsonRef.current = JSON.stringify(next);
      onChange(next);
    }
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    const incoming = JSON.stringify(content);
    if (lastEmittedJsonRef.current === incoming) {
      return;
    }

    const current = editor.getJSON() as TipTapJsonContent;
    const currentSerialized = JSON.stringify(current);
    if (currentSerialized === incoming) {
      lastEmittedJsonRef.current = incoming;
      return;
    }

    queueMicrotask(() => {
      if (editor.isDestroyed) {
        return;
      }

      const latest = JSON.stringify(editor.getJSON() as TipTapJsonContent);
      if (latest === incoming) {
        lastEmittedJsonRef.current = incoming;
        return;
      }

      editor.commands.setContent(structuredClone(content), false);
      lastEmittedJsonRef.current = incoming;
    });
  }, [content, editor]);

  if (!editor) {
    return null;
  }

  const applyParagraphAlignment = (textAlign: "left" | "center" | "right") => {
    editor.chain().focus().run();

    const { state, view } = editor;
    const { selection } = state;
    let transaction = state.tr;
    let changed = false;

    if (selection.empty) {
      const { $from } = selection;

      for (let depth = $from.depth; depth >= 0; depth -= 1) {
        const node = $from.node(depth);
        if (node.type.name !== "paragraph") {
          continue;
        }

        const position = depth > 0 ? $from.before(depth) : 0;
        transaction = transaction.setNodeMarkup(position, undefined, {
          ...node.attrs,
          textAlign
        });
        changed = true;
        break;
      }
    } else {
      state.doc.nodesBetween(selection.from, selection.to, (node, position) => {
        if (node.type.name !== "paragraph") {
          return;
        }

        transaction = transaction.setNodeMarkup(position, undefined, {
          ...node.attrs,
          textAlign
        });
        changed = true;
      });
    }

    if (changed) {
      view.dispatch(transaction);
      const next = structuredClone(editor.getJSON() as TipTapJsonContent);
      lastEmittedJsonRef.current = JSON.stringify(next);
      onChange(next);
    }
  };

  const isAligned = (textAlign: "left" | "center" | "right"): boolean => {
    return editor.isActive("paragraph", { textAlign });
  };

  return (
    <div className={`${styles.wrapper} ${variant === "panel" ? "" : styles.wrapperArtboard}`}>
      <BubbleMenu
        editor={editor}
        tippyOptions={{
          duration: 120,
          placement: "top",
          appendTo: () => document.body,
          popperOptions: { strategy: "fixed" },
          offset: [0, 10]
        }}
      >
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
          <button
            type="button"
            className={`${styles.markButton} ${isAligned("left") ? styles.markButtonActive : ""}`}
            onClick={() => applyParagraphAlignment("left")}
          >
            L
          </button>
          <button
            type="button"
            className={`${styles.markButton} ${isAligned("center") ? styles.markButtonActive : ""}`}
            onClick={() => applyParagraphAlignment("center")}
          >
            C
          </button>
          <button
            type="button"
            className={`${styles.markButton} ${isAligned("right") ? styles.markButtonActive : ""}`}
            onClick={() => applyParagraphAlignment("right")}
          >
            R
          </button>
        </div>
      </BubbleMenu>

      <div
        className={`${styles.editor} ${singleLine ? styles.editorSingleLine : ""} ${
          variant === "artboardHeader" ? styles.editorArtboardHeader : ""
        } ${variant === "artboardFooter" ? styles.editorArtboardFooter : ""}`}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
