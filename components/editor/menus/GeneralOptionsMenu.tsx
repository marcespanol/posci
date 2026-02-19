"use client";

import styles from "@/components/editor/menus/general-options-menu.module.css";
import { usePosterEditorStore } from "@/lib/store/poster-store";

export default function GeneralOptionsMenu() {
  const doc = usePosterEditorStore((state) => state.doc);
  const canUndo = usePosterEditorStore((state) => state.canUndo);
  const canRedo = usePosterEditorStore((state) => state.canRedo);
  const undo = usePosterEditorStore((state) => state.undo);
  const redo = usePosterEditorStore((state) => state.redo);
  const setTypographyTheme = usePosterEditorStore((state) => state.setTypographyTheme);
  const setColorTheme = usePosterEditorStore((state) => state.setColorTheme);
  const setOrientation = usePosterEditorStore((state) => state.setOrientation);
  const setSizePreset = usePosterEditorStore((state) => state.setSizePreset);
  const toggleFooterVisible = usePosterEditorStore((state) => state.toggleFooterVisible);

  if (!doc) {
    return null;
  }

  return (
    <div className={styles.menu}>
      <div className={styles.row}>
        <span className={styles.label}>History</span>
        <button type="button" className={styles.button} onClick={undo} disabled={!canUndo}>
          Undo
        </button>
        <button type="button" className={styles.button} onClick={redo} disabled={!canRedo}>
          Redo
        </button>
      </div>

      <div className={styles.row}>
        <span className={styles.label}>Type</span>
        <button
          type="button"
          className={`${styles.button} ${doc.meta.typographyTheme === "SERIF_HEADERS_SANS_BODY" ? styles.buttonActive : ""}`}
          onClick={() => setTypographyTheme("SERIF_HEADERS_SANS_BODY")}
        >
          Serif/Sans
        </button>
        <button
          type="button"
          className={`${styles.button} ${doc.meta.typographyTheme === "SANS_HEADERS_MONO_BODY" ? styles.buttonActive : ""}`}
          onClick={() => setTypographyTheme("SANS_HEADERS_MONO_BODY")}
        >
          Sans/Mono
        </button>
      </div>

      <div className={styles.row}>
        <span className={styles.label}>Color</span>
        <button
          type="button"
          className={`${styles.button} ${doc.meta.colorTheme === "BLUE" ? styles.buttonActive : ""}`}
          onClick={() => setColorTheme("BLUE")}
        >
          Blue
        </button>
        <button
          type="button"
          className={`${styles.button} ${doc.meta.colorTheme === "GREEN" ? styles.buttonActive : ""}`}
          onClick={() => setColorTheme("GREEN")}
        >
          Green
        </button>
      </div>

      <div className={styles.row}>
        <span className={styles.label}>Layout</span>
        <button
          type="button"
          className={`${styles.button} ${doc.meta.orientation === "portrait" ? styles.buttonActive : ""}`}
          onClick={() => setOrientation("portrait")}
        >
          Portrait
        </button>
        <button
          type="button"
          className={`${styles.button} ${doc.meta.orientation === "landscape" ? styles.buttonActive : ""}`}
          onClick={() => setOrientation("landscape")}
        >
          Landscape
        </button>
        <button
          type="button"
          className={`${styles.button} ${doc.meta.sizePreset === "A1" ? styles.buttonActive : ""}`}
          onClick={() => setSizePreset("A1")}
        >
          A1
        </button>
        <button
          type="button"
          className={`${styles.button} ${doc.meta.sizePreset === "SCREEN_X2" ? styles.buttonActive : ""}`}
          onClick={() => setSizePreset("SCREEN_X2")}
        >
          Screen x2
        </button>
      </div>

      <div className={styles.row}>
        <span className={styles.label}>Footer</span>
        <button type="button" className={styles.button} onClick={toggleFooterVisible}>
          {doc.meta.footerVisible ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}
