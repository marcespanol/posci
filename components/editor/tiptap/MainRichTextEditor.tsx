"use client";

import { BubbleMenu, EditorContent, useEditor } from "@tiptap/react";
import { useEffect, useRef } from "react";

import type { TipTapJsonContent } from "@/lib/poster/types";
import { uploadPosterAsset } from "@/lib/supabase/assets-client";
import { usePosterEditorStore } from "@/lib/store/poster-store";
import { mainExtensions } from "@/components/editor/tiptap/MainExtensions";
import styles from "@/components/editor/tiptap/main-rich-text-editor.module.css";

interface MainRichTextEditorProps {
  content: TipTapJsonContent;
  onChange: (content: TipTapJsonContent) => void;
}

const contentHasImageSrc = (node: TipTapJsonContent, src: string): boolean => {
  if ((node.type === "image" || node.type === "inlineImage") && node.attrs?.src === src) {
    return true;
  }

  return (node.content ?? []).some((child) => contentHasImageSrc(child, src));
};

const appendImageNodeToDoc = (doc: TipTapJsonContent, src: string, alt: string): TipTapJsonContent => {
  const nextBlocks = Array.isArray(doc.content) ? [...doc.content] : [];
  nextBlocks.push({
    type: "image",
    attrs: {
      src,
      alt,
      width: 520
    }
  });

  return {
    ...doc,
    type: "doc",
    content: nextBlocks
  };
};

const convertImageFileToPng = async (file: File): Promise<File> => {
  if (file.type === "image/png") {
    return file;
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const target = new Image();
      target.onload = () => resolve(target);
      target.onerror = () => reject(new Error("Failed to decode pasted image"));
      target.src = objectUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;
    const context = canvas.getContext("2d");
    if (!context) {
      return file;
    }

    context.drawImage(image, 0, 0);
    const pngBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/png");
    });

    if (!pngBlob) {
      return file;
    }

    const baseName = file.name.replace(/\.[a-z0-9]+$/i, "") || "pasted-image";
    return new File([pngBlob], `${baseName}.png`, { type: "image/png" });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

export default function MainRichTextEditor({ content, onChange }: MainRichTextEditorProps) {
  const posterId = usePosterEditorStore((state) => state.posterId);
  const lastEmittedJsonRef = useRef<string | null>(null);

  const editor = useEditor({
    extensions: mainExtensions,
    content,
    immediatelyRender: false,
    editorProps: {
      handlePaste: (_view, event) => {
        if (!posterId) {
          return false;
        }

        const items = Array.from(event.clipboardData?.items ?? []);
        const imageItem = items.find((item) => item.type.startsWith("image/"));
        if (!imageItem) {
          return false;
        }

        const file = imageItem.getAsFile();
        if (!file) {
          return false;
        }

        event.preventDefault();

        void (async () => {
          try {
            const normalizedFile = await convertImageFileToPng(file);
            const uploaded = await uploadPosterAsset(posterId, normalizedFile);
            const src = uploaded.signedUrl;
            if (!src) {
              throw new Error("Uploaded image URL is empty");
            }

            const alt = normalizedFile.name || "Pasted image";
            editor
              ?.chain()
              .focus()
              .insertContent({
                type: "image",
                attrs: {
                  src,
                  alt,
                  width: 520
                }
              })
              .run();

            const synced = editor?.getJSON() as TipTapJsonContent | undefined;
            if (synced) {
              const nextSynced = contentHasImageSrc(synced, src) ? synced : appendImageNodeToDoc(synced, src, alt);
              if (nextSynced !== synced) {
                editor?.commands.setContent(nextSynced, false);
              }

              lastEmittedJsonRef.current = JSON.stringify(nextSynced);
              onChange(nextSynced);
            }
          } catch (error) {
            console.error("Clipboard image upload failed", error);
          }
        })();

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

  return (
    <div className={styles.wrapper}>
      <BubbleMenu
        editor={editor}
        tippyOptions={{
          duration: 120,
          placement: "top",
          appendTo: () => document.body,
          offset: [0, 10],
          popperOptions: {
            strategy: "fixed"
          }
        }}
      >
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
    </div>
  );
}
