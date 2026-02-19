"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export interface UploadedPosterAsset {
  assetId: string;
  storagePath: string;
  signedUrl: string;
  mimeType: string;
  sizeBytes: number;
}

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 365 * 10;

const sanitizeFileName = (name: string): string => {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").toLowerCase();
};

export const uploadPosterAsset = async (posterId: string, file: File): Promise<UploadedPosterAsset> => {
  const supabase = createSupabaseBrowserClient();

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error(userError?.message ?? "You must be signed in to upload assets.");
  }

  const assetId = crypto.randomUUID();
  const safeName = sanitizeFileName(file.name || "image");
  const storagePath = `${user.id}/${posterId}/${assetId}-${safeName}`;

  const { error: uploadError } = await supabase.storage.from("poster-assets").upload(storagePath, file, {
    upsert: false,
    contentType: file.type || "application/octet-stream"
  });

  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  const { error: insertError } = await supabase.from("poster_assets").insert({
    id: assetId,
    user_id: user.id,
    poster_id: posterId,
    storage_path: storagePath,
    mime_type: file.type || "application/octet-stream",
    size_bytes: file.size
  });

  if (insertError) {
    throw new Error(`Asset metadata save failed: ${insertError.message}`);
  }

  const { data: signed, error: signedError } = await supabase.storage
    .from("poster-assets")
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

  if (signedError || !signed?.signedUrl) {
    throw new Error(`Signed URL generation failed: ${signedError?.message ?? "Unknown error"}`);
  }

  return {
    assetId,
    storagePath,
    signedUrl: signed.signedUrl,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size
  };
};
