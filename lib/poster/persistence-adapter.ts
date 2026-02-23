import type { PosterDoc, PosterDocAny, PosterDocV2 } from "@/lib/poster/types";

const resolveCanonicalGridV2SaveEnabled = (): boolean => {
  // Grid mode saves canonical v2 docs unless explicitly disabled.
  if (process.env.NEXT_PUBLIC_DISABLE_CANONICAL_GRID_V2_SAVE === "1") {
    return false;
  }

  return true;
};

const ENABLE_CANONICAL_GRID_V2_SAVE = resolveCanonicalGridV2SaveEnabled();

export const withResetHistory = <T extends { history: { canUndo: boolean; canRedo: boolean } }>(doc: T): T => {
  return {
    ...doc,
    history: {
      canUndo: false,
      canRedo: false
    }
  };
};

export const toPersistablePosterDoc = (
  doc: PosterDoc | null,
  gridModeDocV2: PosterDocV2 | null
): PosterDocAny => {
  if (ENABLE_CANONICAL_GRID_V2_SAVE && gridModeDocV2) {
    return withResetHistory(gridModeDocV2);
  }

  if (!doc) {
    throw new Error("Missing compatibility poster doc while canonical v2 mirror is unavailable");
  }

  return withResetHistory(doc);
};

export interface PersistablePosterSavePayload {
  title: string;
  doc: PosterDocAny;
}

export const toPersistablePosterSavePayload = (
  doc: PosterDoc | null,
  gridModeDocV2: PosterDocV2 | null
): PersistablePosterSavePayload => {
  const persistableDoc = toPersistablePosterDoc(doc, gridModeDocV2);

  return {
    title: persistableDoc.meta.title,
    doc: persistableDoc
  };
};

export const persistablePosterDocHash = (
  doc: PosterDoc | null,
  gridModeDocV2: PosterDocV2 | null
): string => {
  return JSON.stringify(toPersistablePosterSavePayload(doc, gridModeDocV2));
};
