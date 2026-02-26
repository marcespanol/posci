"use client";

import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import MessageCircleIcon from "@/components/icons/MessageCircleIcon";
import styles from "@/components/editor/floating-paragraph-layer.module.css";
import FloatingParagraphEditor from "@/components/editor/tiptap/FloatingParagraphEditor";
import type { PosterCommentAnchorTarget } from "@/lib/poster/comments";
import type { PosterFloatingParagraphBlock } from "@/lib/poster/types";
import { usePosterEditorStore } from "@/lib/store/poster-store";
import { selectPosterReadColorTheme } from "@/lib/store/poster-read-selectors";

interface FloatingParagraphLayerProps {
  blocks: PosterFloatingParagraphBlock[];
  canEdit?: boolean;
  commentMode?: boolean;
  canComment?: boolean;
  commentCountByFloatingId?: Record<string, number>;
  onSelectCommentAnchor?: (anchor: PosterCommentAnchorTarget) => void;
}

interface DragSession {
  blockId: string;
  pointerOffsetX: number;
  pointerOffsetY: number;
}

type FloatingShape = "rectangle" | "circle" | "parallelogram";
type AlignmentGuides = {
  x: number | null;
  y: number | null;
};

const MAGNET_THRESHOLD = 8;
const BORDER_DRAG_HIT_PX = 10;

const isEditorTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(target.closest("[data-floating-editor='true']"));
};

const isFloatingControlTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(target.closest("[data-floating-control='true']"));
};

