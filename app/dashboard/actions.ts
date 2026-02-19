"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createDefaultPosterDoc } from "@/lib/poster/default-doc";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const untitledName = () => `Untitled Poster ${new Date().toISOString().slice(0, 10)}`;

export const signOutAction = async () => {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
};

export const createPosterAction = async () => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const title = untitledName();
  const doc = createDefaultPosterDoc(title);

  const { data, error } = await supabase
    .from("posters")
    .insert({
      id: randomUUID(),
      title,
      doc,
      user_id: user.id
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create poster: ${error?.message ?? "Unknown error"}`);
  }

  revalidatePath("/dashboard");
  redirect(`/editor/${data.id}`);
};
