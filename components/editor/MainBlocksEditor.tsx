"use client";

import { useEffect, useRef, useState } from "react";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";

import FloatingParagraphLayer from "@/components/editor/FloatingParagraphLayer";
import GridMainRenderer from "@/components/editor/GridMainRenderer";
import GridLayoutControls from "@/components/editor/menus/GridLayoutControls";
import styles from "@/components/editor/main-blocks-editor.module.css";
import RichTextMarksEditor from "@/components/editor/tiptap/RichTextMarksEditor";
import { usePosterGridFacade } from "@/components/editor/usePosterGridFacade";
import { useGridLayoutControlActions } from "@/components/editor/useGridLayoutControlActions";
import { usePosterImageInsertion } from "@/components/editor/usePosterImageInsertion";
import { useGridPreviewRuntime } from "@/components/editor/useGridPreviewRuntime";
import { useMainTextBlockTargetResolver } from "@/components/editor/useMainTextBlockTargetResolver";
import {
  selectPosterReadDoc
} from "@/lib/store/poster-read-selectors";
import type { PosterFloatingParagraphBlock } from "@/lib/poster/types";
import { usePosterEditorStore } from "@/lib/store/poster-store";

interface MainBlocksEditorProps {
  fullscreen?: boolean;
}

const isPanLockTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(target.closest("button,input,textarea,select,[contenteditable='true'],a,label,.no-pan"));
};

