"use client";

import styles from "@/components/editor/menus/content-controls-menu.module.css";

interface ContentControlsMenuProps {
  columnCount: number;
  canRemoveColumn: boolean;
  rowCount: number;
  canAddRow: boolean;
  canRemoveRow: boolean;
  onAddColumn: () => void;
  onRemoveSelectedColumn: () => void;
  onAddRow: () => void;
  onRemoveRow: () => void;
  onAddImage: () => void;
  onAddFloatingParagraph: () => void;
}

export default function ContentControlsMenu({
  columnCount,
  canRemoveColumn,
  rowCount,
  canAddRow,
  canRemoveRow,
  onAddColumn,
  onRemoveSelectedColumn,
  onAddRow,
  onRemoveRow,
  onAddImage,
  onAddFloatingParagraph
}: ContentControlsMenuProps) {
  return (
    <div className={styles.menu}>
      <button type="button" className={styles.button} onClick={onAddColumn} disabled={columnCount >= 5}>
        Add column
      </button>
      <button type="button" className={styles.button} onClick={onRemoveSelectedColumn} disabled={!canRemoveColumn}>
        Remove column
      </button>
      <button type="button" className={styles.button} onClick={onAddFloatingParagraph}>
        Add floating
      </button>
      <button type="button" className={styles.button} onClick={onAddImage}>
        Add image
      </button>
      <p className={styles.meta}>Columns {columnCount}/5</p>
      <button type="button" className={styles.button} onClick={onAddRow} disabled={!canAddRow}>
        Add row
      </button>
      <button type="button" className={styles.button} onClick={onRemoveRow} disabled={!canRemoveRow}>
        Remove row
      </button>
      <p className={styles.meta}>Rows {rowCount}/5</p>
    </div>
  );
}
