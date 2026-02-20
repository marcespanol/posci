"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";

import FloatingParagraphLayer from "@/components/editor/FloatingParagraphLayer";
import ContentControlsMenu from "@/components/editor/menus/ContentControlsMenu";
import styles from "@/components/editor/main-blocks-editor.module.css";
import MainRichTextEditor from "@/components/editor/tiptap/MainRichTextEditor";
import { renderTipTapDocToHtml } from "@/lib/poster/render-html";
import type { PosterFloatingParagraphBlock, TipTapJsonContent } from "@/lib/poster/types";
import { uploadPosterAsset } from "@/lib/supabase/assets-client";
import { usePosterEditorStore } from "@/lib/store/poster-store";

interface MainBlocksEditorProps {
  fullscreen?: boolean;
}

const MIN_COLUMN_SIZE_PERCENT = 12;
const MIN_ROW_SIZE_PERCENT = 8;

const isPanLockTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(target.closest("button,input,textarea,select,[contenteditable='true'],a,label,.no-pan"));
};

export default function MainBlocksEditor({ fullscreen = false }: MainBlocksEditorProps) {
  const doc = usePosterEditorStore((state) => state.doc);
  const posterId = usePosterEditorStore((state) => state.posterId);
  const setBlockContent = usePosterEditorStore((state) => state.setBlockContent);
  const addColumn = usePosterEditorStore((state) => state.addColumn);
  const removeColumn = usePosterEditorStore((state) => state.removeColumn);
  const ensureColumnHasTextBlock = usePosterEditorStore((state) => state.ensureColumnHasTextBlock);
  const setColumnLayoutRatios = usePosterEditorStore((state) => state.setColumnLayoutRatios);
  const setColumnSegmentLayoutRatios = usePosterEditorStore((state) => state.setColumnSegmentLayoutRatios);
  const addSegment = usePosterEditorStore((state) => state.addSegment);
  const removeSegment = usePosterEditorStore((state) => state.removeSegment);
  const addFloatingParagraph = usePosterEditorStore((state) => state.addFloatingParagraph);

  const zoomViewportRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [panDisabled, setPanDisabled] = useState(false);
  const [spacePanMode, setSpacePanMode] = useState(false);
  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(null);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);

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

  const columnIds = doc?.sections.main.columnIds;

  useEffect(() => {
    if (!columnIds) {
      return;
    }

    columnIds.forEach((columnId) => {
      ensureColumnHasTextBlock(columnId);
    });
  }, [columnIds, ensureColumnHasTextBlock]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space") {
        return;
      }

      if (event.repeat) {
        return;
      }

      setSpacePanMode(true);
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== "Space") {
        return;
      }

      setSpacePanMode(false);
    };

    const onWindowBlur = () => {
      setSpacePanMode(false);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onWindowBlur);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onWindowBlur);
    };
  }, []);

  if (!doc) {
    return null;
  }

  const columnCount = doc.sections.main.columnIds.length;
  const artboardSizeClass =
    doc.meta.sizePreset === "A1"
      ? doc.meta.orientation === "landscape"
        ? styles.artboardA1Landscape
        : styles.artboardA1Portrait
      : doc.meta.orientation === "landscape"
        ? styles.artboardScreenLandscape
        : styles.artboardScreenPortrait;
  const artboardColorClass = doc.meta.colorTheme === "GREEN" ? styles.themeGreen : styles.themeBlue;
  const artboardTypeClass =
    doc.meta.typographyTheme === "SANS_HEADERS_MONO_BODY" ? styles.typeSansMono : styles.typeSerifSans;
  const floatingBlocks = Object.values(doc.blocks).filter(
    (block): block is PosterFloatingParagraphBlock => block.type === "floatingParagraph"
  );
  const activeColumnId = selectedColumnId ?? doc.sections.main.columnIds[0] ?? null;
  const activeColumn = activeColumnId ? doc.sections.main.columns[activeColumnId] : null;
  const activeRowCount = activeColumn?.segments.length ?? 0;

  const getSegmentTextBlockId = (blockIds: string[]): string | null => {
    for (const blockId of blockIds) {
      const block = doc.blocks[blockId];
      if (block?.type === "text") {
        return blockId;
      }
    }

    return null;
  };

  const appendImageToDoc = (content: TipTapJsonContent, src: string, alt: string): TipTapJsonContent => {
    const currentBlocks = Array.isArray(content.content) ? [...content.content] : [];
    currentBlocks.push({
      type: "image",
      attrs: {
        src,
        alt,
        width: 520
      }
    });

    return {
      ...content,
      type: "doc",
      content: currentBlocks
    };
  };

  const getTargetTextBlockId = (): string | null => {
    const targetColumnId = activeColumnId ?? doc.sections.main.columnIds[0] ?? null;
    if (!targetColumnId) {
      return null;
    }

    const column = doc.sections.main.columns[targetColumnId];
    if (!column) {
      return null;
    }

    const segment =
      (selectedSegmentId ? column.segments.find((item) => item.id === selectedSegmentId) : null) ?? column.segments[0];
    if (!segment) {
      return null;
    }

    return getSegmentTextBlockId(segment.blockIds);
  };

  const onImageFilePicked = (file: File) => {
    if (!posterId) {
      return;
    }

    const targetTextBlockId = getTargetTextBlockId();
    if (!targetTextBlockId) {
      return;
    }

    const targetBlock = doc.blocks[targetTextBlockId];
    if (!targetBlock || targetBlock.type !== "text") {
      return;
    }

    void (async () => {
      try {
        const uploaded = await uploadPosterAsset(posterId, file);
        const nextContent = appendImageToDoc(targetBlock.content, uploaded.signedUrl, file.name || "Uploaded image");
        setBlockContent(targetTextBlockId, nextContent);
      } catch (error) {
        console.error("Add image failed", error);
      }
    })();
  };

  return (
    <section className={`${styles.container} ${fullscreen ? styles.containerFullscreen : ""}`}>
      {!fullscreen ? <h2 className={styles.heading}>Main Content</h2> : null}
      {!fullscreen ? <p className={styles.helper}>Supports heading, paragraph, image block, and inline images.</p> : null}
      {!fullscreen ? (
        <div className={styles.controls}>
          <button type="button" className={styles.controlButton} onClick={addColumn} disabled={columnCount >= 5}>
            Add column
          </button>
          <button type="button" className={styles.controlButton} onClick={addFloatingParagraph}>
            Add floating paragraph
          </button>
          <p className={styles.counter}>Columns: {columnCount} / 5</p>
        </div>
      ) : null}

      <TransformWrapper
        minScale={0.1}
        initialScale={1}
        maxScale={2.6}
        centerOnInit
        centerZoomedOut
        panning={{
          disabled: spacePanMode ? false : panDisabled,
          velocityDisabled: true,
          allowLeftClickPan: spacePanMode,
          allowMiddleClickPan: true,
          allowRightClickPan: false,
          activationKeys: [],
          excluded: spacePanMode ? ["input", "textarea", "select", "button", "a"] : ["input", "textarea", "select", "button", "a", "ProseMirror"]
        }}
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
              className={`${styles.zoomViewport} ${spacePanMode ? styles.spacePanMode : ""}`}
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
                  <article
                    data-poster-artboard="true"
                    className={`${styles.artboard} ${artboardSizeClass} ${artboardColorClass} ${artboardTypeClass}`}
                  >
                    <header
                      className={`${styles.artboardHeader} ${styles.richText}`}
                      dangerouslySetInnerHTML={{ __html: renderTipTapDocToHtml(doc.sections.header.content) }}
                    />

                    <section className={styles.artboardMain}>
                      <PanelGroup
                        direction="horizontal"
                        className={styles.columnsPanelGroup}
                        onLayout={(sizes) => {
                          setColumnLayoutRatios(doc.sections.main.columnIds, sizes);
                        }}
                      >
                        {doc.sections.main.columnIds.map((columnId, columnIndex) => {
                          const column = doc.sections.main.columns[columnId];
                          if (!column) {
                            return null;
                          }

                          const segmentCount = column.segments.length;
                          const segmentIds = column.segments.map((segment) => segment.id);

                          return (
                            <Fragment key={column.id}>
                              <Panel
                                defaultSize={Math.max(1, column.widthRatio * 100)}
                                minSize={MIN_COLUMN_SIZE_PERCENT}
                                className={styles.columnPanel}
                              >
                                <article
                                  className={`${styles.column} ${selectedColumnId === column.id ? styles.columnActive : ""}`}
                                  onPointerDown={() => {
                                    setSelectedColumnId(column.id);
                                  }}
                                >
                                  <PanelGroup
                                    direction="vertical"
                                    className={styles.columnRows}
                                    onLayout={(sizes) => {
                                      setColumnSegmentLayoutRatios(column.id, segmentIds, sizes);
                                    }}
                                  >
                                    {column.segments.map((segment, segmentIndex) => {
                                      const textBlockId = getSegmentTextBlockId(segment.blockIds);
                                      const textBlock = textBlockId ? doc.blocks[textBlockId] : null;
                                      const defaultSize = (segment.heightRatio ?? 1 / Math.max(segmentCount, 1)) * 100;

                                      return (
                                        <Fragment key={segment.id}>
                                          <Panel defaultSize={Math.max(1, defaultSize)} minSize={MIN_ROW_SIZE_PERCENT}>
                                            <section
                                              className={styles.rowSegment}
                                              onPointerDown={() => {
                                                setSelectedColumnId(column.id);
                                                setSelectedSegmentId(segment.id);
                                              }}
                                            >
                                              <div className={styles.columnEditorHost}>
                                                {!textBlockId || !textBlock || textBlock.type !== "text" ? (
                                                  <div className={styles.emptyState}>No text block in this row.</div>
                                                ) : (
                                                  <MainRichTextEditor
                                                    key={textBlock.id}
                                                    content={textBlock.content}
                                                    onChange={(content) => setBlockContent(textBlock.id, content)}
                                                  />
                                                )}
                                              </div>
                                            </section>
                                          </Panel>
                                          {segmentIndex < segmentCount - 1 ? (
                                            <PanelResizeHandle className={`${styles.rowResizeHandle} ${styles.noPan}`} />
                                          ) : null}
                                        </Fragment>
                                      );
                                    })}
                                  </PanelGroup>
                                </article>
                              </Panel>
                              {columnIndex < doc.sections.main.columnIds.length - 1 ? (
                                <PanelResizeHandle className={`${styles.resizeHandle} ${styles.noPan}`} />
                              ) : null}
                            </Fragment>
                          );
                        })}
                      </PanelGroup>

                      <FloatingParagraphLayer blocks={floatingBlocks} />
                    </section>

                    {doc.meta.footerVisible ? (
                      <footer
                        className={`${styles.artboardFooter} ${styles.richText}`}
                        dangerouslySetInnerHTML={{ __html: renderTipTapDocToHtml(doc.sections.footer.content) }}
                      />
                    ) : null}
                  </article>
                </div>
              </TransformComponent>
            </div>
            <div className={styles.bottomCenterDock}>
              <ContentControlsMenu
                columnCount={columnCount}
                canRemoveColumn={Boolean(activeColumnId) && columnCount > 1}
                rowCount={activeRowCount}
                canAddRow={Boolean(activeColumnId) && activeRowCount < 5}
                canRemoveRow={Boolean(activeColumnId) && activeRowCount > 1}
                onAddColumn={addColumn}
                onRemoveSelectedColumn={() => {
                  if (!activeColumnId) {
                    return;
                  }

                  removeColumn(activeColumnId);
                  setSelectedColumnId(null);
                }}
                onAddRow={() => {
                  if (!activeColumnId) {
                    return;
                  }

                  addSegment(activeColumnId);
                }}
                onRemoveRow={() => {
                  if (!activeColumnId) {
                    return;
                  }

                  const column = doc.sections.main.columns[activeColumnId];
                  if (!column) {
                    return;
                  }

                  const lastSegment = column.segments[column.segments.length - 1];
                  if (!lastSegment) {
                    return;
                  }

                  removeSegment(activeColumnId, lastSegment.id);
                }}
                onAddImage={() => {
                  imageInputRef.current?.click();
                }}
                onAddFloatingParagraph={addFloatingParagraph}
              />
            </div>
          </div>
        )}
      </TransformWrapper>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            onImageFilePicked(file);
          }

          event.target.value = "";
        }}
      />
    </section>
  );
}
