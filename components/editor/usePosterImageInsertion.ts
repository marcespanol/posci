"use client";

import { useCallback } from "react";

import type { PosterBlock, TipTapJsonContent } from "@/lib/poster/types";
import { uploadPosterAsset } from "@/lib/supabase/assets-client";

interface UsePosterImageInsertionParams {
  posterId: string | null;
  blocks: Record<string, PosterBlock>;
  resolveTargetTextBlockId: () => string | null;
  setBlockContent: (blockId: string, content: TipTapJsonContent) => void;
}

const appendImageToDoc = (content: TipTapJsonContent, src: string, alt: string): TipTapJsonContent => {
  const currentBlocks = Array.isArray(content.content) ? [...content.content] : [];
  currentBlocks.push({
    type: "image",
    attrs: {
      src,
      alt,
      width: 520
    }
  });

  return {
    ...content,
    type: "doc",
    content: currentBlocks
  };
};

export function usePosterImageInsertion({
  posterId,
  blocks,
  resolveTargetTextBlockId,
  setBlockContent
}: UsePosterImageInsertionParams) {
  return useCallback(
    (file: File) => {
      if (!posterId) {
        return;
      }

      const targetTextBlockId = resolveTargetTextBlockId();
      if (!targetTextBlockId) {
        return;
      }

      const targetBlock = blocks[targetTextBlockId];
      if (!targetBlock || targetBlock.type !== "text") {
        return;
      }

      void (async () => {
        try {
          const uploaded = await uploadPosterAsset(posterId, file);
          const nextContent = appendImageToDoc(targetBlock.content, uploaded.signedUrl, file.name || "Uploaded image");
          setBlockContent(targetTextBlockId, nextContent);
        } catch (error) {
          console.error("Add image failed", error);
        }
      })();
    },
    [blocks, posterId, resolveTargetTextBlockId, setBlockContent]
  );
}
