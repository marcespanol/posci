"use client";

import styles from "@/components/editor/menus/content-controls-menu.module.css";

interface ContentControlsMenuProps {
  columnCount: number;
  canRemoveColumn: boolean;
  canRemoveSegment: boolean;
  onAddColumn: () => void;
  onRemoveSelectedColumn: () => void;
  onAddSegment: () => void;
  onRemoveSelectedSegment: () => void;
  onAddFloatingParagraph: () => void;
  onAddImageBlock: () => void;
  imageBlockDisabled: boolean;
}

export default function ContentControlsMenu({
  columnCount,
  canRemoveColumn,
  canRemoveSegment,
  onAddColumn,
  onRemoveSelectedColumn,
  onAddSegment,
  onRemoveSelectedSegment,
  onAddFloatingParagraph,
  onAddImageBlock,
  imageBlockDisabled
}: ContentControlsMenuProps) {
  return (
    <div className={styles.menu}>
      <button type="button" className={styles.button} onClick={onAddColumn} disabled={columnCount >= 5}>
        Add column
      </button>
      <button type="button" className={styles.button} onClick={onRemoveSelectedColumn} disabled={!canRemoveColumn}>
        Remove column
      </button>
      <button type="button" className={styles.button} onClick={onAddSegment}>
        Add segment
      </button>
      <button type="button" className={styles.button} onClick={onRemoveSelectedSegment} disabled={!canRemoveSegment}>
        Remove segment
      </button>
      <button type="button" className={styles.button} onClick={onAddFloatingParagraph}>
        Add floating
      </button>
      <button type="button" className={styles.button} onClick={onAddImageBlock} disabled={imageBlockDisabled}>
        Add image block
      </button>
      <p className={styles.meta}>Columns {columnCount}/5</p>
    </div>
  );
}
