"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  acquirePosterEditLockAction,
  heartbeatPosterEditLockAction,
  releasePosterEditLockAction,
  takeoverPosterEditLockAction
} from "@/app/editor/[id]/lock-actions";

type PosterEditMode = "loading" | "editable" | "read_only_role" | "read_only_locked" | "lock_lost" | "error";

interface UsePosterEditLockParams {
  posterId: string;
  userId: string;
  canEditRole: boolean;
  canTakeOverLock: boolean;
}

interface UsePosterEditLockResult {
  mode: PosterEditMode;
  lockOwnerUserId: string | null;
  lockReason: string | null;
  isHoldingLock: boolean;
  isLockBusy: boolean;
  lastHeartbeatAt: string | null;
  acquire: () => Promise<void>;
  takeOver: () => Promise<void>;
  release: () => Promise<void>;
}

const HEARTBEAT_MS = 15_000;

export function usePosterEditLock({
  posterId,
  userId,
  canEditRole,
  canTakeOverLock
}: UsePosterEditLockParams): UsePosterEditLockResult {
  const [mode, setMode] = useState<PosterEditMode>(canEditRole ? "loading" : "read_only_role");
  const [lockOwnerUserId, setLockOwnerUserId] = useState<string | null>(null);
  const [lockReason, setLockReason] = useState<string | null>(null);
  const [lastHeartbeatAt, setLastHeartbeatAt] = useState<string | null>(null);
  const [isLockBusy, setIsLockBusy] = useState(false);

  const unmountedRef = useRef(false);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const applyAcquireResult = useCallback(
    (result: { ok: boolean; locked_by: string | null; heartbeat_at: string | null; reason: string }) => {
      setLockOwnerUserId(result.locked_by);
      setLastHeartbeatAt(result.heartbeat_at);
      setLockReason(result.reason);

      if (result.ok) {
        setMode("editable");
        return;
      }

      if (result.reason === "locked_by_other" && result.locked_by && result.locked_by !== userId) {
        setMode("read_only_locked");
        return;
      }

      if (result.reason === "forbidden") {
        setMode("read_only_role");
        return;
      }

      setMode("error");
    },
    [userId]
  );

  const acquire = useCallback(async () => {
    if (!canEditRole) {
      setMode("read_only_role");
      return;
    }

    setIsLockBusy(true);
    try {
      const result = await acquirePosterEditLockAction(posterId);
      if (unmountedRef.current) {
        return;
      }

      applyAcquireResult(result);
    } catch (error) {
      if (unmountedRef.current) {
        return;
      }

      setLockReason(error instanceof Error ? error.message : "Failed to acquire lock");
      setMode("error");
    } finally {
      if (!unmountedRef.current) {
        setIsLockBusy(false);
      }
    }
  }, [applyAcquireResult, canEditRole, posterId]);

  const release = useCallback(async () => {
    if (!canEditRole) {
      return;
    }

    try {
      await releasePosterEditLockAction(posterId);
    } catch {
      // best effort
    }
  }, [canEditRole, posterId]);

  const takeOver = useCallback(async () => {
    if (!canEditRole || !canTakeOverLock) {
      return;
    }

    setIsLockBusy(true);
    try {
      const result = await takeoverPosterEditLockAction(posterId);
      if (unmountedRef.current) {
        return;
      }

      applyAcquireResult(result);
    } catch (error) {
      if (unmountedRef.current) {
        return;
      }

      setLockReason(error instanceof Error ? error.message : "Failed to take over lock");
      setMode("error");
    } finally {
      if (!unmountedRef.current) {
        setIsLockBusy(false);
      }
    }
  }, [applyAcquireResult, canEditRole, canTakeOverLock, posterId]);

  useEffect(() => {
    unmountedRef.current = false;
    if (!canEditRole) {
      setMode("read_only_role");
      setLockOwnerUserId(null);
      setLastHeartbeatAt(null);
      setLockReason(null);
      return () => {
        unmountedRef.current = true;
      };
    }

    void acquire();

    return () => {
      unmountedRef.current = true;
    };
  }, [acquire, canEditRole]);

  useEffect(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }

    if (mode !== "editable" || !canEditRole) {
      return;
    }

    heartbeatTimerRef.current = setInterval(() => {
      void (async () => {
        try {
          const result = await heartbeatPosterEditLockAction(posterId);
          if (unmountedRef.current) {
            return;
          }

          setLockOwnerUserId(result.locked_by);
          setLastHeartbeatAt(result.heartbeat_at);
          setLockReason(result.reason);

          if (!result.ok) {
            setMode("lock_lost");
          }
        } catch (error) {
          if (unmountedRef.current) {
            return;
          }

          setLockReason(error instanceof Error ? error.message : "Heartbeat failed");
          setMode("lock_lost");
        }
      })();
    }, HEARTBEAT_MS);

    return () => {
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
    };
  }, [canEditRole, mode, posterId]);

  useEffect(() => {
    const onPageHide = () => {
      void release();
    };

    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      void release();
    };
  }, [release]);

  return {
    mode,
    lockOwnerUserId,
    lockReason,
    isHoldingLock: mode === "editable",
    isLockBusy,
    lastHeartbeatAt,
    acquire,
    takeOver,
    release
  };
}