export default function FloatingParagraphLayer({
  blocks,
  canEdit = true,
  commentMode = false,
  canComment = false,
  commentCountByFloatingId,
  onSelectCommentAnchor
}: FloatingParagraphLayerProps) {
  const setBlockContent = usePosterEditorStore((state) => state.setBlockContent);
  const setFloatingBlockPosition = usePosterEditorStore((state) => state.setFloatingBlockPosition);
  const setFloatingParagraphAppearance = usePosterEditorStore((state) => state.setFloatingParagraphAppearance);
  const removeFloatingParagraph = usePosterEditorStore((state) => state.removeFloatingParagraph);
  const colorTheme = usePosterEditorStore(selectPosterReadColorTheme);

  const layerRef = useRef<HTMLDivElement | null>(null);
  const blockRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const dragSessionRef = useRef<DragSession | null>(null);
  const frameRef = useRef<number | null>(null);
  const pendingPointerRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const lastAppliedPositionRef = useRef<Record<string, { x: number; y: number }>>({});
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [alignmentGuides, setAlignmentGuides] = useState<AlignmentGuides>({ x: null, y: null });
  const [zIndexById, setZIndexById] = useState<Record<string, number>>({});
  const zCounterRef = useRef(200);

  const tonePalette = useMemo(() => {
    const blue = ["#edf4ff", "#dbeafe", "#bfdbfe", "#93c5fd"] as const;
    const green = ["#edf8f2", "#dcfce7", "#bbf7d0", "#86efac"] as const;
    return colorTheme === "GREEN" ? green : blue;
  }, [colorTheme]);

  const getBlockDimensions = (blockId: string) => {
    const el = blockRefs.current[blockId];
    if (!el) {
      return null;
    }

    const width = el.offsetWidth;
    const height = el.offsetHeight;
    if (width <= 0 || height <= 0) {
      return null;
    }

    return { width, height };
  };

  const getMagneticPosition = (draggedBlockId: string, rawX: number, rawY: number) => {
    const draggedDimensions = getBlockDimensions(draggedBlockId);
    if (!draggedDimensions) {
      return { x: Math.max(0, rawX), y: Math.max(0, rawY), guideX: null as number | null, guideY: null as number | null };
    }
    const { width, height } = draggedDimensions;

    let nextX = Math.max(0, rawX);
    let nextY = Math.max(0, rawY);

    const draggedLeft = rawX;
    const draggedCenterX = rawX + width / 2;
    const draggedRight = rawX + width;
    const draggedTop = rawY;
    const draggedCenterY = rawY + height / 2;
    const draggedBottom = rawY + height;

    let bestDx = Number.POSITIVE_INFINITY;
    let bestDy = Number.POSITIVE_INFINITY;
    let snapX: number | null = null;
    let snapY: number | null = null;
    let guideX: number | null = null;
    let guideY: number | null = null;

    for (const block of blocks) {
      if (block.id === draggedBlockId) {
        continue;
      }

      const otherDimensions = getBlockDimensions(block.id);
      if (!otherDimensions) {
        continue;
      }

      const otherLeft = block.position.x;
      const otherTop = block.position.y;
      const otherWidth = otherDimensions.width;
      const otherHeight = otherDimensions.height;
      const otherXs = [otherLeft + otherWidth / 2, otherLeft, otherLeft + otherWidth];
      const otherYs = [otherTop + otherHeight / 2, otherTop, otherTop + otherHeight];
      const draggedXs = [
        { value: draggedCenterX, apply: (target: number) => target - width / 2 },
        { value: draggedLeft, apply: (target: number) => target },
        { value: draggedRight, apply: (target: number) => target - width }
      ];
      const draggedYs = [
        { value: draggedCenterY, apply: (target: number) => target - height / 2 },
        { value: draggedTop, apply: (target: number) => target },
        { value: draggedBottom, apply: (target: number) => target - height }
      ];

      for (const dxRef of draggedXs) {
        for (const targetX of otherXs) {
          const delta = Math.abs(dxRef.value - targetX);
          if (delta <= MAGNET_THRESHOLD && delta < bestDx) {
            bestDx = delta;
            snapX = dxRef.apply(targetX);
            guideX = targetX;
          }
        }
      }

      for (const dyRef of draggedYs) {
        for (const targetY of otherYs) {
          const delta = Math.abs(dyRef.value - targetY);
          if (delta <= MAGNET_THRESHOLD && delta < bestDy) {
            bestDy = delta;
            snapY = dyRef.apply(targetY);
            guideY = targetY;
          }
        }
      }
    }

    if (snapX !== null) {
      nextX = Math.max(0, Math.round(snapX));
    }
    if (snapY !== null) {
      nextY = Math.max(0, Math.round(snapY));
    }

    return { x: nextX, y: nextY, guideX, guideY };
  };

  const onMove = (event: PointerEvent) => {
    pendingPointerRef.current = { clientX: event.clientX, clientY: event.clientY };
    if (frameRef.current !== null) {
      return;
    }

    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      const session = dragSessionRef.current;
      const layer = layerRef.current;
      const pointer = pendingPointerRef.current;
      if (!session || !layer || !pointer) {
        return;
      }

      const rect = layer.getBoundingClientRect();
      const rawX = pointer.clientX - rect.left - session.pointerOffsetX;
      const rawY = pointer.clientY - rect.top - session.pointerOffsetY;
      const snapped = getMagneticPosition(session.blockId, rawX, rawY);
      setAlignmentGuides({ x: snapped.guideX, y: snapped.guideY });
      const previous = lastAppliedPositionRef.current[session.blockId];

      if (previous && previous.x === snapped.x && previous.y === snapped.y) {
        return;
      }

      lastAppliedPositionRef.current[session.blockId] = snapped;
      setFloatingBlockPosition(session.blockId, snapped.x, snapped.y);
    });
  };

  const onUp = () => {
    dragSessionRef.current = null;
    setAlignmentGuides({ x: null, y: null });
    pendingPointerRef.current = null;
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    document.body.style.removeProperty("user-select");
    document.body.style.removeProperty("cursor");
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  };

  const beginDrag = (event: ReactPointerEvent<HTMLDivElement>, block: PosterFloatingParagraphBlock) => {
    if (!canEdit) {
      return;
    }

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
    lastAppliedPositionRef.current[block.id] = { x: Math.round(block.position.x), y: Math.round(block.position.y) };

    document.body.style.userSelect = "none";
    document.body.style.cursor = "move";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  };

  const canStartBorderDrag = (event: ReactPointerEvent<HTMLDivElement>): boolean => {
    const rect = event.currentTarget.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    return (
      localX <= BORDER_DRAG_HIT_PX ||
      localY <= BORDER_DRAG_HIT_PX ||
      localX >= rect.width - BORDER_DRAG_HIT_PX ||
      localY >= rect.height - BORDER_DRAG_HIT_PX
    );
  };

  const bringBlockToFront = (blockId: string) => {
    setActiveBlockId(blockId);
    setZIndexById((current) => {
      const nextZ = ++zCounterRef.current;
      if (current[blockId] === nextZ) {
        return current;
      }

      return {
        ...current,
        [blockId]: nextZ
      };
    });
  };

  return (
    <div className={styles.layer} ref={layerRef}>
      {alignmentGuides.x !== null ? (
        <div className={styles.alignmentGuideVertical} style={{ left: `${alignmentGuides.x}px` }} />
      ) : null}
      {alignmentGuides.y !== null ? (
        <div className={styles.alignmentGuideHorizontal} style={{ top: `${alignmentGuides.y}px` }} />
      ) : null}
      {blocks.map((block) => {
        const commentCount = commentCountByFloatingId?.[block.id] ?? 0;
        return (
        <div
          key={block.id}
          ref={(node) => {
            blockRefs.current[block.id] = node;
          }}
          className={`${styles.block} ${activeBlockId === block.id ? styles.blockActive : ""} ${
            block.appearance?.shape === "circle"
              ? styles.blockCircle
              : block.appearance?.shape === "parallelogram"
                ? styles.blockParallelogram
                : styles.blockRectangle
          }`}
          style={{
            left: `${block.position.x}px`,
            top: `${block.position.y}px`,
            backgroundColor: tonePalette[block.appearance?.tone ?? 1],
            zIndex: zIndexById[block.id] ?? (activeBlockId === block.id ? 220 : 120)
          }}
          onPointerDown={(event) => {
            bringBlockToFront(block.id);
            if (commentMode && canComment) {
              event.preventDefault();
              event.stopPropagation();
              onSelectCommentAnchor?.({ type: "floating", id: block.id });
              return;
            }
            if (!canEdit) {
              return;
            }
            if (isEditorTarget(event.target)) {
              return;
            }
            if (isFloatingControlTarget(event.target)) {
              return;
            }

            if (!canStartBorderDrag(event)) {
              return;
            }

            beginDrag(event, block);
          }}
          onFocusCapture={() => {
            bringBlockToFront(block.id);
          }}
        >
          {commentCount > 0 ? (
            <button
              type="button"
              className={styles.commentMarker}
              aria-label={`${commentCount} comments`}
              data-floating-control="true"
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                bringBlockToFront(block.id);
              }}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                bringBlockToFront(block.id);
                onSelectCommentAnchor?.({ type: "floating", id: block.id });
              }}
            >
              <MessageCircleIcon size={12} />
              <span>{commentCount}</span>
            </button>
          ) : null}
          {canEdit ? <div className={styles.inlineControls} data-floating-control="true">
            <div className={styles.toneControls} aria-label="Floating paragraph color tone">
              {([0, 1, 2, 3] as const).map((tone) => (
                <button
                  key={tone}
                  type="button"
                  className={`${styles.toneSwatch} ${
                    (block.appearance?.tone ?? 1) === tone ? styles.toneSwatchActive : ""
                  }`}
                  data-floating-control="true"
                  style={{ backgroundColor: tonePalette[tone] }}
                  aria-label={`Tone ${tone + 1}`}
                  onMouseDown={(event) => {
                    event.preventDefault();
                  }}
                  onClick={() => {
                    bringBlockToFront(block.id);
                    setFloatingParagraphAppearance(block.id, { tone });
                  }}
                />
              ))}
            </div>
            <div className={styles.shapeControls} aria-label="Floating paragraph shape">
              {(
                [
                  ["rectangle", "Rect"],
                  ["circle", "Circle"],
                  ["parallelogram", "Para"]
                ] as const
              ).map(([shape, label]) => (
                <button
                  key={shape}
                  type="button"
                  className={`${styles.shapeButton} ${
                    (block.appearance?.shape ?? "rectangle") === shape ? styles.shapeButtonActive : ""
                  }`}
                  data-floating-control="true"
                  onMouseDown={(event) => {
                    event.preventDefault();
                  }}
                  onClick={() => {
                    bringBlockToFront(block.id);
                    setFloatingParagraphAppearance(block.id, { shape: shape as FloatingShape });
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className={styles.removeButton}
              data-floating-control="true"
              aria-label="Remove floating paragraph"
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                bringBlockToFront(block.id);
              }}
              onClick={() => {
                removeFloatingParagraph(block.id);
              }}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                <path d="M18 6L6 18M6 6l12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div> : null}
          <div data-floating-editor="true" className={styles.editorShell}>
            <FloatingParagraphEditor
              content={block.content}
              onChange={(content) => setBlockContent(block.id, content)}
              editable={canEdit}
            />
          </div>
        </div>
        );
      })}
    </div>
  );
}
