"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import styles from "@/components/editor/main-blocks-editor.module.css";
import MainRichTextEditor from "@/components/editor/tiptap/MainRichTextEditor";
import type { PosterDocV2, PosterMainRegion, TipTapJsonContent } from "@/lib/poster/types";

type GridResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

interface GridPreviewDragState {
  regionId: string;
  mode: "move" | "resize";
  handle?: GridResizeHandle;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  origin: Pick<PosterMainRegion, "x" | "y" | "w" | "h">;
}

interface GridMainRendererProps {
  v2Doc: PosterDocV2;
  regions: PosterMainRegion[];
  selectedRegionId: string | null;
  drawMode: boolean;
  onSelectRegion: (regionId: string) => void;
  onActivateGridRegion: (regionId: string) => void;
  onUpdateRegionRect: (
    regionId: string,
    rect: Pick<PosterMainRegion, "x" | "y" | "w" | "h">,
    grid: { cols: number; rows: number }
  ) => boolean;
  onCreateRegion: (rect: Pick<PosterMainRegion, "x" | "y" | "w" | "h">) => boolean;
  onCreateRegionResult?: (result: "created" | "blocked") => void;
  onSetBlockContent: (blockId: string, content: TipTapJsonContent) => void;
}

interface GridCreateDragState {
  pointerId: number;
  startCellX: number;
  startCellY: number;
}

const rectsOverlap = (
  a: Pick<PosterMainRegion, "x" | "y" | "w" | "h">,
  b: Pick<PosterMainRegion, "x" | "y" | "w" | "h">
): boolean => {
  const xOverlap = a.x < b.x + b.w && a.x + a.w > b.x;
  const yOverlap = a.y < b.y + b.h && a.y + a.h > b.y;
  return xOverlap && yOverlap;
};

