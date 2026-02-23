"use client";

import { useCallback, useMemo } from "react";

import {
  selectPosterGridRegionsForView,
  selectPosterGridSelectedRegionId
} from "@/lib/store/poster-read-selectors";
import type { PosterMainRegion } from "@/lib/poster/types";
import { usePosterEditorStore } from "@/lib/store/poster-store";

export function usePosterGridFacade() {
  const regions = usePosterEditorStore(selectPosterGridRegionsForView);
  const selectedRegionId = usePosterEditorStore(selectPosterGridSelectedRegionId);
  const initializeRegions = usePosterEditorStore((state) => state.initializeGridPreviewRegions);
  const selectRegion = usePosterEditorStore((state) => state.selectGridPreviewRegion);
  const updateRegionRect = usePosterEditorStore((state) => state.updateGridPreviewRegionRect);
  const splitHorizontal = usePosterEditorStore((state) => state.splitGridPreviewRegionHorizontal);
  const splitVertical = usePosterEditorStore((state) => state.splitGridPreviewRegionVertical);
  const moveRegionBy = usePosterEditorStore((state) => state.moveGridPreviewRegionBy);
  const deleteRegion = usePosterEditorStore((state) => state.deleteGridPreviewRegion);
  const mergeLeft = usePosterEditorStore((state) => state.mergeGridPreviewRegionWithLeft);
  const mergeRight = usePosterEditorStore((state) => state.mergeGridPreviewRegionWithRight);
  const createRegion = usePosterEditorStore((state) => state.createGridPreviewRegion);
  const clearSelection = useCallback(() => {
    selectRegion(null);
  }, [selectRegion]);

  const selectedRegion = useMemo<PosterMainRegion | null>(() => {
    if (!selectedRegionId) {
      return null;
    }

    return regions.find((region) => region.id === selectedRegionId) ?? null;
  }, [regions, selectedRegionId]);

  const canSplitHorizontally = Boolean(selectedRegion && selectedRegion.h >= 2);
  const canSplitVertically = Boolean(selectedRegion && selectedRegion.w >= 2);
  const canMergeRight = Boolean(
    selectedRegion &&
      regions.some(
        (region) =>
          region.id !== selectedRegion.id &&
          region.x === selectedRegion.x + selectedRegion.w &&
          region.y === selectedRegion.y &&
          region.h === selectedRegion.h
      )
  );
  const canMergeLeft = Boolean(
    selectedRegion &&
      regions.some(
        (region) =>
          region.id !== selectedRegion.id &&
          region.x + region.w === selectedRegion.x &&
          region.y === selectedRegion.y &&
          region.h === selectedRegion.h
      )
  );

  return useMemo(
    () => ({
      regions,
      selectedRegionId,
      selectedRegion,
      canSplitHorizontally,
      canSplitVertically,
      canMergeLeft,
      canMergeRight,
      initializeRegions,
      selectRegion,
      clearSelection,
      updateRegionRect,
      splitHorizontal,
      splitVertical,
      moveRegionBy,
      deleteRegion,
      createRegion,
      mergeLeft,
      mergeRight
    }),
    [
      canMergeLeft,
      canMergeRight,
      canSplitHorizontally,
      canSplitVertically,
      clearSelection,
      deleteRegion,
      createRegion,
      initializeRegions,
      mergeLeft,
      mergeRight,
      moveRegionBy,
      regions,
      selectRegion,
      selectedRegion,
      selectedRegionId,
      splitHorizontal,
      splitVertical,
      updateRegionRect
    ]
  );
}
