"use client";

import styles from "@/components/editor/menus/general-options-menu.module.css";
import {
  selectPosterReadColorTheme,
  selectPosterReadBaseTypeSizePt,
  selectPosterReadFooterVisible,
  selectPosterReadHeaderSubtitleVisible,
  selectPosterReadOrientation,
  selectPosterReadSizePreset,
  selectPosterReadTypographyTheme
} from "@/lib/store/poster-read-selectors";
import { usePosterEditorStore } from "@/lib/store/poster-store";

export default function GeneralOptionsMenu() {
  const typographyTheme = usePosterEditorStore(selectPosterReadTypographyTheme);
  const baseTypeSizePt = usePosterEditorStore(selectPosterReadBaseTypeSizePt);
  const colorTheme = usePosterEditorStore(selectPosterReadColorTheme);
  const orientation = usePosterEditorStore(selectPosterReadOrientation);
  const sizePreset = usePosterEditorStore(selectPosterReadSizePreset);
  const headerSubtitleVisible = usePosterEditorStore(selectPosterReadHeaderSubtitleVisible);
  const footerVisible = usePosterEditorStore(selectPosterReadFooterVisible);
  const canUndo = usePosterEditorStore((state) => state.canUndo);
  const canRedo = usePosterEditorStore((state) => state.canRedo);
  const undo = usePosterEditorStore((state) => state.undo);
  const redo = usePosterEditorStore((state) => state.redo);
  const setTypographyTheme = usePosterEditorStore((state) => state.setTypographyTheme);
  const setBaseTypeSizePt = usePosterEditorStore((state) => state.setBaseTypeSizePt);
  const setColorTheme = usePosterEditorStore((state) => state.setColorTheme);
  const setOrientation = usePosterEditorStore((state) => state.setOrientation);
  const setSizePreset = usePosterEditorStore((state) => state.setSizePreset);
  const toggleHeaderSubtitleVisible = usePosterEditorStore((state) => state.toggleHeaderSubtitleVisible);
  const toggleFooterVisible = usePosterEditorStore((state) => state.toggleFooterVisible);

  if (!typographyTheme || !colorTheme || !orientation || !sizePreset) {
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
          className={`${styles.button} ${typographyTheme === "SERIF_HEADERS_SANS_BODY" ? styles.buttonActive : ""}`}
          onClick={() => setTypographyTheme("SERIF_HEADERS_SANS_BODY")}
        >
          Serif/Sans
        </button>
        <button
          type="button"
          className={`${styles.button} ${typographyTheme === "SANS_HEADERS_MONO_BODY" ? styles.buttonActive : ""}`}
          onClick={() => setTypographyTheme("SANS_HEADERS_MONO_BODY")}
        >
          Sans/Mono
        </button>
      </div>

      <div className={styles.row}>
        <span className={styles.label}>Base size</span>
        <select
          className={styles.button}
          value={String(baseTypeSizePt)}
          onChange={(event) => {
            setBaseTypeSizePt(Number(event.target.value));
          }}
        >
          {[8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32].map((size) => (
            <option key={size} value={String(size)}>
              {size}pt
            </option>
          ))}
        </select>
      </div>

      <div className={styles.row}>
        <span className={styles.label}>Color</span>
        <button
          type="button"
          className={`${styles.button} ${colorTheme === "BLUE" ? styles.buttonActive : ""}`}
          onClick={() => setColorTheme("BLUE")}
        >
          Blue
        </button>
        <button
          type="button"
          className={`${styles.button} ${colorTheme === "GREEN" ? styles.buttonActive : ""}`}
          onClick={() => setColorTheme("GREEN")}
        >
          Green
        </button>
      </div>

      <div className={styles.row}>
        <span className={styles.label}>Layout</span>
        <button
          type="button"
          className={`${styles.button} ${orientation === "portrait" ? styles.buttonActive : ""}`}
          onClick={() => setOrientation("portrait")}
        >
          Portrait
        </button>
        <button
          type="button"
          className={`${styles.button} ${orientation === "landscape" ? styles.buttonActive : ""}`}
          onClick={() => setOrientation("landscape")}
        >
          Landscape
        </button>
        <button
          type="button"
          className={`${styles.button} ${sizePreset === "A1" ? styles.buttonActive : ""}`}
          onClick={() => setSizePreset("A1")}
        >
          A1
        </button>
        <button
          type="button"
          className={`${styles.button} ${sizePreset === "SCREEN_X2" ? styles.buttonActive : ""}`}
          onClick={() => setSizePreset("SCREEN_X2")}
        >
          Screen x2
        </button>
      </div>

      <div className={styles.row}>
        <span className={styles.label}>Subtitle</span>
        <button type="button" className={styles.button} onClick={toggleHeaderSubtitleVisible}>
          {headerSubtitleVisible ? "Hide" : "Show"}
        </button>
      </div>

      <div className={styles.row}>
        <span className={styles.label}>Footer</span>
        <button type="button" className={styles.button} onClick={toggleFooterVisible}>
          {footerVisible ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}
