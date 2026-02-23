"use client";

import { useCallback } from "react";

import type { PosterBlock, TipTapJsonContent } from "@/lib/poster/types";
import { uploadPosterAsset } from "@/lib/supabase/assets-client";
import { usePosterEditorStore } from "@/lib/store/poster-store";

interface UsePosterImageInsertionParams {
  posterId: string | null;
  blocks: Record<string, PosterBlock>;
  resolveTargetTextBlockId: () => string | null;
  setBlockContent: (blockId: string, content: TipTapJsonContent) => void;
}

const removeEmptyTextNodes = (node: TipTapJsonContent): TipTapJsonContent | null => {
  if (node.type === "text" && typeof node.text === "string" && node.text.length === 0) {
    return null;
  }

  const nextChildren = Array.isArray(node.content)
    ? node.content
        .map(removeEmptyTextNodes)
        .filter((child): child is TipTapJsonContent => child !== null)
    : undefined;

  return {
    ...node,
    ...(nextChildren ? { content: nextChildren } : {})
  };
};

const appendImageToDoc = (content: TipTapJsonContent, src: string, alt: string): TipTapJsonContent => {
  const sanitized = removeEmptyTextNodes(content) ?? { type: "doc", content: [] };
  const currentBlocks = Array.isArray(sanitized.content) ? [...sanitized.content] : [];
  currentBlocks.push({
    type: "image",
    attrs: {
      src,
      alt,
      width: 520
    }
  });

  return {
    ...sanitized,
    type: "doc",
    content: currentBlocks
  };
};

export function usePosterImageInsertion({
  posterId,
  blocks: _blocks,
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
        console.warn("Add image skipped: no target text region selected or available.");
        return;
      }

      void (async () => {
        try {
          const getLatestTargetBlock = (): PosterBlock | null => {
            const latestBlocks = usePosterEditorStore.getState().gridModeDocV2?.blocks ?? _blocks;
            return latestBlocks[targetTextBlockId] ?? null;
          };

          const beforeUploadBlock = getLatestTargetBlock();
          if (!beforeUploadBlock || beforeUploadBlock.type !== "text") {
            console.warn("Add image skipped: target block is missing or not text.", { targetTextBlockId });
            return;
          }

          const uploaded = await uploadPosterAsset(posterId, file);
          const latestTargetBlock = getLatestTargetBlock();
          if (!latestTargetBlock || latestTargetBlock.type !== "text") {
            console.warn("Add image skipped after upload: target block is missing or not text.", { targetTextBlockId });
            return;
          }

          const nextContent = appendImageToDoc(latestTargetBlock.content, uploaded.signedUrl, file.name || "Uploaded image");
          setBlockContent(targetTextBlockId, nextContent);
        } catch (error) {
          console.error("Add image failed", error);
        }
      })();
    },
    [_blocks, posterId, resolveTargetTextBlockId, setBlockContent]
  );
}
