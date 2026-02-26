"use client";

import styles from "@/app/editor/[id]/editor.module.css";
import type { PosterMemberRole } from "@/lib/poster/capabilities";

type EditorLockMode = "loading" | "editable" | "read_only_role" | "read_only_locked" | "lock_lost" | "error";

interface EditorLockBannerProps {
  mode: EditorLockMode;
  role: PosterMemberRole;
  lockOwnerUserId: string | null;
  lockReason: string | null;
  canTakeOver: boolean;
  isBusy: boolean;
  onTakeOver: () => void;
  onRetryAcquire: () => void;
}

const shortUserId = (value: string | null): string | null => {
  if (!value) {
    return null;
  }

  if (value.length <= 12) {
    return value;
  }

  return `${value.slice(0, 6)}...${value.slice(-4)}`;
};

export default function EditorLockBanner({
  mode,
  role,
  lockOwnerUserId,
  lockReason,
  canTakeOver,
  isBusy,
  onTakeOver,
  onRetryAcquire
}: EditorLockBannerProps) {
  if (mode === "editable") {
    return null;
  }

  let toneClass = styles.lockBannerInfo;
  let title = "Checking edit lock…";
  let detail: string | null = null;

  if (mode === "read_only_role") {
    toneClass = styles.lockBannerMuted;
    title = `Read-only (${role})`;
    detail = "You can view and export this poster, but you do not have edit permission.";
  } else if (mode === "read_only_locked") {
    toneClass = styles.lockBannerWarning;
    title = "Read-only (locked)";
    detail = lockOwnerUserId
      ? `Another user is editing this poster (${shortUserId(lockOwnerUserId)}).`
      : "Another user is editing this poster.";
  } else if (mode === "lock_lost") {
    toneClass = styles.lockBannerWarning;
    title = "Lock lost";
    detail = "Editing has been paused. Reacquire the lock to continue saving changes.";
  } else if (mode === "error") {
    toneClass = styles.lockBannerError;
    title = "Lock error";
    detail = lockReason ?? "The editor could not determine the lock state.";
  }

  return (
    <div className={`${styles.lockBanner} ${toneClass}`}>
      <div className={styles.lockBannerText}>
        <strong>{title}</strong>
        {detail ? <span>{detail}</span> : null}
      </div>
      <div className={styles.lockBannerActions}>
        {(mode === "lock_lost" || mode === "error" || mode === "loading") ? (
          <button type="button" className={styles.lockBannerButton} onClick={onRetryAcquire} disabled={isBusy}>
            {isBusy ? "..." : "Retry"}
          </button>
        ) : null}
        {mode === "read_only_locked" && canTakeOver ? (
          <button type="button" className={styles.lockBannerButtonPrimary} onClick={onTakeOver} disabled={isBusy}>
            {isBusy ? "Taking over..." : "Take over"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
