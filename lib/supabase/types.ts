import type { PosterDocAny } from "@/lib/poster/types";
import type { PosterMemberRole } from "@/lib/poster/capabilities";

export interface PosterRow {
  id: string;
  user_id: string;
  title: string;
  doc: PosterDocAny;
  created_at: string;
  updated_at: string;
}

export interface PosterListItem {
  id: string;
  title: string;
  updated_at: string;
}

export interface PosterMemberRow {
  poster_id: string;
  user_id: string;
  role: PosterMemberRole;
}