export default function GridMainRenderer({
  v2Doc,
  regions,
  selectedRegionId,
  drawMode,
  onSelectRegion,
  onActivateGridRegion,
  onUpdateRegionRect,
  onCreateRegion,
  onCreateRegionResult,
  onSetBlockContent
}: GridMainRendererProps) {
  const gridStageRef = useRef<HTMLDivElement | null>(null);
  const [gridDragState, setGridDragState] = useState<GridPreviewDragState | null>(null);
  const [createDragState, setCreateDragState] = useState<GridCreateDragState | null>(null);
  const [createPreviewRect, setCreatePreviewRect] = useState<Pick<PosterMainRegion, "x" | "y" | "w" | "h"> | null>(null);
  const createPreviewBlocked = useMemo(() => {
    if (!createPreviewRect) {
      return false;
    }

    return regions.some((region) => rectsOverlap(createPreviewRect, region));
  }, [createPreviewRect, regions]);

  useEffect(() => {
    if (!gridDragState) {
      return;
    }

    const MIN_W = 1;
    const MIN_H = 1;

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerId !== gridDragState.pointerId) {
        return;
      }

      const stageEl = gridStageRef.current;
      if (!stageEl) {
        return;
      }

      const rect = stageEl.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        return;
      }

      const cellWidth = rect.width / v2Doc.sections.main.grid.cols;
      const cellHeight = rect.height / v2Doc.sections.main.grid.rows;
      const dxUnits = Math.round((event.clientX - gridDragState.startClientX) / Math.max(cellWidth, 1));
      const dyUnits = Math.round((event.clientY - gridDragState.startClientY) / Math.max(cellHeight, 1));

      const target = regions.find((region) => region.id === gridDragState.regionId);
      if (!target) {
        return;
      }

      let nextRect: Pick<PosterMainRegion, "x" | "y" | "w" | "h"> = { ...gridDragState.origin };
      const gridCols = v2Doc.sections.main.grid.cols;
      const gridRows = v2Doc.sections.main.grid.rows;

      if (gridDragState.mode === "move") {
        nextRect = {
          ...nextRect,
          x: Math.max(0, Math.min(gridCols - nextRect.w, gridDragState.origin.x + dxUnits)),
          y: Math.max(0, Math.min(gridRows - nextRect.h, gridDragState.origin.y + dyUnits))
        };
      } else {
        const handle = gridDragState.handle;
        if (!handle) {
          return;
        }

        let left = gridDragState.origin.x;
        let top = gridDragState.origin.y;
        let right = gridDragState.origin.x + gridDragState.origin.w;
        let bottom = gridDragState.origin.y + gridDragState.origin.h;

        if (handle.includes("e")) {
          right = Math.max(left + MIN_W, Math.min(gridCols, right + dxUnits));
        }
        if (handle.includes("s")) {
          bottom = Math.max(top + MIN_H, Math.min(gridRows, bottom + dyUnits));
        }
        if (handle.includes("w")) {
          left = Math.max(0, Math.min(right - MIN_W, left + dxUnits));
        }
        if (handle.includes("n")) {
          top = Math.max(0, Math.min(bottom - MIN_H, top + dyUnits));
        }

        nextRect = {
          x: left,
          y: top,
          w: right - left,
          h: bottom - top
        };
      }

      onUpdateRegionRect(gridDragState.regionId, nextRect, {
        cols: v2Doc.sections.main.grid.cols,
        rows: v2Doc.sections.main.grid.rows
      });
    };

    const endDrag = (event: PointerEvent) => {
      if (event.pointerId !== gridDragState.pointerId) {
        return;
      }

      setGridDragState(null);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
    };
  }, [gridDragState, onUpdateRegionRect, regions, v2Doc]);

  useEffect(() => {
    if (!createDragState || !drawMode) {
      return;
    }

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerId !== createDragState.pointerId) {
        return;
      }

      const stageEl = gridStageRef.current;
      if (!stageEl) {
        return;
      }

      const rect = stageEl.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        return;
      }

      const cols = v2Doc.sections.main.grid.cols;
      const rows = v2Doc.sections.main.grid.rows;
      const cellWidth = rect.width / cols;
      const cellHeight = rect.height / rows;
      const currentCellX = Math.max(0, Math.min(cols - 1, Math.floor((event.clientX - rect.left) / Math.max(cellWidth, 1))));
      const currentCellY = Math.max(0, Math.min(rows - 1, Math.floor((event.clientY - rect.top) / Math.max(cellHeight, 1))));

      const minX = Math.min(createDragState.startCellX, currentCellX);
      const minY = Math.min(createDragState.startCellY, currentCellY);
      const maxX = Math.max(createDragState.startCellX, currentCellX);
      const maxY = Math.max(createDragState.startCellY, currentCellY);

      setCreatePreviewRect({
        x: minX,
        y: minY,
        w: maxX - minX + 1,
        h: maxY - minY + 1
      });
    };

    const endCreateDrag = (event: PointerEvent) => {
      if (event.pointerId !== createDragState.pointerId) {
        return;
      }

      const finalRect = createPreviewRect;
      setCreateDragState(null);
      setCreatePreviewRect(null);

      if (!finalRect) {
        return;
      }

      if (regions.some((region) => rectsOverlap(finalRect, region))) {
        onCreateRegionResult?.("blocked");
        return;
      }

      const created = onCreateRegion(finalRect);
      onCreateRegionResult?.(created ? "created" : "blocked");
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endCreateDrag);
    window.addEventListener("pointercancel", endCreateDrag);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", endCreateDrag);
      window.removeEventListener("pointercancel", endCreateDrag);
    };
  }, [createDragState, createPreviewRect, drawMode, onCreateRegion, onCreateRegionResult, regions, v2Doc]);

  useEffect(() => {
    if (!drawMode) {
      setCreateDragState(null);
      setCreatePreviewRect(null);
    }
  }, [drawMode]);

  const startGridRegionMove = (event: ReactPointerEvent<HTMLElement>, region: PosterMainRegion) => {
    if (event.button !== 0) {
      return;
    }
    if (drawMode) {
      return;
    }

    const target = event.target;
    if (target instanceof HTMLElement && target.closest(".ProseMirror, button, input, textarea, select")) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    onSelectRegion(region.id);
    onActivateGridRegion(region.id);
    setGridDragState({
      regionId: region.id,
      mode: "move",
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      origin: {
        x: region.x,
        y: region.y,
        w: region.w,
        h: region.h
      }
    });
  };

  const startGridRegionResize =
    (handle: GridResizeHandle, region: PosterMainRegion) => (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      onSelectRegion(region.id);
      onActivateGridRegion(region.id);
      setGridDragState({
        regionId: region.id,
        mode: "resize",
        handle,
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        origin: {
          x: region.x,
          y: region.y,
          w: region.w,
          h: region.h
        }
      });
    };

  return (
    <div className={styles.gridMainShell}>
      <div className={styles.gridOverlay} aria-hidden="true" />
      <div
        ref={gridStageRef}
        className={`${styles.gridStage} ${drawMode ? styles.gridStageDrawMode : ""}`}
        onPointerDown={(event) => {
          if (!drawMode || event.button !== 0) {
            return;
          }

          const target = event.target;
          if (target instanceof HTMLElement && target.closest(`.${styles.gridRegion}`)) {
            return;
          }

          const rect = gridStageRef.current?.getBoundingClientRect();
          if (!rect || rect.width <= 0 || rect.height <= 0) {
            return;
          }

          const cols = v2Doc.sections.main.grid.cols;
          const rows = v2Doc.sections.main.grid.rows;
          const cellWidth = rect.width / cols;
          const cellHeight = rect.height / rows;
          const cellX = Math.max(0, Math.min(cols - 1, Math.floor((event.clientX - rect.left) / Math.max(cellWidth, 1))));
          const cellY = Math.max(0, Math.min(rows - 1, Math.floor((event.clientY - rect.top) / Math.max(cellHeight, 1))));

          event.preventDefault();
          event.stopPropagation();
          setCreateDragState({
            pointerId: event.pointerId,
            startCellX: cellX,
            startCellY: cellY
          });
          setCreatePreviewRect({
            x: cellX,
            y: cellY,
            w: 1,
            h: 1
          });
        }}
      >
        {createPreviewRect ? (
          <div
            className={`${styles.gridCreatePreview} ${createPreviewBlocked ? styles.gridCreatePreviewBlocked : ""}`}
            style={{
              gridColumn: `${createPreviewRect.x + 1} / span ${createPreviewRect.w}`,
              gridRow: `${createPreviewRect.y + 1} / span ${createPreviewRect.h}`
            }}
          />
        ) : null}
        {regions.map((region) => {
          const block = v2Doc.blocks[region.blockId];
          const isActive = selectedRegionId === region.id;

          return (
            <section
              key={region.id}
              className={`${styles.gridRegion} ${isActive ? styles.gridRegionActive : ""}`}
              style={{
                gridColumn: `${region.x + 1} / span ${region.w}`,
                gridRow: `${region.y + 1} / span ${region.h}`
              }}
              onPointerDown={(event) => {
                if (drawMode) {
                  return;
                }
                onActivateGridRegion(region.id);
                startGridRegionMove(event, region);
              }}
            >
              <div className={styles.columnEditorHost}>
                {!block ? (
                  <div className={styles.emptyState}>Missing block.</div>
                ) : block.type === "text" ? (
                  <MainRichTextEditor
                    key={block.id}
                    content={block.content}
                    onChange={(content) => onSetBlockContent(block.id, content)}
                  />
                ) : block.type === "image" ? (
                  <div className={styles.emptyState}>Image block region (v2 preview).</div>
                ) : (
                  <div className={styles.emptyState}>Unsupported block type in region.</div>
                )}
              </div>
              {isActive ? (
                <>
                  <button
                    type="button"
                    className={`${styles.gridResizeKnob} ${styles.gridResizeNw} ${styles.noPan}`}
                    aria-label="Resize north-west"
                    onPointerDown={startGridRegionResize("nw", region)}
                  />
                  <button
                    type="button"
                    className={`${styles.gridResizeKnob} ${styles.gridResizeNe} ${styles.noPan}`}
                    aria-label="Resize north-east"
                    onPointerDown={startGridRegionResize("ne", region)}
                  />
                  <button
                    type="button"
                    className={`${styles.gridResizeKnob} ${styles.gridResizeSw} ${styles.noPan}`}
                    aria-label="Resize south-west"
                    onPointerDown={startGridRegionResize("sw", region)}
                  />
                  <button
                    type="button"
                    className={`${styles.gridResizeKnob} ${styles.gridResizeSe} ${styles.noPan}`}
                    aria-label="Resize south-east"
                    onPointerDown={startGridRegionResize("se", region)}
                  />
                  <button
                    type="button"
                    className={`${styles.gridResizeEdge} ${styles.gridResizeN} ${styles.noPan}`}
                    aria-label="Resize north"
                    onPointerDown={startGridRegionResize("n", region)}
                  />
                  <button
                    type="button"
                    className={`${styles.gridResizeEdge} ${styles.gridResizeS} ${styles.noPan}`}
                    aria-label="Resize south"
                    onPointerDown={startGridRegionResize("s", region)}
                  />
                  <button
                    type="button"
                    className={`${styles.gridResizeEdge} ${styles.gridResizeE} ${styles.noPan}`}
                    aria-label="Resize east"
                    onPointerDown={startGridRegionResize("e", region)}
                  />
                  <button
                    type="button"
                    className={`${styles.gridResizeEdge} ${styles.gridResizeW} ${styles.noPan}`}
                    aria-label="Resize west"
                    onPointerDown={startGridRegionResize("w", region)}
                  />
                </>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
