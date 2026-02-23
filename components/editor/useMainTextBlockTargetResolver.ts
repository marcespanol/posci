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
      const regionCandidates: PosterMainRegion[] = [];
      const preferredRegionId = gridSelectedRegionId ?? gridRegions[0]?.id ?? null;
      if (preferredRegionId) {
        const preferredRegion = v2PreviewDoc.sections.main.regions.find((item) => item.id === preferredRegionId);
        if (preferredRegion) {
          regionCandidates.push(preferredRegion);
        }
      }

      for (const region of v2PreviewDoc.sections.main.regions) {
        if (!regionCandidates.some((candidate) => candidate.id === region.id)) {
          regionCandidates.push(region);
        }
      }

      for (const region of regionCandidates) {
        const block = v2PreviewDoc.blocks[region.blockId];
        if (block && block.type === "text") {
          return block.id;
        }
      }

      return null;
    }

    return getLegacyTargetTextBlockId();
  }, [getLegacyTargetTextBlockId, gridRegions, gridSelectedRegionId, v2PreviewDoc]);
}
