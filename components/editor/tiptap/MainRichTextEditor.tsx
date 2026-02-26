"use client";

import { BubbleMenu, EditorContent, useEditor, type Editor } from "@tiptap/react";
import { useEffect, useRef } from "react";
import { NodeSelection } from "@tiptap/pm/state";

import type { TipTapJsonContent } from "@/lib/poster/types";
import { uploadPosterAsset } from "@/lib/supabase/assets-client";
import { usePosterEditorStore } from "@/lib/store/poster-store";
import { mainExtensions } from "@/components/editor/tiptap/MainExtensions";
import styles from "@/components/editor/tiptap/main-rich-text-editor.module.css";

interface MainRichTextEditorProps {
  content: TipTapJsonContent;
  onChange: (content: TipTapJsonContent) => void;
  editable?: boolean;
}

type SelectedImageNodeInfo = {
  pos: number;
  typeName: "image" | "inlineImage";
  attrs: Record<string, string | number | boolean | null | undefined>;
};

type ImageLayoutMode = "block" | "inline" | "wrap-left" | "wrap-right";

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

const getSelectedImageNodeInfo = (editor: Editor): SelectedImageNodeInfo | null => {
  const { selection } = editor.state;
  if (!(selection instanceof NodeSelection)) {
    return null;
  }

  const node = selection.node;
  const typeName = node.type.name;
  if (typeName !== "image" && typeName !== "inlineImage") {
    return null;
  }

  return {
    pos: selection.from,
    typeName,
    attrs: { ...(node.attrs as Record<string, string | number | boolean | null | undefined>) }
  };
};

const getSelectedImageLayoutMode = (selected: SelectedImageNodeInfo): ImageLayoutMode => {
  const value = selected.attrs.layoutMode;
  if (value === "wrap-left" || value === "wrap-right" || value === "inline" || value === "block") {
    return value;
  }

  return selected.typeName === "inlineImage" ? "inline" : "block";
};

const setSelectedImageLayoutMode = (editor: Editor, layoutMode: ImageLayoutMode): boolean => {
  const selected = getSelectedImageNodeInfo(editor);
  if (!selected) {
    return false;
  }

  const targetType = layoutMode === "block" ? "image" : "inlineImage";
  if (selected.typeName === targetType) {
    const pos = selected.pos;
    const currentNode = editor.state.doc.nodeAt(pos);
    if (!currentNode) {
      return false;
    }

    const currentLayout = getSelectedImageLayoutMode(selected);
    if (currentLayout === layoutMode) {
      return true;
    }

    const transaction = editor.state.tr.setNodeMarkup(pos, undefined, {
      ...(currentNode.attrs as Record<string, string | number | boolean | null | undefined>),
      layoutMode
    });
    editor.view.dispatch(transaction);
    return true;
  }

  const attrs = {
    ...selected.attrs,
    layoutMode,
    inline: targetType === "inlineImage" ? true : null
  };

  const content = targetType === "inlineImage"
    ? {
        type: "paragraph",
        content: [
          {
            type: "inlineImage",
            attrs
          }
        ]
      }
    : {
        type: "image",
        attrs
      };

  return editor.chain().focus().deleteSelection().insertContent(content).run();
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

export default function MainRichTextEditor({
  content,
  onChange,
  editable = true
}: MainRichTextEditorProps) {
  const posterId = usePosterEditorStore((state) => state.posterId);
  const lastEmittedJsonRef = useRef<string | null>(null);
  const editableRef = useRef(editable);

  useEffect(() => {
    editableRef.current = editable;
  }, [editable]);

  const editor = useEditor({
    extensions: mainExtensions,
    content,
    editable,
    immediatelyRender: false,
    editorProps: {
      handlePaste: (_view, event) => {
        if (!editableRef.current || !posterId) {
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

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editable, editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className={styles.wrapper}>
      <BubbleMenu
        editor={editor}
        shouldShow={({ editor: activeEditor, state }) => {
          if (!activeEditor.isEditable) {
            return false;
          }

          if (getSelectedImageNodeInfo(activeEditor)) {
            return true;
          }

          return !state.selection.empty;
        }}
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
          {(() => {
            const selectedImage = getSelectedImageNodeInfo(editor);
            if (selectedImage) {
              const imageLayoutMode = getSelectedImageLayoutMode(selectedImage);
              return (
                <>
                  <button
                    type="button"
                    className={`${styles.tool} ${imageLayoutMode === "block" ? styles.toolActive : ""}`}
                    onClick={() => {
                      setSelectedImageLayoutMode(editor, "block");
                    }}
                  >
                    Block
                  </button>
                  <button
                    type="button"
                    className={`${styles.tool} ${imageLayoutMode === "wrap-left" ? styles.toolActive : ""}`}
                    onClick={() => {
                      setSelectedImageLayoutMode(editor, "wrap-left");
                    }}
                  >
                    Wrap L
                  </button>
                  <button
                    type="button"
                    className={`${styles.tool} ${imageLayoutMode === "wrap-right" ? styles.toolActive : ""}`}
                    onClick={() => {
                      setSelectedImageLayoutMode(editor, "wrap-right");
                    }}
                  >
                    Wrap R
                  </button>
                </>
              );
            }

            return (
              <>
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
              </>
            );
          })()}
        </div>
      </BubbleMenu>

      <div className={styles.editor}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
