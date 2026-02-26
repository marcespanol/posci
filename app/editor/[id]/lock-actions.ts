"use server";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { LockRpcResult, PosterEditLockView } from "@/lib/poster/locking-types";

const LOCK_TTL_MS = 60_000;

const coerceLockRpcRow = (row: unknown): LockRpcResult => {
  if (!row || typeof row !== "object") {
    throw new Error("Invalid lock RPC response");
  }

  const value = row as Record<string, unknown>;
  return {
    ok: value.ok === true,
    poster_id: typeof value.poster_id === "string" ? value.poster_id : "",
    locked_by: typeof value.locked_by === "string" ? value.locked_by : null,
    locked_at: typeof value.locked_at === "string" ? value.locked_at : null,
    heartbeat_at: typeof value.heartbeat_at === "string" ? value.heartbeat_at : null,
    reason: typeof value.reason === "string" ? value.reason : "unknown"
  };
};

const requireUser = async () => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return supabase;
};

export const acquirePosterEditLockAction = async (posterId: string): Promise<LockRpcResult> => {
  const supabase = await requireUser();
  const { data, error } = await supabase.rpc("acquire_poster_edit_lock", { p_poster_id: posterId });

  if (error) {
    throw new Error(`Failed to acquire poster lock: ${error.message}`);
  }

  const row = Array.isArray(data) ? data[0] : data;
  return coerceLockRpcRow(row);
};

export const heartbeatPosterEditLockAction = async (posterId: string): Promise<LockRpcResult> => {
  const supabase = await requireUser();
  const { data, error } = await supabase.rpc("heartbeat_poster_edit_lock", { p_poster_id: posterId });

  if (error) {
    throw new Error(`Failed to heartbeat poster lock: ${error.message}`);
  }

  const row = Array.isArray(data) ? data[0] : data;
  return coerceLockRpcRow(row);
};

export const releasePosterEditLockAction = async (
  posterId: string
): Promise<{ ok: boolean; poster_id: string; reason: string }> => {
  const supabase = await requireUser();
  const { data, error } = await supabase.rpc("release_poster_edit_lock", { p_poster_id: posterId });

  if (error) {
    throw new Error(`Failed to release poster lock: ${error.message}`);
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") {
    return { ok: false, poster_id: posterId, reason: "invalid_response" };
  }

  const value = row as Record<string, unknown>;
  return {
    ok: value.ok === true,
    poster_id: typeof value.poster_id === "string" ? value.poster_id : posterId,
    reason: typeof value.reason === "string" ? value.reason : "unknown"
  };
};

export const takeoverPosterEditLockAction = async (posterId: string): Promise<LockRpcResult> => {
  const supabase = await requireUser();
  const { data, error } = await supabase.rpc("takeover_poster_edit_lock", { p_poster_id: posterId });

  if (error) {
    throw new Error(`Failed to take over poster lock: ${error.message}`);
  }

  const row = Array.isArray(data) ? data[0] : data;
  return coerceLockRpcRow(row);
};

export const getPosterEditLockAction = async (posterId: string): Promise<PosterEditLockView | null> => {
  const supabase = await requireUser();
  const { data, error } = await supabase
    .from("poster_edit_locks")
    .select("poster_id, locked_by, locked_at, heartbeat_at")
    .eq("poster_id", posterId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load poster lock: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const heartbeatAt = new Date(data.heartbeat_at).getTime();
  return {
    posterId: data.poster_id,
    lockedBy: data.locked_by,
    lockedAt: data.locked_at,
    heartbeatAt: data.heartbeat_at,
    isStale: Number.isFinite(heartbeatAt) ? Date.now() - heartbeatAt > LOCK_TTL_MS : true
  };
};
