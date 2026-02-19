"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { savePosterAction } from "@/app/editor/[id]/actions";
import styles from "@/app/editor/[id]/editor.module.css";
import HeaderFooterEditors from "@/components/editor/HeaderFooterEditors";
import MainBlocksEditor from "@/components/editor/MainBlocksEditor";
import DownloadMenu from "@/components/editor/menus/DownloadMenu";
import GeneralOptionsMenu from "@/components/editor/menus/GeneralOptionsMenu";
import type { PosterDoc } from "@/lib/poster/types";
import { usePosterEditorStore } from "@/lib/store/poster-store";

type LeftPanelMode = "text" | "theme" | "layout";

interface EditorClientProps {
  posterId: string;
  updatedAt: string;
  initialDoc: PosterDoc;
}

const AUTOSAVE_IDLE_MS = 3000;
const AUTOSAVE_MIN_INTERVAL_MS = 10000;

const toPersistableDoc = (doc: PosterDoc): PosterDoc => {
  return {
    ...doc,
    history: {
      canUndo: false,
      canRedo: false
    }
  };
};

const persistHash = (doc: PosterDoc): string => JSON.stringify(toPersistableDoc(doc));

const formatDate = (value: string): string => {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
};

export default function EditorClient({ posterId, updatedAt, initialDoc }: EditorClientProps) {
  const doc = usePosterEditorStore((state) => state.doc);
  const isDirty = usePosterEditorStore((state) => state.isDirty);
  const initializePoster = usePosterEditorStore((state) => state.initializePoster);
  const resetPoster = usePosterEditorStore((state) => state.resetPoster);
  const setMetaTitle = usePosterEditorStore((state) => state.setMetaTitle);
  const markSaved = usePosterEditorStore((state) => state.markSaved);

  const [leftPanelMode, setLeftPanelMode] = useState<LeftPanelMode>("text");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string>(updatedAt);
  const [notice, setNotice] = useState<string | null>(null);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDocRef = useRef<PosterDoc | null>(null);
  const latestHashRef = useRef<string>(persistHash(initialDoc));
  const lastSavedHashRef = useRef<string>(persistHash(initialDoc));
  const lastSaveStartedAtRef = useRef<number>(0);
  const inFlightSaveRef = useRef(false);
  const queuedSaveRef = useRef(false);

  useEffect(() => {
    initializePoster({ posterId, doc: initialDoc });
    const initialHash = persistHash(initialDoc);
    latestHashRef.current = initialHash;
    lastSavedHashRef.current = initialHash;
    latestDocRef.current = initialDoc;

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      resetPoster();
    };
  }, [initialDoc, initializePoster, posterId, resetPoster]);

  useEffect(() => {
    if (!doc) {
      return;
    }

    latestDocRef.current = doc;
    latestHashRef.current = persistHash(doc);
  }, [doc]);

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

  const persistLatest = useCallback(async () => {
    const activeDoc = latestDocRef.current;
    if (!activeDoc) {
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
      await savePosterAction({
        posterId,
        title: activeDoc.meta.title,
        doc: toPersistableDoc(activeDoc)
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
    if (!doc) {
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
  }, [doc, persistLatest]);

  const statusLabel = useMemo(() => {
    if (saveError) {
      return "Save failed";
    }

    if (isSaving) {
      return "Saving...";
    }

    return isDirty ? "Unsaved changes" : "Saved";
  }, [isDirty, isSaving, saveError]);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setNotice(null);
    }, 4500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [notice]);

  if (!doc) {
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
          value={doc.meta.title}
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
          onExport={() => {
            const exportAfterSave = async () => {
              await persistLatest();
              window.open(`/editor/${posterId}/print?autoprint=1`, "_blank", "noopener,noreferrer");
            };

            void exportAfterSave();
          }}
          saving={isSaving}
          saveDisabled={!isDirty && !saveError}
          exportDisabled={Boolean(saveError)}
        />
      </div>

      <div className={styles.topRightMeta}>
        <span className={styles.statusMeta}>Last save {formatDate(lastSavedAt)}</span>
        {saveError ? <span className={styles.errorMeta}>{saveError}</span> : null}
        {notice ? <span className={styles.errorMeta}>{notice}</span> : null}
      </div>

      <aside className={styles.leftRail}>
        <button
          type="button"
          className={`${styles.railButton} ${leftPanelMode === "text" ? styles.railButtonActive : ""}`}
          onClick={() => setLeftPanelMode("text")}
          aria-label="Text tools"
          title="Text tools"
        >
          T
        </button>
        <button
          type="button"
          className={`${styles.railButton} ${leftPanelMode === "theme" ? styles.railButtonActive : ""}`}
          onClick={() => setLeftPanelMode("theme")}
          aria-label="Theme tools"
          title="Theme tools"
        >
          C
        </button>
        <button
          type="button"
          className={`${styles.railButton} ${leftPanelMode === "layout" ? styles.railButtonActive : ""}`}
          onClick={() => setLeftPanelMode("layout")}
          aria-label="Layout tools"
          title="Layout tools"
        >
          L
        </button>
      </aside>

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

      <section className={styles.canvasViewport}>
        <MainBlocksEditor posterId={posterId} fullscreen onNotice={setNotice} />
      </section>
    </main>
  );
}
