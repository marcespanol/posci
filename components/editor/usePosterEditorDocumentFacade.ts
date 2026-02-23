"use client";

import { useMemo } from "react";

import { persistablePosterDocHash, toPersistablePosterDoc } from "@/lib/poster/persistence-adapter";
import { selectPosterReadDoc, selectPosterReadTitle } from "@/lib/store/poster-read-selectors";
import type { PosterDocAny, PosterDocV2 } from "@/lib/poster/types";
import { usePosterEditorStore } from "@/lib/store/poster-store";

export interface PosterEditorDocumentFacade {
  readDoc: PosterDocAny | null;
  gridModeDocV2: PosterDocV2 | null;
  readTitle: string;
  persistableDoc: PosterDocAny | null;
  persistableHash: string;
}

export function usePosterEditorDocumentFacade(): PosterEditorDocumentFacade {
  const readDoc = usePosterEditorStore(selectPosterReadDoc);
  const gridModeDocV2 = usePosterEditorStore((state) => state.gridModeDocV2);
  const readTitle = usePosterEditorStore(selectPosterReadTitle);

  const persistableDoc = useMemo(() => {
    if (!gridModeDocV2) {
      return null;
    }

    return toPersistablePosterDoc(null, gridModeDocV2);
  }, [gridModeDocV2]);

  const persistableHash = useMemo(() => {
    if (!gridModeDocV2) {
      return "";
    }

    return persistablePosterDocHash(null, gridModeDocV2);
  }, [gridModeDocV2]);

  return {
    readDoc,
    gridModeDocV2,
    readTitle,
    persistableDoc,
    persistableHash
  };
}
