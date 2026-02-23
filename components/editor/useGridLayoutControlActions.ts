"use client";

import { useCallback } from "react";

interface UseGridLayoutControlActionsParams {
  selectedRegionId: string | null;
  moveRegionBy: (regionId: string, dx: number, dy: number) => boolean;
  splitHorizontal: (regionId: string) => boolean;
  splitVertical: (regionId: string) => boolean;
  mergeLeft: (regionId: string) => boolean;
  mergeRight: (regionId: string) => boolean;
  deleteRegion: (regionId: string) => boolean;
  onAddImage: () => void;
}

export function useGridLayoutControlActions({
  selectedRegionId,
  moveRegionBy,
  splitHorizontal,
  splitVertical,
  mergeLeft,
  mergeRight,
  deleteRegion,
  onAddImage
}: UseGridLayoutControlActionsParams) {
  const withSelectedRegion = useCallback(
    (callback: (regionId: string) => void) => () => {
      if (!selectedRegionId) {
        return;
      }

      callback(selectedRegionId);
    },
    [selectedRegionId]
  );

  return {
    onMoveUp: withSelectedRegion((regionId) => {
      moveRegionBy(regionId, 0, -1);
    }),
    onMoveLeft: withSelectedRegion((regionId) => {
      moveRegionBy(regionId, -1, 0);
    }),
    onMoveRight: withSelectedRegion((regionId) => {
      moveRegionBy(regionId, 1, 0);
    }),
    onMoveDown: withSelectedRegion((regionId) => {
      moveRegionBy(regionId, 0, 1);
    }),
    onSplitHorizontal: withSelectedRegion((regionId) => {
      splitHorizontal(regionId);
    }),
    onSplitVertical: withSelectedRegion((regionId) => {
      splitVertical(regionId);
    }),
    onMergeLeft: withSelectedRegion((regionId) => {
      mergeLeft(regionId);
    }),
    onMergeRight: withSelectedRegion((regionId) => {
      mergeRight(regionId);
    }),
    onDelete: withSelectedRegion((regionId) => {
      deleteRegion(regionId);
    }),
    onAddImage
  };
}
