"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { savePosterAction } from "@/app/editor/[id]/actions";
import styles from "@/app/editor/[id]/editor.module.css";
import HeaderFooterEditors from "@/components/editor/HeaderFooterEditors";
import MainBlocksEditor from "@/components/editor/MainBlocksEditor";
import DownloadMenu from "@/components/editor/menus/DownloadMenu";
import GeneralOptionsMenu from "@/components/editor/menus/GeneralOptionsMenu";
import { usePosterEditorDocumentFacade } from "@/components/editor/usePosterEditorDocumentFacade";
import { downloadPdfFromPngDataUrl } from "@/lib/poster/export-pdf";
import { downloadPosterElementAsPng, renderPosterElementToPngDataUrl } from "@/lib/poster/export-png";
import { toPersistablePosterSavePayload } from "@/lib/poster/persistence-adapter";
import type { PosterDocAny, PosterDocV2 } from "@/lib/poster/types";
import { usePosterEditorStore } from "@/lib/store/poster-store";

type LeftPanelMode = "text" | "theme" | "layout" | null;

interface EditorClientProps {
  posterId: string;
  updatedAt: string;
  initialDoc: PosterDocAny;
}

const AUTOSAVE_IDLE_MS = 3000;
const AUTOSAVE_MIN_INTERVAL_MS = 10000;

const formatDate = (value: string): string => {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
};