export default function MainBlocksEditor({ fullscreen = false }: MainBlocksEditorProps) {
  const readDoc = usePosterEditorStore(selectPosterReadDoc);
  const posterId = usePosterEditorStore((state) => state.posterId);
  const setBlockContent = usePosterEditorStore((state) => state.setBlockContent);
  const setHeaderContent = usePosterEditorStore((state) => state.setHeaderContent);
  const setHeaderSubtitleContent = usePosterEditorStore((state) => state.setHeaderSubtitleContent);
  const setFooterContent = usePosterEditorStore((state) => state.setFooterContent);
  const addFloatingParagraph = usePosterEditorStore((state) => state.addFloatingParagraph);
  const grid = usePosterGridFacade();
  const initializeGridRegions = grid.initializeRegions;
  const selectGridRegion = grid.selectRegion;
  const gridModeDocV2 = usePosterEditorStore((state) => state.gridModeDocV2);

  const zoomViewportRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [panDisabled, setPanDisabled] = useState(false);
  const [spacePanMode, setSpacePanMode] = useState(false);
  const [gridDrawMode, setGridDrawMode] = useState(false);
  const [gridDrawStatusText, setGridDrawStatusText] = useState<string | null>(null);

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

  useEffect(() => {
    if (!gridDrawStatusText) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setGridDrawStatusText(null);
    }, 1800);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [gridDrawStatusText]);

  const { v2PreviewDoc, isGridPreviewMode } = useGridPreviewRuntime({
    gridModeDocV2,
    initializeRegions: initializeGridRegions,
    selectRegion: selectGridRegion
  });

  const gridDockActions = useGridLayoutControlActions({
    selectedRegionId: grid.selectedRegionId,
    moveRegionBy: grid.moveRegionBy,
    splitHorizontal: grid.splitHorizontal,
    splitVertical: grid.splitVertical,
    mergeLeft: grid.mergeLeft,
    mergeRight: grid.mergeRight,
    deleteRegion: grid.deleteRegion,
    onAddImage: () => {
      imageInputRef.current?.click();
    }
  });

  const getTargetTextBlockId = useMainTextBlockTargetResolver({
    v2PreviewDoc,
    gridSelectedRegionId: grid.selectedRegionId,
    gridRegions: grid.regions,
    getLegacyTargetTextBlockId: () => null
  });

  const onImageFilePicked = usePosterImageInsertion({
    posterId,
    blocks: readDoc?.blocks ?? {},
    resolveTargetTextBlockId: getTargetTextBlockId,
    setBlockContent
  });

  if (!readDoc) {
    return null;
  }
  const artboardSizeClass =
    readDoc.meta.sizePreset === "A1"
      ? readDoc.meta.orientation === "landscape"
        ? styles.artboardA1Landscape
        : styles.artboardA1Portrait
      : readDoc.meta.orientation === "landscape"
        ? styles.artboardScreenLandscape
        : styles.artboardScreenPortrait;
  const artboardColorClass = readDoc.meta.colorTheme === "GREEN" ? styles.themeGreen : styles.themeBlue;
  const artboardTypeClass =
    readDoc.meta.typographyTheme === "SANS_HEADERS_MONO_BODY" ? styles.typeSansMono : styles.typeSerifSans;
  const floatingBlocks = Object.values(readDoc.blocks).filter(
    (block): block is PosterFloatingParagraphBlock => block.type === "floatingParagraph"
  );

  return (
    <section className={`${styles.container} ${fullscreen ? styles.containerFullscreen : ""}`}>
      {!fullscreen ? <h2 className={styles.heading}>Main Content</h2> : null}
      {!fullscreen ? <p className={styles.helper}>Supports heading, paragraph, image block, and inline images.</p> : null}
      {!fullscreen ? (
        <div className={styles.controls}>
          <button type="button" className={styles.controlButton} onClick={addFloatingParagraph}>
            Add floating paragraph
          </button>
          <p className={styles.counter}>Regions: {grid.regions.length}</p>
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
                    >
                      <RichTextMarksEditor
                        content={readDoc.sections.header.content}
                        onChange={setHeaderContent}
                        variant="artboardHeader"
                      />
                      {(readDoc.meta.headerSubtitleVisible ?? true) && readDoc.sections.headerSubtitle ? (
                        <RichTextMarksEditor
                          content={readDoc.sections.headerSubtitle.content}
                          onChange={setHeaderSubtitleContent}
                          singleLine
                          variant="artboardFooter"
                        />
                      ) : null}
                    </header>

                    <section className={styles.artboardMain}>
                      {v2PreviewDoc ? (
                        <GridMainRenderer
                          v2Doc={v2PreviewDoc}
                          regions={grid.regions}
                          selectedRegionId={grid.selectedRegionId}
                          drawMode={gridDrawMode}
                          onSelectRegion={grid.selectRegion}
                          onActivateGridRegion={(regionId) => {
                            grid.selectRegion(regionId);
                          }}
                          onUpdateRegionRect={grid.updateRegionRect}
                          onCreateRegion={grid.createRegion}
                          onCreateRegionResult={(result) => {
                            if (result === "created") {
                              setGridDrawStatusText("Region created");
                              setGridDrawMode(false);
                              return;
                            }

                            setGridDrawStatusText("Blocked: overlaps an existing region");
                          }}
                          onSetBlockContent={setBlockContent}
                        />
                      ) : null}

                      <FloatingParagraphLayer blocks={floatingBlocks} />
                    </section>

                    {readDoc.meta.footerVisible ? (
                      <footer
                        className={`${styles.artboardFooter} ${styles.richText}`}
                      >
                        <RichTextMarksEditor
                          content={readDoc.sections.footer.content}
                          onChange={setFooterContent}
                          singleLine
                          variant="artboardFooter"
                        />
                      </footer>
                    ) : null}
                  </article>
                </div>
              </TransformComponent>
            </div>
            <div className={styles.bottomCenterDock}>
              {isGridPreviewMode ? (
                <GridLayoutControls
                  regionCount={grid.regions.length}
                  selectedRegionId={grid.selectedRegionId}
                  drawMode={gridDrawMode}
                  drawStatusText={gridDrawStatusText}
                  canSplitHorizontally={grid.canSplitHorizontally}
                  canSplitVertically={grid.canSplitVertically}
                  canMergeLeft={grid.canMergeLeft}
                  canMergeRight={grid.canMergeRight}
                  onMoveUp={gridDockActions.onMoveUp}
                  onMoveLeft={gridDockActions.onMoveLeft}
                  onMoveRight={gridDockActions.onMoveRight}
                  onMoveDown={gridDockActions.onMoveDown}
                  onSplitHorizontal={gridDockActions.onSplitHorizontal}
                  onSplitVertical={gridDockActions.onSplitVertical}
                  onMergeLeft={gridDockActions.onMergeLeft}
                  onMergeRight={gridDockActions.onMergeRight}
                  onDelete={gridDockActions.onDelete}
                  onAddImage={gridDockActions.onAddImage}
                  onAddFloatingParagraph={() => {
                    addFloatingParagraph();
                  }}
                  onToggleDrawMode={() => {
                    setGridDrawStatusText(null);
                    setGridDrawMode((current) => !current);
                  }}
                />
              ) : null}
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
