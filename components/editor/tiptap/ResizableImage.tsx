"use client";

import Image from "@tiptap/extension-image";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { useRef, type PointerEvent as ReactPointerEvent } from "react";

const MIN_WIDTH = 80;
const MAX_WIDTH = 2200;

function ResizableImageView({ node, updateAttributes, selected }: NodeViewProps) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const attrs = node.attrs as {
    src: string;
    alt?: string;
    title?: string;
    width?: number | null;
  };

  const beginResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startWidth = imageRef.current?.getBoundingClientRect().width || Number(attrs.width) || 320;
    const naturalWidth = imageRef.current?.naturalWidth ?? 0;
    const naturalHeight = imageRef.current?.naturalHeight ?? 0;
    const ratio = naturalWidth > 0 && naturalHeight > 0 ? naturalWidth / naturalHeight : 0;

    const onMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const nextWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(startWidth + deltaX)));

      updateAttributes({
        src: attrs.src,
        alt: attrs.alt ?? null,
        title: attrs.title ?? null,
        width: ratio > 0 ? nextWidth : Math.round(nextWidth)
      });
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const width = Number(attrs.width) || undefined;

  return (
    <NodeViewWrapper
      as="span"
      className={`tiptap-resizable-image ${selected ? "tiptap-resizable-image-selected" : ""}`}
      contentEditable={false}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imageRef}
        src={attrs.src}
        alt={attrs.alt ?? ""}
        title={attrs.title}
        draggable={false}
        style={{
          width: width ? `${width}px` : undefined
        }}
      />
      <button
        type="button"
        aria-label="Resize image"
        className="tiptap-resizable-image-handle"
        onPointerDown={beginResize}
      />
    </NodeViewWrapper>
  );
}

export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: (element) => element.getAttribute("src"),
        renderHTML: (attributes) => {
          if (!attributes.src) {
            return {};
          }

          return { src: attributes.src };
        }
      },
      alt: {
        default: null,
        parseHTML: (element) => element.getAttribute("alt"),
        renderHTML: (attributes) => {
          if (!attributes.alt) {
            return {};
          }

          return { alt: attributes.alt };
        }
      },
      title: {
        default: null,
        parseHTML: (element) => element.getAttribute("title"),
        renderHTML: (attributes) => {
          if (!attributes.title) {
            return {};
          }

          return { title: attributes.title };
        }
      },
      width: {
        default: null,
        parseHTML: (element) => {
          const value = element.getAttribute("data-width") ?? element.getAttribute("width");
          if (!value) {
            return null;
          }

          const parsed = Number(value);
          return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
        },
        renderHTML: (attributes) => {
          const width = Number(attributes.width);
          if (!Number.isFinite(width) || width <= 0) {
            return {};
          }

          return {
            "data-width": String(Math.round(width))
          };
        }
      }
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView);
  }
});
