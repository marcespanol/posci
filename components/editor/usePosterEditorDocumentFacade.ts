"use client";

import { useMemo } from "react";

import { persistablePosterDocHash, toPersistablePosterDoc } from "@/lib/poster/persistence-adapter";
import { selectPosterReadDoc, selectPosterReadTitle } from "@/lib/store/poster-read-selectors";
import type { PosterDoc, PosterDocAny, PosterDocV2 } from "@/lib/poster/types";
import { usePosterEditorStore } from "@/lib/store/poster-store";

export interface PosterEditorDocumentFacade {
  doc: PosterDoc | null;
  readDoc: PosterDocAny | null;
  gridModeDocV2: PosterDocV2 | null;
  readTitle: string;
  persistableDoc: PosterDocAny | null;
  persistableHash: string;
}

export function usePosterEditorDocumentFacade(): PosterEditorDocumentFacade {
  const doc = usePosterEditorStore((state) => state.doc);
  const readDoc = usePosterEditorStore(selectPosterReadDoc);
  const gridModeDocV2 = usePosterEditorStore((state) => state.gridModeDocV2);
  const readTitle = usePosterEditorStore(selectPosterReadTitle);

  const persistableDoc = useMemo(() => {
    if (!doc && !gridModeDocV2) {
      return null;
    }

    return toPersistablePosterDoc(doc, gridModeDocV2);
  }, [doc, gridModeDocV2]);

  const persistableHash = useMemo(() => {
    if (!doc && !gridModeDocV2) {
      return "";
    }

    return persistablePosterDocHash(doc, gridModeDocV2);
  }, [doc, gridModeDocV2]);

  return {
    doc,
    readDoc,
    gridModeDocV2,
    readTitle,
    persistableDoc,
    persistableHash
  };
}
