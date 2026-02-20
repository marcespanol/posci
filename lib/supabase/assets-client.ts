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
const configuredBucket = process.env.NEXT_PUBLIC_SUPABASE_POSTER_ASSETS_BUCKET?.trim();
const BUCKET_CANDIDATES = configuredBucket
  ? [configuredBucket]
  : ["poster-assets", "poster_assets"];

const sanitizeFileName = (name: string): string => {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").toLowerCase();
};

const extensionFromMime = (mimeType: string): string => {
  switch (mimeType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "bin";
  }
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
  const mimeType = file.type || "application/octet-stream";
  const baseName =
    sanitizeFileName(file.name || `image.${extensionFromMime(mimeType)}`) || `image.${extensionFromMime(mimeType)}`;
  const primaryPath = `${user.id}/${posterId}/${assetId}-${baseName}`;
  const secondaryPath = `${user.id}/${posterId}/${assetId}/${baseName}`;
  const candidatePaths = [primaryPath, secondaryPath];

  let storagePath = primaryPath;
  let bucketName = BUCKET_CANDIDATES[0];
  let uploadErrorMessage: string | null = null;

  for (const candidateBucket of BUCKET_CANDIDATES) {
    for (const candidatePath of candidatePaths) {
      const { error: uploadError } = await supabase.storage.from(candidateBucket).upload(candidatePath, file, {
        upsert: false,
        contentType: mimeType
      });

      if (!uploadError) {
        bucketName = candidateBucket;
        storagePath = candidatePath;
        uploadErrorMessage = null;
        break;
      }

      uploadErrorMessage = uploadError.message;
    }

    if (!uploadErrorMessage) {
      break;
    }
  }

  if (uploadErrorMessage) {
    throw new Error(`Upload failed: ${uploadErrorMessage}`);
  }

  const { error: insertError } = await supabase.from("poster_assets").insert({
    id: assetId,
    user_id: user.id,
    poster_id: posterId,
    storage_path: storagePath,
    mime_type: mimeType,
    size_bytes: file.size
  });

  if (insertError) {
    throw new Error(`Asset metadata save failed: ${insertError.message}`);
  }

  const { data: signed, error: signedError } = await supabase.storage
    .from(bucketName)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

  if (signedError || !signed?.signedUrl) {
    throw new Error(`Signed URL generation failed: ${signedError?.message ?? "Unknown error"}`);
  }

  return {
    assetId,
    storagePath,
    signedUrl: signed.signedUrl,
    mimeType,
    sizeBytes: file.size
  };
};
