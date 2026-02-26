import { notFound, redirect } from "next/navigation";

import EditorClient from "@/app/editor/[id]/editor-client";
import type { PosterCollabAccess } from "@/lib/poster/locking-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PosterMemberRow, PosterRow } from "@/lib/supabase/types";

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

  const { data: memberData } = await supabase
    .from("poster_members")
    .select("poster_id,user_id,role")
    .eq("poster_id", poster.id)
    .eq("user_id", user.id)
    .maybeSingle();

  const member = memberData as PosterMemberRow | null;
  const access: PosterCollabAccess = {
    userId: user.id,
    role: member?.role ?? (poster.user_id === user.id ? "owner" : "viewer")
  };

  return <EditorClient posterId={poster.id} updatedAt={poster.updated_at} initialDoc={poster.doc} access={access} />;
}
