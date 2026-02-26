"use server";

import { redirect } from "next/navigation";

import type { PosterCommentAnchorTarget, PosterCommentRecord, PosterCommentStatus } from "@/lib/poster/comments";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const requireUser = async () => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return { supabase, user };
};

const dbAnchorFromUi = (anchor: PosterCommentAnchorTarget): { anchor_type: "region" | "floating" | "header" | "footer"; anchor_id: string | null } => {
  switch (anchor.type) {
    case "region":
      return { anchor_type: "region", anchor_id: anchor.id };
    case "floating":
      return { anchor_type: "floating", anchor_id: anchor.id };
    case "header":
      return { anchor_type: "header", anchor_id: "header-title" };
    case "headerSubtitle":
      return { anchor_type: "header", anchor_id: "header-subtitle" };
    case "footer":
      return { anchor_type: "footer", anchor_id: "footer" };
  }
};

const uiAnchorFromDb = (anchorType: string, anchorId: string | null): PosterCommentAnchorTarget => {
  if (anchorType === "region") {
    return { type: "region", id: anchorId };
  }
  if (anchorType === "floating") {
    return { type: "floating", id: anchorId };
  }
  if (anchorType === "footer") {
    return { type: "footer", id: null };
  }
  if (anchorType === "header" && anchorId === "header-subtitle") {
    return { type: "headerSubtitle", id: null };
  }
  return { type: "header", id: null };
};

export const listPosterCommentsAction = async (posterId: string): Promise<PosterCommentRecord[]> => {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("poster_comments")
    .select("id,poster_id,author_id,anchor_type,anchor_id,body,status,parent_id,created_at,updated_at")
    .eq("poster_id", posterId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load comments: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    posterId: row.poster_id as string,
    authorId: row.author_id as string,
    anchor: uiAnchorFromDb(row.anchor_type as string, (row.anchor_id as string | null) ?? null),
    body: row.body as string,
    status: row.status as PosterCommentStatus,
    parentId: (row.parent_id as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string
  }));
};

export const createPosterCommentAction = async (payload: {
  posterId: string;
  anchor: PosterCommentAnchorTarget;
  body: string;
  parentId?: string | null;
}): Promise<{ ok: true } | { ok: false; message: string }> => {
  const { supabase, user } = await requireUser();
  const body = payload.body.trim();
  if (!body) {
    return { ok: false, message: "Comment body cannot be empty." };
  }

  const dbAnchor = dbAnchorFromUi(payload.anchor);
  const { error } = await supabase.from("poster_comments").insert({
    poster_id: payload.posterId,
    author_id: user.id,
    anchor_type: dbAnchor.anchor_type,
    anchor_id: dbAnchor.anchor_id,
    body,
    parent_id: payload.parentId ?? null
  });

  if (error) {
    return { ok: false, message: `Failed to create comment: ${error.message}` };
  }

  return { ok: true };
};

export const updatePosterCommentStatusAction = async (payload: {
  commentId: string;
  status: PosterCommentStatus;
}): Promise<{ ok: true } | { ok: false; message: string }> => {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("poster_comments")
    .update({ status: payload.status })
    .eq("id", payload.commentId);

  if (error) {
    return { ok: false, message: `Failed to update comment: ${error.message}` };
  }

  return { ok: true };
};
