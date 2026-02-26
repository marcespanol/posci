import type { PosterMemberRole } from "@/lib/poster/capabilities";

export interface PosterCollabAccess {
  userId: string;
  role: PosterMemberRole;
}

export interface LockRpcResult {
  ok: boolean;
  poster_id: string;
  locked_by: string | null;
  locked_at: string | null;
  heartbeat_at: string | null;
  reason: string;
}

export interface PosterEditLockView {
  posterId: string;
  lockedBy: string;
  lockedAt: string;
  heartbeatAt: string;
  isStale: boolean;
}
