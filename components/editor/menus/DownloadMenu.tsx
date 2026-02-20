"use client";

import styles from "@/components/editor/menus/download-menu.module.css";

interface DownloadMenuProps {
  status: string;
  onSave: () => void;
  onExportPng: () => void;
  onExportPdf: () => void;
  saving: boolean;
  saveDisabled: boolean;
  exportDisabled: boolean;
}

export default function DownloadMenu({
  status,
  onSave,
  onExportPng,
  onExportPdf,
  saving,
  saveDisabled,
  exportDisabled
}: DownloadMenuProps) {
  return (
    <div className={styles.menu}>
      <span className={styles.meta}>{status}</span>
      <button type="button" className={styles.saveButton} onClick={onSave} disabled={saveDisabled || saving}>
        {saving ? "Saving..." : "Save"}
      </button>
      <button type="button" className={styles.downloadButton} onClick={onExportPng} disabled={exportDisabled || saving}>
        PNG
      </button>
      <button type="button" className={styles.downloadButton} onClick={onExportPdf} disabled={exportDisabled || saving}>
        PDF
      </button>
    </div>
  );
}
