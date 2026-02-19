import { notFound, redirect } from "next/navigation";

import EditorClient from "@/app/editor/[id]/editor-client";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PosterRow } from "@/lib/supabase/types";

interface EditorPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function EditorPage({ params }: EditorPageProps) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data, error } = await supabase.from("posters").select("*").eq("id", id).single();

  if (error) {
    if (error.code === "PGRST116") {
      notFound();
    }

    throw new Error(`Failed to load poster: ${error.message}`);
  }

  const poster = data as PosterRow;

  return <EditorClient posterId={poster.id} updatedAt={poster.updated_at} initialDoc={poster.doc} />;
}
