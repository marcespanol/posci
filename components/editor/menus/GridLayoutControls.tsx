"use client";

import styles from "@/components/editor/main-blocks-editor.module.css";

interface GridLayoutControlsProps {
  regionCount: number;
  selectedRegionId: string | null;
  drawMode: boolean;
  canEdit?: boolean;
  drawStatusText?: string | null;
  canSplitHorizontally: boolean;
  canSplitVertically: boolean;
  canMergeLeft: boolean;
  canMergeRight: boolean;
  onMoveUp: () => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onMoveDown: () => void;
  onSplitHorizontal: () => void;
  onSplitVertical: () => void;
  onMergeLeft: () => void;
  onMergeRight: () => void;
  onDelete: () => void;
  onAddImage: () => void;
  onAddFloatingParagraph: () => void;
  onToggleDrawMode: () => void;
}

export default function GridLayoutControls({
  regionCount,
  selectedRegionId,
  drawMode,
  canEdit = true,
  drawStatusText,
  canSplitHorizontally,
  canSplitVertically,
  canMergeLeft,
  canMergeRight,
  onMoveUp,
  onMoveLeft,
  onMoveRight,
  onMoveDown,
  onSplitHorizontal,
  onSplitVertical,
  onMergeLeft,
  onMergeRight,
  onDelete,
  onAddImage,
  onAddFloatingParagraph,
  onToggleDrawMode
}: GridLayoutControlsProps) {
  const hasSelection = Boolean(selectedRegionId);

  return (
    <div className={`${styles.controls} ${styles.noPan} ${styles.gridPreviewDock}`}>
      <p className={styles.counter}>Regions: {regionCount}</p>
      <button
        type="button"
        className={`${styles.controlButton} ${drawMode ? styles.controlButtonActive : ""}`}
        onClick={onToggleDrawMode}
        disabled={!canEdit}
      >
        {drawMode ? "Drawing" : "Draw region"}
      </button>
      {drawStatusText ? <p className={styles.gridDrawStatus}>{drawStatusText}</p> : null}
      <button type="button" className={styles.controlButton} disabled={!canEdit || !hasSelection} onClick={onMoveUp}>
        Up
      </button>
      <button type="button" className={styles.controlButton} disabled={!canEdit || !hasSelection} onClick={onMoveLeft}>
        Left
      </button>
      <button type="button" className={styles.controlButton} disabled={!canEdit || !hasSelection} onClick={onMoveRight}>
        Right
      </button>
      <button type="button" className={styles.controlButton} disabled={!canEdit || !hasSelection} onClick={onMoveDown}>
        Down
      </button>
      <button type="button" className={styles.controlButton} disabled={!canEdit || !canSplitHorizontally} onClick={onSplitHorizontal}>
        Split H
      </button>
      <button type="button" className={styles.controlButton} disabled={!canEdit || !canSplitVertically} onClick={onSplitVertical}>
        Split V
      </button>
      <button type="button" className={styles.controlButton} disabled={!canEdit || !canMergeLeft} onClick={onMergeLeft}>
        Merge Left
      </button>
      <button type="button" className={styles.controlButton} disabled={!canEdit || !canMergeRight} onClick={onMergeRight}>
        Merge Right
      </button>
      <button
        type="button"
        className={styles.controlButton}
        disabled={!canEdit || !hasSelection || regionCount <= 1}
        onClick={onDelete}
      >
        Delete
      </button>
      <button type="button" className={styles.controlButton} onClick={onAddImage} disabled={!canEdit}>
        Add image
      </button>
      <button type="button" className={styles.controlButton} onClick={onAddFloatingParagraph} disabled={!canEdit}>
        Add floating
      </button>
    </div>
  );
}
