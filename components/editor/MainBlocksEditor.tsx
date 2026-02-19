"use client";

import { Fragment, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import Image from "next/image";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";

import FloatingParagraphLayer from "@/components/editor/FloatingParagraphLayer";
import ContentControlsMenu from "@/components/editor/menus/ContentControlsMenu";
import styles from "@/components/editor/main-blocks-editor.module.css";
import MainRichTextEditor from "@/components/editor/tiptap/MainRichTextEditor";
import type { PosterFloatingParagraphBlock } from "@/lib/poster/types";
import { uploadPosterAsset } from "@/lib/supabase/assets-client";
import { usePosterEditorStore } from "@/lib/store/poster-store";

interface ResizeSession {
  leftColumnId: string;
  rightColumnId: string;
  startX: number;
  leftStartRatio: number;
  rightStartRatio: number;
  pairStartRatio: number;
  containerWidth: number;
}

interface MainBlocksEditorProps {
  fullscreen?: boolean;
  posterId: string;
  onNotice?: (message: string) => void;
}

const MIN_COLUMN_RATIO = 0.12;
const isPanLockTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(target.closest("button,input,textarea,select,[contenteditable='true'],a,label,.no-pan"));
};

export default function MainBlocksEditor({ fullscreen = false, posterId, onNotice }: MainBlocksEditorProps) {
  const doc = usePosterEditorStore((state) => state.doc);
  const setBlockContent = usePosterEditorStore((state) => state.setBlockContent);
  const addColumn = usePosterEditorStore((state) => state.addColumn);
  const removeColumn = usePosterEditorStore((state) => state.removeColumn);
  const setAdjacentColumnRatios = usePosterEditorStore((state) => state.setAdjacentColumnRatios);
  const addSegment = usePosterEditorStore((state) => state.addSegment);
  const removeSegment = usePosterEditorStore((state) => state.removeSegment);
  const addFloatingParagraph = usePosterEditorStore((state) => state.addFloatingParagraph);
  const addImageBlockToSegment = usePosterEditorStore((state) => state.addImageBlockToSegment);

  const columnsRowRef = useRef<HTMLDivElement | null>(null);
  const zoomViewportRef = useRef<HTMLDivElement | null>(null);
  const resizeSessionRef = useRef<ResizeSession | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [panDisabled, setPanDisabled] = useState(false);
  const [isUploadingImageBlock, setIsUploadingImageBlock] = useState(false);
  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(null);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);

  if (!doc) {
    return null;
  }

  const columnCount = doc.sections.main.columnIds.length;
  const floatingBlocks = Object.values(doc.blocks).filter(
    (block): block is PosterFloatingParagraphBlock => block.type === "floatingParagraph"
  );
  const activeColumnId = selectedColumnId ?? doc.sections.main.columnIds[0] ?? null;
  const activeColumn = activeColumnId ? doc.sections.main.columns[activeColumnId] : null;

  const endResize = () => {
    resizeSessionRef.current = null;
    setIsResizing(false);
    document.body.style.removeProperty("user-select");
    document.body.style.removeProperty("cursor");

    window.removeEventListener("pointermove", onWindowPointerMove);
    window.removeEventListener("pointerup", onWindowPointerUp);
  };

  const onWindowPointerMove = (event: PointerEvent) => {
    const session = resizeSessionRef.current;
    if (!session) {
      return;
    }

    const deltaX = event.clientX - session.startX;
    const deltaRatio = deltaX / session.containerWidth;

    const minLeft = MIN_COLUMN_RATIO;
    const minRight = MIN_COLUMN_RATIO;
    const nextLeft = Math.min(
      session.pairStartRatio - minRight,
      Math.max(minLeft, session.leftStartRatio + deltaRatio)
    );
    const nextRight = session.pairStartRatio - nextLeft;

    setAdjacentColumnRatios(session.leftColumnId, session.rightColumnId, nextLeft, nextRight);
  };

  const onWindowPointerUp = () => {
    endResize();
  };

  const beginResize = (event: ReactPointerEvent<HTMLButtonElement>, leftColumnId: string, rightColumnId: string) => {
    const row = columnsRowRef.current;
    const leftColumn = doc.sections.main.columns[leftColumnId];
    const rightColumn = doc.sections.main.columns[rightColumnId];
    if (!row || !leftColumn || !rightColumn) {
      return;
    }

    const width = row.getBoundingClientRect().width;
    if (width <= 0) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);

    resizeSessionRef.current = {
      leftColumnId,
      rightColumnId,
      startX: event.clientX,
      leftStartRatio: leftColumn.widthRatio,
      rightStartRatio: rightColumn.widthRatio,
      pairStartRatio: leftColumn.widthRatio + rightColumn.widthRatio,
      containerWidth: width
    };

    setIsResizing(true);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";

    window.addEventListener("pointermove", onWindowPointerMove);
    window.addEventListener("pointerup", onWindowPointerUp, { once: true });
  };

  const syncPanWithActiveElement = () => {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) {
      setPanDisabled(false);
      return;
    }

    const inViewport = zoomViewportRef.current?.contains(active) ?? false;
    if (!inViewport) {
      setPanDisabled(false);
      return;
    }

    setPanDisabled(isPanLockTarget(active));
  };

  const uploadImageBlock = async () => {
    if (!activeColumnId || !selectedSegmentId || isUploadingImageBlock) {
      return;
    }

    const picker = document.createElement("input");
    picker.type = "file";
    picker.accept = "image/*";
    picker.onchange = async () => {
      const file = picker.files?.[0];
      if (!file) {
        return;
      }

      setIsUploadingImageBlock(true);
      try {
        const uploaded = await uploadPosterAsset(posterId, file);
        addImageBlockToSegment(activeColumnId, selectedSegmentId, uploaded.assetId, uploaded.signedUrl, file.name);
      } catch (error) {
        onNotice?.(error instanceof Error ? error.message : "Image upload failed");
      } finally {
        setIsUploadingImageBlock(false);
      }
    };
    picker.click();
  };

  return (
    <section className={`${styles.container} ${fullscreen ? styles.containerFullscreen : ""}`}>
      {!fullscreen ? <h2 className={styles.heading}>Main Content</h2> : null}
      {!fullscreen ? <p className={styles.helper}>Supports heading, paragraph, image block, and inline images.</p> : null}
      {!fullscreen ? (
        <div className={styles.controls}>
          <button type="button" className={styles.controlButton} onClick={addColumn} disabled={columnCount >= 5 || isResizing}>
            Add column
          </button>
          <button type="button" className={styles.controlButton} onClick={addFloatingParagraph} disabled={isResizing}>
            Add floating paragraph
          </button>
          <p className={styles.counter}>Columns: {columnCount} / 5</p>
        </div>
      ) : null}

      <TransformWrapper
        minScale={0.45}
        initialScale={1}
        maxScale={2.6}
        centerOnInit={false}
        panning={{ disabled: panDisabled || isResizing, velocityDisabled: true }}
        wheel={{ step: 0.08 }}
        doubleClick={{ disabled: true }}
      >
        {({ zoomIn, zoomOut, resetTransform, instance }) => (
          <div className={styles.zoomShell}>
            <div className={`${styles.controls} ${styles.noPan} ${fullscreen ? styles.zoomDock : ""}`}>
              <button type="button" className={styles.controlButton} onClick={() => zoomOut()}>
                Zoom -
              </button>
              <button type="button" className={styles.controlButton} onClick={() => zoomIn()}>
                Zoom +
              </button>
              <button type="button" className={styles.controlButton} onClick={() => resetTransform()}>
                Reset
              </button>
              <p className={styles.counter}>Scale: {(instance.transformState.scale * 100).toFixed(0)}%</p>
            </div>

            <div
              className={styles.zoomViewport}
              ref={zoomViewportRef}
              onPointerDownCapture={(event) => {
                setPanDisabled(isPanLockTarget(event.target));
              }}
              onPointerUpCapture={() => {
                queueMicrotask(syncPanWithActiveElement);
              }}
              onFocusCapture={(event) => {
                setPanDisabled(isPanLockTarget(event.target));
              }}
              onBlurCapture={() => {
                queueMicrotask(syncPanWithActiveElement);
              }}
            >
              <TransformComponent wrapperClass={styles.transformWrapper} contentClass={styles.transformContent}>
                <div className={styles.canvasArea}>
                  <div className={styles.columnsRow} ref={columnsRowRef}>
                    {doc.sections.main.columnIds.map((columnId, columnIndex) => {
                      const column = doc.sections.main.columns[columnId];
                      const nextColumnId = doc.sections.main.columnIds[columnIndex + 1];
                      if (!column) {
                        return null;
                      }

                      return (
                        <Fragment key={column.id}>
                          <article
                            className={`${styles.column} ${selectedColumnId === column.id ? styles.columnActive : ""}`}
                            style={{ flexGrow: column.widthRatio }}
                            onPointerDown={() => {
                              setSelectedColumnId(column.id);
                              setSelectedSegmentId(null);
                            }}
                          >
                            <div className={styles.columnHeader}>
                              <p className={styles.segmentMeta}>Column {columnIndex + 1}</p>
                            </div>

                            {column.segments.map((segment, segmentIndex) => (
                              <div
                                key={segment.id}
                                className={`${styles.segment} ${selectedSegmentId === segment.id ? styles.segmentActive : ""}`}
                                onPointerDown={(event) => {
                                  event.stopPropagation();
                                  setSelectedColumnId(column.id);
                                  setSelectedSegmentId(segment.id);
                                }}
                              >
                                <div className={styles.columnHeader}>
                                  <p className={styles.segmentMeta}>Segment {segmentIndex + 1}</p>
                                </div>

                                {segment.blockIds.map((blockId) => {
                                  const block = doc.blocks[blockId];
                                  if (!block) {
                                    return null;
                                  }

                                  if (block.type === "text") {
                                    return (
                                      <MainRichTextEditor
                                        key={block.id}
                                        posterId={posterId}
                                        content={block.content}
                                        onChange={(content) => setBlockContent(block.id, content)}
                                        onError={onNotice}
                                      />
                                    );
                                  }

                                  if (block.type === "image") {
                                    return (
                                      <p key={block.id} className={styles.imagePlaceholder}>
                                        <Image
                                          className={styles.imagePreview}
                                          src={block.src}
                                          alt={block.alt}
                                          width={1200}
                                          height={800}
                                        />
                                        <span className={styles.imageCaption}>{block.alt}</span>
                                      </p>
                                    );
                                  }

                                  return null;
                                })}
                              </div>
                            ))}
                          </article>

                          {nextColumnId ? (
                            <button
                              type="button"
                              aria-label={`Resize between column ${columnIndex + 1} and ${columnIndex + 2}`}
                              className={styles.resizeHandle}
                              onPointerDown={(event) => beginResize(event, column.id, nextColumnId)}
                            />
                          ) : null}
                        </Fragment>
                      );
                    })}
                  </div>

                  <FloatingParagraphLayer blocks={floatingBlocks} />
                </div>
              </TransformComponent>
            </div>
            <div className={styles.bottomCenterDock}>
              <ContentControlsMenu
                columnCount={columnCount}
                canRemoveColumn={Boolean(activeColumnId) && columnCount > 1}
                canRemoveSegment={(activeColumn?.segments.length ?? 0) > 1 && Boolean(selectedSegmentId)}
                onAddColumn={addColumn}
                onRemoveSelectedColumn={() => {
                  if (!activeColumnId) {
                    return;
                  }

                  removeColumn(activeColumnId);
                  setSelectedColumnId(null);
                  setSelectedSegmentId(null);
                }}
                onAddSegment={() => {
                  if (!activeColumnId) {
                    return;
                  }

                  addSegment(activeColumnId);
                }}
                onRemoveSelectedSegment={() => {
                  if (!activeColumnId || !selectedSegmentId) {
                    return;
                  }

                  removeSegment(activeColumnId, selectedSegmentId);
                  setSelectedSegmentId(null);
                }}
                onAddFloatingParagraph={addFloatingParagraph}
                onAddImageBlock={uploadImageBlock}
                imageBlockDisabled={!activeColumnId || !selectedSegmentId || isUploadingImageBlock}
              />
            </div>
          </div>
        )}
      </TransformWrapper>
    </section>
  );
}