export default function EditorClient({ posterId, updatedAt, initialDoc }: EditorClientProps) {
  const documentFacade = usePosterEditorDocumentFacade();
  const { readDoc, gridModeDocV2, readTitle, persistableHash } = documentFacade;
  const isDirty = usePosterEditorStore((state) => state.isDirty);
  const initializePoster = usePosterEditorStore((state) => state.initializePoster);
  const resetPoster = usePosterEditorStore((state) => state.resetPoster);
  const setMetaTitle = usePosterEditorStore((state) => state.setMetaTitle);
  const markSaved = usePosterEditorStore((state) => state.markSaved);
  const undo = usePosterEditorStore((state) => state.undo);
  const redo = usePosterEditorStore((state) => state.redo);
  const canUndo = usePosterEditorStore((state) => state.canUndo);
  const canRedo = usePosterEditorStore((state) => state.canRedo);

  const [leftPanelMode, setLeftPanelMode] = useState<LeftPanelMode>(null);

  const toggleLeftPanelMode = (mode: Exclude<LeftPanelMode, null>) => {
    setLeftPanelMode((current) => (current === mode ? null : mode));
  };
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string>(updatedAt);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestGridModeDocV2Ref = useRef<PosterDocV2 | null>(null);
  const latestHashRef = useRef<string>("");
  const lastSavedHashRef = useRef<string>("");
  const lastSaveStartedAtRef = useRef<number>(0);
  const inFlightSaveRef = useRef(false);
  const queuedSaveRef = useRef(false);
  const initializedPosterIdRef = useRef<string | null>(null);

  useEffect(() => {
    initializePoster({ posterId, doc: initialDoc });
    latestHashRef.current = "";
    lastSavedHashRef.current = "";
    latestGridModeDocV2Ref.current = null;
    initializedPosterIdRef.current = posterId;

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      resetPoster();
      latestGridModeDocV2Ref.current = null;
      initializedPosterIdRef.current = null;
    };
    // initialize once per mounted editor session
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!gridModeDocV2) {
      return;
    }

    latestGridModeDocV2Ref.current = gridModeDocV2;
    latestHashRef.current = persistableHash;
    if (!lastSavedHashRef.current) {
      lastSavedHashRef.current = latestHashRef.current;
    }
  }, [gridModeDocV2, persistableHash]);

  useEffect(() => {
    if (!isDirty) {
      return;
    }

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [isDirty]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const usesCommand = event.metaKey || event.ctrlKey;
      if (!usesCommand || event.altKey) {
        return;
      }

      const key = event.key.toLowerCase();
      const isUndo = key === "z" && !event.shiftKey;
      const isRedo = (key === "z" && event.shiftKey) || key === "y";

      if (isUndo) {
        if (!canUndo) {
          return;
        }

        event.preventDefault();
        undo();
        return;
      }

      if (isRedo) {
        if (!canRedo) {
          return;
        }

        event.preventDefault();
        redo();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [canRedo, canUndo, redo, undo]);

  const persistLatest = useCallback(async () => {
    const activeGridModeDocV2 = latestGridModeDocV2Ref.current;
    if (!activeGridModeDocV2) {
      return;
    }

    const saveHash = latestHashRef.current;
    if (saveHash === lastSavedHashRef.current) {
      return;
    }

    if (inFlightSaveRef.current) {
      queuedSaveRef.current = true;
      return;
    }

    lastSaveStartedAtRef.current = Date.now();
    inFlightSaveRef.current = true;
    setIsSaving(true);
    setSaveError(null);

    try {
      const savePayload = toPersistablePosterSavePayload(null, activeGridModeDocV2);
      await savePosterAction({
        posterId,
        title: savePayload.title,
        doc: savePayload.doc
      });

      lastSavedHashRef.current = saveHash;
      setLastSavedAt(new Date().toISOString());

      if (latestHashRef.current === saveHash) {
        markSaved();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save";
      setSaveError(message);
    } finally {
      inFlightSaveRef.current = false;
      setIsSaving(false);

      if (queuedSaveRef.current) {
        queuedSaveRef.current = false;
        void persistLatest();
      }
    }
  }, [markSaved, posterId]);

  useEffect(() => {
    if (!readDoc) {
      return;
    }

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    if (latestHashRef.current === lastSavedHashRef.current) {
      return;
    }

    const elapsedSinceLastSaveStart = Date.now() - lastSaveStartedAtRef.current;
    const throttleWait = Math.max(0, AUTOSAVE_MIN_INTERVAL_MS - elapsedSinceLastSaveStart);
    const nextDelay = Math.max(AUTOSAVE_IDLE_MS, throttleWait);

    saveTimerRef.current = setTimeout(() => {
      void persistLatest();
    }, nextDelay);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [persistLatest, readDoc]);

  const statusLabel = useMemo(() => {
    if (saveError) {
      return "Save failed";
    }

    if (isSaving) {
      return "Saving...";
    }

    return isDirty ? "Unsaved changes" : "Saved";
  }, [isDirty, isSaving, saveError]);

  if (!readDoc) {
    return (
      <main className={styles.page}>
        <p className={styles.loading}>Loading editor state...</p>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.topLeftBar}>
        <Link className={styles.logo} href="/dashboard">
          posci
        </Link>
        <div className={styles.divider} />
        <input
          className={styles.posterTitleInput}
          value={readTitle}
          onChange={(event) => setMetaTitle(event.target.value)}
          aria-label="Poster title"
        />
      </div>
      <div className={styles.generalMenuDock}>
        <GeneralOptionsMenu />
      </div>

      <div className={styles.topRightBar}>
        <DownloadMenu
          status={statusLabel}
          onSave={() => {
            if (saveTimerRef.current) {
              clearTimeout(saveTimerRef.current);
            }

            void persistLatest();
          }}
          onExportPng={() => {
            const exportPngAfterSave = async () => {
              try {
                await persistLatest();
                const artboard = document.querySelector<HTMLElement>("[data-poster-artboard='true']");
                if (!artboard) {
                  setSaveError("Could not find poster artboard to export.");
                  return;
                }

                const slug = readTitle.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "poster";
                await downloadPosterElementAsPng(artboard, `${slug}.png`);
              } catch (error) {
                const message = error instanceof Error ? error.message : "Failed to export poster";
                setSaveError(message);
              }
            };

            void exportPngAfterSave();
          }}
          onExportPdf={() => {
            const exportPdfAfterSave = async () => {
              try {
                await persistLatest();
                const artboard = document.querySelector<HTMLElement>("[data-poster-artboard='true']");
                if (!artboard) {
                  setSaveError("Could not find poster artboard to export.");
                  return;
                }

                const dataUrl = await renderPosterElementToPngDataUrl(artboard);
                const slug = readTitle.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "poster";
                await downloadPdfFromPngDataUrl(dataUrl, `${slug}.pdf`);
              } catch (error) {
                const message = error instanceof Error ? error.message : "Failed to export poster";
                setSaveError(message);
              }
            };

            void exportPdfAfterSave();
          }}
          saving={isSaving}
          saveDisabled={!isDirty && !saveError}
          exportDisabled={Boolean(saveError)}
        />
      </div>

      <div className={styles.topRightMeta}>
        <span className={styles.statusMeta}>Last save {formatDate(lastSavedAt)}</span>
        {saveError ? <span className={styles.errorMeta}>{saveError}</span> : null}
      </div>

      <aside className={styles.leftRail}>
        <button
          type="button"
          className={`${styles.railButton} ${leftPanelMode === "text" ? styles.railButtonActive : ""}`}
          onClick={() => toggleLeftPanelMode("text")}
          aria-pressed={leftPanelMode === "text"}
          aria-label="Text tools"
          title="Text tools"
        >
          T
        </button>
        <button
          type="button"
          className={`${styles.railButton} ${leftPanelMode === "theme" ? styles.railButtonActive : ""}`}
          onClick={() => toggleLeftPanelMode("theme")}
          aria-pressed={leftPanelMode === "theme"}
          aria-label="Theme tools"
          title="Theme tools"
        >
          C
        </button>
        <button
          type="button"
          className={`${styles.railButton} ${leftPanelMode === "layout" ? styles.railButtonActive : ""}`}
          onClick={() => toggleLeftPanelMode("layout")}
          aria-pressed={leftPanelMode === "layout"}
          aria-label="Layout tools"
          title="Layout tools"
        >
          L
        </button>
      </aside>

      {leftPanelMode ? (
        <section className={styles.leftPanel}>
          {leftPanelMode === "text" ? (
            <HeaderFooterEditors />
          ) : null}

          {leftPanelMode === "theme" ? (
            <div className={styles.panelGroup}>
              <h3 className={styles.panelTitle}>Theme</h3>
              <p className={styles.panelText}>Typography and color presets will be added in the next UI ticket.</p>
            </div>
          ) : null}

          {leftPanelMode === "layout" ? (
            <div className={styles.panelGroup}>
              <h3 className={styles.panelTitle}>Layout</h3>
              <p className={styles.panelText}>Orientation and size controls are scheduled for the upcoming controls pass.</p>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className={styles.canvasViewport}>
        <MainBlocksEditor fullscreen />
      </section>
    </main>
  );
}
