"use server";

import { redirect } from "next/navigation";

import type { PosterMemberRole } from "@/lib/poster/capabilities";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface PosterMemberListItem {
  userId: string;
  role: PosterMemberRole;
  email: string | null;
  isOwner: boolean;
}

const VALID_MEMBER_ROLES: PosterMemberRole[] = ["editor", "commenter", "viewer"];

const ensureRole = (role: string): PosterMemberRole => {
  if ((["owner", "editor", "commenter", "viewer"] as const).includes(role as PosterMemberRole)) {
    return role as PosterMemberRole;
  }

  throw new Error("Invalid member role");
};

const requireEditorUser = async () => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return { supabase, user };
};

const assertPosterOwner = async (posterId: string) => {
  const { supabase, user } = await requireEditorUser();
  const { data: poster, error } = await supabase.from("posters").select("id,user_id").eq("id", posterId).single();
  if (error || !poster) {
    throw new Error(error ? `Failed to load poster: ${error.message}` : "Poster not found");
  }

  if (poster.user_id !== user.id) {
    throw new Error("Only the poster owner can manage sharing.");
  }

  return { supabase, user, poster };
};

const loadEmailsForUserIds = async (userIds: string[]): Promise<Record<string, string | null>> => {
  if (userIds.length === 0) {
    return {};
  }

  const admin = createSupabaseAdminClient();
  const emailById: Record<string, string | null> = {};
  const targetIds = new Set(userIds);

  let page = 1;
  const perPage = 200;
  let safety = 0;
  while (targetIds.size > 0 && safety < 30) {
    safety += 1;
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(`Failed to list users: ${error.message}`);
    }

    const users = data.users ?? [];
    for (const authUser of users) {
      if (targetIds.has(authUser.id)) {
        emailById[authUser.id] = authUser.email ?? null;
        targetIds.delete(authUser.id);
      }
    }

    if (users.length < perPage) {
      break;
    }
    page += 1;
  }

  for (const userId of userIds) {
    if (!(userId in emailById)) {
      emailById[userId] = null;
    }
  }

  return emailById;
};

const findUserIdByEmail = async (email: string): Promise<string | null> => {
  const admin = createSupabaseAdminClient();
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    return null;
  }

  let page = 1;
  const perPage = 200;
  let safety = 0;
  while (safety < 50) {
    safety += 1;
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(`Failed to list users: ${error.message}`);
    }

    const users = data.users ?? [];
    const match = users.find((user) => (user.email ?? "").toLowerCase() === normalizedEmail);
    if (match) {
      return match.id;
    }

    if (users.length < perPage) {
      return null;
    }

    page += 1;
  }

  return null;
};

export const listPosterMembersAction = async (posterId: string): Promise<PosterMemberListItem[]> => {
  const { supabase } = await assertPosterOwner(posterId);
  const { data, error } = await supabase
    .from("poster_members")
    .select("user_id,role")
    .eq("poster_id", posterId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to list members: ${error.message}`);
  }

  const rows = (data ?? []).map((row) => ({
    userId: row.user_id as string,
    role: ensureRole(row.role as string)
  }));

  let emailById: Record<string, string | null> = {};
  try {
    emailById = await loadEmailsForUserIds(rows.map((row) => row.userId));
  } catch (error) {
    // If service key is missing, list can still render with user IDs.
    console.error("Failed to resolve member emails", error);
  }

  return rows.map((row) => ({
    userId: row.userId,
    role: row.role,
    email: emailById[row.userId] ?? null,
    isOwner: row.role === "owner"
  }));
};

export const addPosterMemberByEmailAction = async (payload: {
  posterId: string;
  email: string;
  role: PosterMemberRole;
}): Promise<{ ok: true } | { ok: false; message: string }> => {
  const { supabase, user } = await assertPosterOwner(payload.posterId);
  if (!VALID_MEMBER_ROLES.includes(payload.role)) {
    return { ok: false, message: "Only editor/commenter/viewer roles can be assigned." };
  }

  let targetUserId: string | null;
  try {
    targetUserId = await findUserIdByEmail(payload.email);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to resolve user email";
    return { ok: false, message };
  }

  if (!targetUserId) {
    return { ok: false, message: "No user found with that email." };
  }

  if (targetUserId === user.id) {
    return { ok: false, message: "Owner is already a member." };
  }

  const { error } = await supabase.from("poster_members").upsert(
    {
      poster_id: payload.posterId,
      user_id: targetUserId,
      role: payload.role
    },
    {
      onConflict: "poster_id,user_id"
    }
  );

  if (error) {
    return { ok: false, message: `Failed to add member: ${error.message}` };
  }

  return { ok: true };
};

export const updatePosterMemberRoleAction = async (payload: {
  posterId: string;
  userId: string;
  role: PosterMemberRole;
}): Promise<{ ok: true } | { ok: false; message: string }> => {
  const { supabase, poster } = await assertPosterOwner(payload.posterId);

  if (!VALID_MEMBER_ROLES.includes(payload.role)) {
    return { ok: false, message: "Only editor/commenter/viewer roles can be assigned." };
  }

  if (payload.userId === poster.user_id) {
    return { ok: false, message: "Owner role cannot be changed here." };
  }

  const { error } = await supabase
    .from("poster_members")
    .update({ role: payload.role })
    .eq("poster_id", payload.posterId)
    .eq("user_id", payload.userId);

  if (error) {
    return { ok: false, message: `Failed to update role: ${error.message}` };
  }

  return { ok: true };
};

export const removePosterMemberAction = async (payload: {
  posterId: string;
  userId: string;
}): Promise<{ ok: true } | { ok: false; message: string }> => {
  const { supabase, poster } = await assertPosterOwner(payload.posterId);

  if (payload.userId === poster.user_id) {
    return { ok: false, message: "Owner cannot be removed." };
  }

  const { error } = await supabase
    .from("poster_members")
    .delete()
    .eq("poster_id", payload.posterId)
    .eq("user_id", payload.userId);

  if (error) {
    return { ok: false, message: `Failed to remove member: ${error.message}` };
  }

  return { ok: true };
};
