import type { PosterDoc } from "@/lib/poster/types";

export interface PosterRow {
  id: string;
  user_id: string;
  title: string;
  doc: PosterDoc;
  created_at: string;
  updated_at: string;
}

export interface PosterListItem {
  id: string;
  title: string;
  updated_at: string;
}
