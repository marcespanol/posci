"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PosterDocAny } from "@/lib/poster/types";

interface SavePosterPayload {
  posterId: string;
  title: string;
  doc: PosterDocAny;
}

export const savePosterAction = async (payload: SavePosterPayload) => {
  if (!payload.posterId) {
    throw new Error("Missing poster id");
  }

  const title = payload.title.trim().length > 0 ? payload.title.trim() : "Untitled Poster";

  const supabase = await createSupabaseServerClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase
    .from("posters")
    .update({
      title,
      doc: payload.doc
    })
    .eq("id", payload.posterId);

  if (error) {
    throw new Error(`Failed to save poster: ${error.message}`);
  }

  revalidatePath(`/editor/${payload.posterId}`);
  revalidatePath("/dashboard");
};
