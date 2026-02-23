"use client";

import { useEffect, useMemo, useRef } from "react";

import { migratePosterDocToLatest } from "@/lib/poster/migrations";
import type { PosterDoc, PosterDocV2 } from "@/lib/poster/types";

interface UseGridPreviewRuntimeParams {
  doc: PosterDoc | null;
  gridModeDocV2: PosterDocV2 | null;
  initializeRegions: (regions: PosterDocV2["sections"]["main"]["regions"]) => void;
  selectRegion: (regionId: string | null) => void;
}

export interface GridPreviewRuntimeResult {
  v2PreviewDoc: PosterDocV2 | null;
  isGridPreviewMode: boolean;
}

export function useGridPreviewRuntime({
  doc,
  gridModeDocV2,
  initializeRegions,
  selectRegion
}: UseGridPreviewRuntimeParams): GridPreviewRuntimeResult {
  const hasWarnedMirrorFallbackRef = useRef(false);

  const v2PreviewDoc = useMemo<PosterDocV2 | null>(() => {
    if (!doc) {
      return null;
    }

    if (gridModeDocV2) {
      return gridModeDocV2;
    }

    try {
      return migratePosterDocToLatest(doc);
    } catch (error) {
      console.error("V2 grid preview migration failed", error);
      return null;
    }
  }, [doc, gridModeDocV2]);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") {
      return;
    }

    if (hasWarnedMirrorFallbackRef.current) {
      return;
    }

    if (!doc) {
      return;
    }

    if (gridModeDocV2) {
      return;
    }

    hasWarnedMirrorFallbackRef.current = true;
    console.warn(
      "[grid-v2] Falling back to v1 compatibility doc for preview runtime because canonical gridModeDocV2 mirror is missing.",
      {
        docVersion: doc.version,
        hasExperimentalGrid: Boolean(doc.experimental?.mainGridV2)
      }
    );
  }, [doc, gridModeDocV2]);

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
