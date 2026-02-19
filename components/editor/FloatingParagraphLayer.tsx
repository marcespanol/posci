"use client";

import { useRef, type PointerEvent as ReactPointerEvent } from "react";

import styles from "@/components/editor/floating-paragraph-layer.module.css";
import FloatingParagraphEditor from "@/components/editor/tiptap/FloatingParagraphEditor";
import type { PosterFloatingParagraphBlock } from "@/lib/poster/types";
import { usePosterEditorStore } from "@/lib/store/poster-store";

interface FloatingParagraphLayerProps {
  blocks: PosterFloatingParagraphBlock[];
}

interface DragSession {
  blockId: string;
  pointerOffsetX: number;
  pointerOffsetY: number;
}

export default function FloatingParagraphLayer({ blocks }: FloatingParagraphLayerProps) {
  const setBlockContent = usePosterEditorStore((state) => state.setBlockContent);
  const setFloatingBlockPosition = usePosterEditorStore((state) => state.setFloatingBlockPosition);

  const layerRef = useRef<HTMLDivElement | null>(null);
  const dragSessionRef = useRef<DragSession | null>(null);

  const onMove = (event: PointerEvent) => {
    const session = dragSessionRef.current;
    const layer = layerRef.current;
    if (!session || !layer) {
      return;
    }

    const rect = layer.getBoundingClientRect();
    const rawX = event.clientX - rect.left - session.pointerOffsetX;
    const rawY = event.clientY - rect.top - session.pointerOffsetY;

    const nextX = Math.max(0, rawX);
    const nextY = Math.max(0, rawY);

    setFloatingBlockPosition(session.blockId, nextX, nextY);
  };

  const onUp = () => {
    dragSessionRef.current = null;
    document.body.style.removeProperty("user-select");
    document.body.style.removeProperty("cursor");
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  };

  const beginDrag = (event: ReactPointerEvent<HTMLButtonElement>, block: PosterFloatingParagraphBlock) => {
    const layer = layerRef.current;
    if (!layer) {
      return;
    }

    const layerRect = layer.getBoundingClientRect();

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);

    dragSessionRef.current = {
      blockId: block.id,
      pointerOffsetX: event.clientX - (layerRect.left + block.position.x),
      pointerOffsetY: event.clientY - (layerRect.top + block.position.y)
    };

    document.body.style.userSelect = "none";
    document.body.style.cursor = "move";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  };

  return (
    <div className={styles.layer} ref={layerRef}>
      {blocks.map((block) => (
        <div key={block.id} className={styles.block} style={{ left: `${block.position.x}px`, top: `${block.position.y}px` }}>
          <button type="button" className={styles.dragHandle} onPointerDown={(event) => beginDrag(event, block)}>
            Move
          </button>
          <FloatingParagraphEditor content={block.content} onChange={(content) => setBlockContent(block.id, content)} />
        </div>
      ))}
    </div>
  );
}
