"use client";

import { useCallback } from "react";

import type { PosterDocV2, PosterMainRegion } from "@/lib/poster/types";

interface UseMainTextBlockTargetResolverParams {
  v2PreviewDoc: PosterDocV2 | null;
  gridSelectedRegionId: string | null;
  gridRegions: PosterMainRegion[];
  getLegacyTargetTextBlockId: () => string | null;
}

export function useMainTextBlockTargetResolver({
  v2PreviewDoc,
  gridSelectedRegionId,
  gridRegions,
  getLegacyTargetTextBlockId
}: UseMainTextBlockTargetResolverParams) {
  return useCallback((): string | null => {
    if (v2PreviewDoc) {
      const preferredRegionId = gridSelectedRegionId ?? gridRegions[0]?.id ?? null;
      if (!preferredRegionId) {
        return null;
      }

      const region = v2PreviewDoc.sections.main.regions.find((item) => item.id === preferredRegionId);
      if (!region) {
        return null;
      }

      const block = v2PreviewDoc.blocks[region.blockId];
      if (!block || block.type !== "text") {
        return null;
      }

      return block.id;
    }

    return getLegacyTargetTextBlockId();
  }, [getLegacyTargetTextBlockId, gridRegions, gridSelectedRegionId, v2PreviewDoc]);
}
