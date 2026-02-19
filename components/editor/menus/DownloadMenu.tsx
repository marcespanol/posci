"use client";

import styles from "@/components/editor/menus/download-menu.module.css";

interface DownloadMenuProps {
  status: string;
  onSave: () => void;
  onExport: () => void;
  saving: boolean;
  saveDisabled: boolean;
  exportDisabled: boolean;
}

export default function DownloadMenu({
  status,
  onSave,
  onExport,
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
      <button type="button" className={styles.downloadButton} onClick={onExport} disabled={exportDisabled || saving}>
        Export PDF
      </button>
    </div>
  );
}
