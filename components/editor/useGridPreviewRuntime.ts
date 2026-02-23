"use client";

import { useEffect } from "react";

import type { PosterDocV2 } from "@/lib/poster/types";

interface UseGridPreviewRuntimeParams {
  gridModeDocV2: PosterDocV2 | null;
  initializeRegions: (regions: PosterDocV2["sections"]["main"]["regions"]) => void;
  selectRegion: (regionId: string | null) => void;
}

export interface GridPreviewRuntimeResult {
  v2PreviewDoc: PosterDocV2 | null;
  isGridPreviewMode: boolean;
}

export function useGridPreviewRuntime({
  gridModeDocV2,
  initializeRegions,
  selectRegion
}: UseGridPreviewRuntimeParams): GridPreviewRuntimeResult {
  const v2PreviewDoc = gridModeDocV2;

  useEffect(() => {
    if (!v2PreviewDoc) {
      initializeRegions([]);
      selectRegion(null);
      return;
    }

    initializeRegions(v2PreviewDoc.sections.main.regions);
  }, [initializeRegions, selectRegion, v2PreviewDoc]);

  return {
    v2PreviewDoc,
    isGridPreviewMode: Boolean(v2PreviewDoc)
  };
}
