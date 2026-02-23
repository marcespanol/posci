import { create } from "zustand";

import { adaptPosterDocV2ToEditorV1, migratePosterDocToLatest, normalizePosterDocV2 } from "@/lib/poster/migrations";
import type {
  ColorTheme,
  PosterBlock,
  PosterDoc,
  PosterDocAny,
  PosterDocLatest,
  PosterDocV2,
  PosterMainRegion,
  PosterOrientation,
  PosterSizePreset,
  TipTapJsonContent,
  TypographyTheme
} from "@/lib/poster/types";

interface InitializePosterPayload {
  posterId: string;
  doc: PosterDocAny;
}

interface CommitOptions {
  groupKey?: string;
  groupWindowMs?: number;
}

const cloneDoc = (doc: PosterDoc): PosterDoc => structuredClone(doc);
const cloneValue = <T>(value: T): T => structuredClone(value);
const MAX_HISTORY = 100;

const isTextualBlock = (
  block: PosterBlock
): block is Extract<PosterBlock, { type: "text" | "floatingParagraph" }> => {
  return block.type === "text" || block.type === "floatingParagraph";
};

const createId = (prefix: string): string => {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
};

const createDefaultTextContent = (title?: string): TipTapJsonContent => ({
  type: "doc",
  content: [
    ...(title
      ? [
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: title }]
          }
        ]
      : []),
    {
      type: "paragraph",
      content: [{ type: "text", text: "" }]
    }
  ]
});

const createPlainTextDoc = (text: string): TipTapJsonContent => ({
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: text ? [{ type: "text", text }] : [{ type: "text", text: "" }]
    }
  ]
});

interface ImageNodeAttrs {
  src?: string;
  alt?: string;
  title?: string;
}

const isTipTapImageNode = (node: TipTapJsonContent): boolean => {
  return node.type === "image" || node.type === "inlineImage";
};

const collectImageAttrs = (node: TipTapJsonContent, output: ImageNodeAttrs[]): void => {
  if (isTipTapImageNode(node)) {
    output.push({
      src: typeof node.attrs?.src === "string" ? node.attrs.src : undefined,
      alt: typeof node.attrs?.alt === "string" ? node.attrs.alt : undefined,
      title: typeof node.attrs?.title === "string" ? node.attrs.title : undefined
    });
  }

  for (const child of node.content ?? []) {
    collectImageAttrs(child, output);
  }
};

const restoreMissingImageAttrs = (
  nextNode: TipTapJsonContent,
  previousAttrsByOrder: ImageNodeAttrs[],
  state: { index: number }
): TipTapJsonContent => {
  let nextAttrs = nextNode.attrs;
  let changed = false;

  if (isTipTapImageNode(nextNode)) {
    const previous = previousAttrsByOrder[state.index];
    state.index += 1;

    const nextSrc = typeof nextNode.attrs?.src === "string" ? nextNode.attrs.src : "";
    const nextAlt = typeof nextNode.attrs?.alt === "string" ? nextNode.attrs.alt : "";
    const nextTitle = typeof nextNode.attrs?.title === "string" ? nextNode.attrs.title : "";

    const patchedAttrs: Record<string, string | number | boolean | null> = {
      ...(nextNode.attrs ?? {})
    };

    if (!nextSrc && previous?.src) {
      patchedAttrs.src = previous.src;
      changed = true;
    }

    if (!nextAlt && previous?.alt) {
      patchedAttrs.alt = previous.alt;
      changed = true;
    }

    if (!nextTitle && previous?.title) {
      patchedAttrs.title = previous.title;
      changed = true;
    }

    nextAttrs = patchedAttrs;
  }

  const nextChildren = nextNode.content ?? [];
  let childrenChanged = false;
  const restoredChildren = nextChildren.map((child) => {
    const restored = restoreMissingImageAttrs(child, previousAttrsByOrder, state);
    if (restored !== child) {
      childrenChanged = true;
    }
    return restored;
  });

  if (!changed && !childrenChanged) {
    return nextNode;
  }

  return {
    ...nextNode,
    ...(nextAttrs ? { attrs: nextAttrs } : {}),
    ...(nextNode.content ? { content: restoredChildren } : {})
  };
};

const reconcileMissingTipTapImageAttrs = (previous: TipTapJsonContent, next: TipTapJsonContent): TipTapJsonContent => {
  const previousAttrsByOrder: ImageNodeAttrs[] = [];
  collectImageAttrs(previous, previousAttrsByOrder);
  return restoreMissingImageAttrs(next, previousAttrsByOrder, { index: 0 });
};

const withHistoryFlags = (doc: PosterDoc, canUndo: boolean, canRedo: boolean): PosterDoc => ({
  ...doc,
  history: {
    canUndo,
    canRedo
  }
});

const withHistoryFlagsV2 = (doc: PosterDocV2, canUndo: boolean, canRedo: boolean): PosterDocV2 => ({
  ...doc,
  history: {
    canUndo,
    canRedo
  }
});

const normalizePosterDoc = (doc: PosterDoc): PosterDoc => {
  const nextMeta = {
    ...doc.meta,
    headerSubtitleVisible: doc.meta.headerSubtitleVisible ?? true
  };
  const nextSections = {
    ...doc.sections,
    headerSubtitle: doc.sections.headerSubtitle ?? {
      content: createPlainTextDoc("Author Name • Institution Name • 2026")
    }
  };

  return {
    ...doc,
    meta: nextMeta,
    sections: nextSections,
    experimental: {
      ...doc.experimental,
      mainEditorMode: "grid-v2"
    }
  };
};

const isPosterDocV2 = (doc: PosterDocAny): doc is PosterDocV2 => doc.version === 2;

const prepareIncomingDocForCurrentEditor = (doc: PosterDocAny): PosterDocLatest => {
  if (isPosterDocV2(doc)) {
    return normalizePosterDoc(adaptPosterDocV2ToEditorV1(doc));
  }

  return normalizePosterDoc(cloneDoc(doc));
};

const regionsOverlap = (a: Pick<PosterMainRegion, "id" | "x" | "y" | "w" | "h">, b: Pick<PosterMainRegion, "id" | "x" | "y" | "w" | "h">): boolean => {
  if (a.id === b.id) {
    return false;
  }

  const xOverlap = a.x < b.x + b.w && a.x + a.w > b.x;
  const yOverlap = a.y < b.y + b.h && a.y + a.h > b.y;
  return xOverlap && yOverlap;
};

const clampPreviewRegionRect = (
  rect: Pick<PosterMainRegion, "x" | "y" | "w" | "h">,
  grid: { cols: number; rows: number }
): Pick<PosterMainRegion, "x" | "y" | "w" | "h"> => {
  const x = Math.max(0, Math.min(grid.cols - 1, Math.round(rect.x)));
  const y = Math.max(0, Math.min(grid.rows - 1, Math.round(rect.y)));
  const w = Math.max(1, Math.min(grid.cols - x, Math.round(rect.w)));
  const h = Math.max(1, Math.min(grid.rows - y, Math.round(rect.h)));

  return { x, y, w, h };
};

const syncGridModeDocV2Regions = (state: PosterEditorState, nextRegions: PosterMainRegion[]): PosterDocV2 | null => {
  if (!state.gridModeDocV2) {
    return null;
  }

  return normalizePosterDocV2({
    ...state.gridModeDocV2,
    sections: {
      ...state.gridModeDocV2.sections,
      main: {
        ...state.gridModeDocV2.sections.main,
        regions: structuredClone(nextRegions)
      }
    }
  });
};

const deriveCompatibilityDocFromGridMode = (state: PosterEditorState, nextGridModeDocV2: PosterDocV2 | null): PosterDoc | null => {
  if (!state.doc) {
    return state.doc;
  }

  if (!nextGridModeDocV2) {
    return state.doc;
  }

  return normalizePosterDoc(adaptPosterDocV2ToEditorV1(nextGridModeDocV2));
};

const getGridRegionsSource = (state: PosterEditorState): PosterMainRegion[] => {
  return state.gridModeDocV2?.sections.main.regions ?? [];
};

const bootstrapGridModeDocV2FromRegions = (
  state: PosterEditorState,
  nextRegions: PosterMainRegion[]
): PosterDocV2 | null => {
  if (state.gridModeDocV2) {
    return syncGridModeDocV2Regions(state, nextRegions);
  }

  if (!state.doc) {
    return null;
  }

  const migrated = migratePosterDocToLatest(cloneValue(state.doc));
  return normalizePosterDocV2({
    ...migrated,
    sections: {
      ...migrated.sections,
      main: {
        ...migrated.sections.main,
        regions: structuredClone(nextRegions)
      }
    }
  });
};

const sameRegionLayout = (a: PosterMainRegion[], b: PosterMainRegion[]): boolean => {
  if (a.length !== b.length) {
    return false;
  }

  for (let index = 0; index < a.length; index += 1) {
    const left = a[index];
    const right = b[index];
    if (!left || !right) {
      return false;
    }

    if (
      left.id !== right.id ||
      left.x !== right.x ||
      left.y !== right.y ||
      left.w !== right.w ||
      left.h !== right.h ||
      left.blockId !== right.blockId
    ) {
      return false;
    }
  }

  return true;
};

const commitGridModeMirrorMutation = (
  state: PosterEditorState,
  mutateV2: (doc: PosterDocV2) => PosterDocV2,
  options?: CommitOptions
): PosterEditorState => {
  const baseV2 = state.gridModeDocV2
    ? cloneValue(state.gridModeDocV2)
    : migratePosterDocToLatest(cloneValue(state.doc as PosterDoc));
  const nextGridModeDocV2 = normalizePosterDocV2(mutateV2(baseV2));
  const groupKey = options?.groupKey;
  const groupWindowMs = options?.groupWindowMs ?? 1200;
  const now = Date.now();
  const shouldGroup =
    Boolean(groupKey) &&
    state.gridHistoryGroupKey === groupKey &&
    now - state.gridHistoryGroupAt <= groupWindowMs;

  if (shouldGroup) {
    const nextWithFlags = withHistoryFlagsV2(nextGridModeDocV2, state.gridHistoryPast.length > 0, false);
    return {
      ...state,
      isDirty: true,
      canUndo: state.gridHistoryPast.length > 0,
      canRedo: false,
      gridHistoryFuture: [],
      gridHistoryGroupKey: groupKey ?? null,
      gridHistoryGroupAt: now,
      gridModeDocV2: nextWithFlags,
      // Grid runtime reads from the v2 mirror; compatibility projection refreshes
      // lazily at save/bootstrap/undo-redo boundaries.
      doc: state.doc
    };
  }

  const snapshot = cloneValue(baseV2);
  const nextPast = [...state.gridHistoryPast, snapshot].slice(-MAX_HISTORY);
  const nextWithFlags = withHistoryFlagsV2(nextGridModeDocV2, nextPast.length > 0, false);

  return {
    ...state,
    isDirty: true,
    canUndo: nextPast.length > 0,
    canRedo: false,
    gridHistoryPast: nextPast,
    gridHistoryFuture: [],
    gridHistoryGroupKey: groupKey ?? null,
    gridHistoryGroupAt: now,
    gridModeDocV2: nextWithFlags,
    doc: state.doc
  };
};

export interface PosterEditorState {
  posterId: string | null;
  doc: PosterDoc | null;
  isDirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  gridHistoryPast: PosterDocV2[];
  gridHistoryFuture: PosterDocV2[];
  gridHistoryGroupKey: string | null;
  gridHistoryGroupAt: number;
  gridModeDocV2: PosterDocV2 | null;
  gridPreviewSelectedRegionId: string | null;
  initializePoster: (payload: InitializePosterPayload) => void;
  resetPoster: () => void;
  setDoc: (doc: PosterDocAny) => void;
  setMetaTitle: (title: string) => void;
  setTypographyTheme: (theme: TypographyTheme) => void;
  setColorTheme: (theme: ColorTheme) => void;
  setOrientation: (orientation: PosterOrientation) => void;
  setSizePreset: (size: PosterSizePreset) => void;
  toggleFooterVisible: () => void;
  toggleHeaderSubtitleVisible: () => void;
  setHeaderContent: (content: TipTapJsonContent) => void;
  setHeaderSubtitleContent: (content: TipTapJsonContent) => void;
  setFooterContent: (content: TipTapJsonContent) => void;
  setBlockContent: (blockId: string, content: TipTapJsonContent) => void;
  setFloatingBlockPosition: (blockId: string, x: number, y: number) => void;
  addFloatingParagraph: () => void;
  removeFloatingParagraph: (blockId: string) => void;
  initializeGridPreviewRegions: (regions: PosterMainRegion[]) => void;
  selectGridPreviewRegion: (regionId: string | null) => void;
  updateGridPreviewRegionRect: (
    regionId: string,
    rect: Pick<PosterMainRegion, "x" | "y" | "w" | "h">,
    grid: { cols: number; rows: number }
  ) => boolean;
  splitGridPreviewRegionHorizontal: (regionId: string) => boolean;
  splitGridPreviewRegionVertical: (regionId: string) => boolean;
  moveGridPreviewRegionBy: (regionId: string, dx: number, dy: number) => boolean;
  deleteGridPreviewRegion: (regionId: string) => boolean;
  mergeGridPreviewRegionWithLeft: (regionId: string) => boolean;
  mergeGridPreviewRegionWithRight: (regionId: string) => boolean;
  createGridPreviewRegion: (rect: Pick<PosterMainRegion, "x" | "y" | "w" | "h">) => boolean;
  undo: () => void;
  redo: () => void;
  markSaved: () => void;
}

export const usePosterEditorStore = create<PosterEditorState>((set) => ({
  posterId: null,
  doc: null,
  isDirty: false,
  canUndo: false,
  canRedo: false,
  gridHistoryPast: [],
  gridHistoryFuture: [],
  gridHistoryGroupKey: null,
  gridHistoryGroupAt: 0,
  gridModeDocV2: null,
  gridPreviewSelectedRegionId: null,

  initializePoster: ({ posterId, doc }) => {
    // Validate migrator at the store boundary while the v1 editor UI is still active.
    // Once the grid editor lands, this boundary becomes the single switch to store v2 docs.
    const latestDoc = migratePosterDocToLatest(cloneValue(doc));
    const normalizedDoc = prepareIncomingDocForCurrentEditor(doc);
    set({
      posterId,
      doc: withHistoryFlags(normalizedDoc, false, false),
      isDirty: false,
      canUndo: false,
      canRedo: false,
      gridHistoryPast: [],
      gridHistoryFuture: [],
      gridHistoryGroupKey: null,
      gridHistoryGroupAt: 0,
      gridModeDocV2: latestDoc,
      gridPreviewSelectedRegionId: null
    });
  },

  resetPoster: () => {
    set({
      posterId: null,
      doc: null,
      isDirty: false,
      canUndo: false,
      canRedo: false,
      gridHistoryPast: [],
      gridHistoryFuture: [],
      gridHistoryGroupKey: null,
      gridHistoryGroupAt: 0,
      gridModeDocV2: null,
      gridPreviewSelectedRegionId: null
    });
  },

  setDoc: (doc) => {
    set((state) => {
      if (!state.doc) {
        return state;
      }

      const latestDoc = migratePosterDocToLatest(cloneValue(doc));
      const normalizedDoc = prepareIncomingDocForCurrentEditor(doc);
      return {
        ...state,
        doc: withHistoryFlags(cloneDoc(normalizedDoc), false, false),
        isDirty: false,
        canUndo: false,
        canRedo: false,
        gridHistoryPast: [],
        gridHistoryFuture: [],
        gridHistoryGroupKey: null,
        gridHistoryGroupAt: 0,
        gridModeDocV2: latestDoc
      };
    });
  },

  setMetaTitle: (title) => {
    set((state) => {
      if (!state.doc) {
        return state;
      }
      return commitGridModeMirrorMutation(state, (v2Doc) => ({
        ...v2Doc,
        meta: {
          ...v2Doc.meta,
          title
        }
      }));
    });
  },

  setTypographyTheme: (theme) => {
    set((state) => {
      if (!state.doc) {
        return state;
      }
      return commitGridModeMirrorMutation(state, (v2Doc) => ({
        ...v2Doc,
        meta: {
          ...v2Doc.meta,
          typographyTheme: theme
        }
      }));
    });
  },

  setColorTheme: (theme) => {
    set((state) => {
      if (!state.doc) {
        return state;
      }
      return commitGridModeMirrorMutation(state, (v2Doc) => ({
        ...v2Doc,
        meta: {
          ...v2Doc.meta,
          colorTheme: theme
        }
      }));
    });
  },

  setOrientation: (orientation) => {
    set((state) => {
      if (!state.doc) {
        return state;
      }
      return commitGridModeMirrorMutation(state, (v2Doc) => ({
        ...v2Doc,
        meta: {
          ...v2Doc.meta,
          orientation
        }
      }));
    });
  },

  setSizePreset: (size) => {
    set((state) => {
      if (!state.doc) {
        return state;
      }
      return commitGridModeMirrorMutation(state, (v2Doc) => ({
        ...v2Doc,
        meta: {
          ...v2Doc.meta,
          sizePreset: size
        }
      }));
    });
  },

  toggleFooterVisible: () => {
    set((state) => {
      if (!state.doc) {
        return state;
      }
      return commitGridModeMirrorMutation(state, (v2Doc) => ({
        ...v2Doc,
        meta: {
          ...v2Doc.meta,
          footerVisible: !v2Doc.meta.footerVisible
        }
      }));
    });
  },

  toggleHeaderSubtitleVisible: () => {
    set((state) => {
      if (!state.doc) {
        return state;
      }
      return commitGridModeMirrorMutation(state, (v2Doc) => ({
        ...v2Doc,
        meta: {
          ...v2Doc.meta,
          headerSubtitleVisible: !(v2Doc.meta.headerSubtitleVisible ?? true)
        }
      }));
    });
  },

  setHeaderContent: (content) => {
    set((state) => {
      if (!state.doc) {
        return state;
      }

      return commitGridModeMirrorMutation(
        state,
        (v2Doc) => ({
          ...v2Doc,
          sections: {
            ...v2Doc.sections,
            header: {
              ...v2Doc.sections.header,
              content
            }
          }
        }),
        { groupKey: "header-content", groupWindowMs: 1200 }
      );
    });
  },

  setHeaderSubtitleContent: (content) => {
    set((state) => {
      if (!state.doc) {
        return state;
      }

      return commitGridModeMirrorMutation(
        state,
        (v2Doc) => ({
          ...v2Doc,
          sections: {
            ...v2Doc.sections,
            headerSubtitle: {
              content
            }
          }
        }),
        { groupKey: "header-subtitle-content", groupWindowMs: 1200 }
      );
    });
  },

  setFooterContent: (content) => {
    set((state) => {
      if (!state.doc) {
        return state;
      }

      return commitGridModeMirrorMutation(
        state,
        (v2Doc) => ({
          ...v2Doc,
          sections: {
            ...v2Doc.sections,
            footer: {
              ...v2Doc.sections.footer,
              content
            }
          }
        }),
        { groupKey: "footer-content", groupWindowMs: 1200 }
      );
    });
  },

  setBlockContent: (blockId, content) => {
    set((state) => {
      if (!state.doc) {
        return state;
      }

      const block = state.doc.blocks[blockId];
      if (!block || !isTextualBlock(block)) {
        return state;
      }

      const normalizedContent =
        (block.type === "text" || block.type === "floatingParagraph") && block.content
          ? reconcileMissingTipTapImageAttrs(block.content, content)
          : content;
      const safeContent = structuredClone(normalizedContent);

      return commitGridModeMirrorMutation(
        state,
        (v2Doc) => {
          const targetBlock = v2Doc.blocks[blockId];
          if (!targetBlock || !isTextualBlock(targetBlock)) {
            return v2Doc;
          }

          return {
            ...v2Doc,
            blocks: {
              ...v2Doc.blocks,
              [blockId]: {
                ...targetBlock,
                content: safeContent
              }
            }
          };
        },
        { groupKey: `block-content:${blockId}`, groupWindowMs: 1200 }
      );
    });
  },

  setFloatingBlockPosition: (blockId, x, y) => {
    set((state) => {
      if (!state.doc) {
        return state;
      }

      const block = state.doc.blocks[blockId];
      if (!block || block.type !== "floatingParagraph") {
        return state;
      }

      return commitGridModeMirrorMutation(
        state,
        (v2Doc) => {
          const v2Block = v2Doc.blocks[blockId];
          if (!v2Block || v2Block.type !== "floatingParagraph") {
            return v2Doc;
          }

          return {
            ...v2Doc,
            blocks: {
              ...v2Doc.blocks,
              [blockId]: {
                ...v2Block,
                position: { x, y }
              }
            }
          };
        },
        { groupKey: `floating-position:${blockId}`, groupWindowMs: 250 }
      );
    });
  },

  addFloatingParagraph: () => {
    set((state) => {
      if (!state.doc) {
        return state;
      }

      const floatingCount = Object.values(state.doc.blocks).filter((block) => block.type === "floatingParagraph").length;
      const blockId = createId("floating");

      return commitGridModeMirrorMutation(state, (v2Doc) => ({
        ...v2Doc,
        blocks: {
          ...v2Doc.blocks,
          [blockId]: {
            id: blockId,
            type: "floatingParagraph",
            position: {
              x: 24 + floatingCount * 18,
              y: 24 + floatingCount * 18
            },
            content: createDefaultTextContent()
          }
        }
      }));
    });
  },

  removeFloatingParagraph: (blockId) => {
    set((state) => {
      if (!state.doc) {
        return state;
      }

      const block = state.doc.blocks[blockId];
      if (!block || block.type !== "floatingParagraph") {
        return state;
      }

      return commitGridModeMirrorMutation(state, (v2Doc) => {
        const v2Block = v2Doc.blocks[blockId];
        if (!v2Block || v2Block.type !== "floatingParagraph") {
          return v2Doc;
        }

        const nextV2Blocks = { ...v2Doc.blocks };
        delete nextV2Blocks[blockId];

        return {
          ...v2Doc,
          blocks: nextV2Blocks
        };
      });
    });
  },

  initializeGridPreviewRegions: (regions) => {
    set((state) => {
      const nextRegions = structuredClone(regions);
      const currentSourceRegions = getGridRegionsSource(state);
      const selectedRegionId =
        state.gridPreviewSelectedRegionId && nextRegions.some((region) => region.id === state.gridPreviewSelectedRegionId)
          ? state.gridPreviewSelectedRegionId
          : (nextRegions[0]?.id ?? null);

      if (state.gridModeDocV2) {
        const mirrorRegions = state.gridModeDocV2.sections.main.regions;
        const mirrorSelectedRegionId =
          state.gridPreviewSelectedRegionId && mirrorRegions.some((region) => region.id === state.gridPreviewSelectedRegionId)
            ? state.gridPreviewSelectedRegionId
            : (mirrorRegions[0]?.id ?? null);

        if (state.gridPreviewSelectedRegionId === mirrorSelectedRegionId) {
          return state;
        }

        return {
          ...state,
          gridPreviewSelectedRegionId: mirrorSelectedRegionId
        };
      }

      if (sameRegionLayout(currentSourceRegions, nextRegions) && state.gridPreviewSelectedRegionId === selectedRegionId) {
        return state;
      }

      const nextGridModeDocV2 = bootstrapGridModeDocV2FromRegions(state, nextRegions);

      return {
        ...state,
        gridModeDocV2: nextGridModeDocV2,
        // Bootstrap/migration fallback: seed the compatibility projection once
        // when the canonical grid mirror is created from incoming regions.
        doc: deriveCompatibilityDocFromGridMode(state, nextGridModeDocV2),
        gridPreviewSelectedRegionId: selectedRegionId
      };
    });
  },

  selectGridPreviewRegion: (regionId) => {
    set((state) => ({
      ...state,
      gridPreviewSelectedRegionId: regionId
    }));
  },

  updateGridPreviewRegionRect: (regionId, rect, grid) => {
    let updated = false;

    set((state) => {
      const sourceRegions = getGridRegionsSource(state);
      const target = sourceRegions.find((region) => region.id === regionId);
      if (!target) {
        return state;
      }

      const clamped = clampPreviewRegionRect(rect, grid);
      if (
        target.x === clamped.x &&
        target.y === clamped.y &&
        target.w === clamped.w &&
        target.h === clamped.h
      ) {
        return state;
      }

      const candidate: PosterMainRegion = {
        ...target,
        ...clamped
      };

      if (sourceRegions.some((region) => regionsOverlap(candidate, region))) {
        return state;
      }

      updated = true;
      const nextRegions = sourceRegions.map((region) => (region.id === regionId ? candidate : region));
      const nextGridModeDocV2 = syncGridModeDocV2Regions(state, nextRegions);
      return {
        ...state,
        isDirty: true,
        gridModeDocV2: nextGridModeDocV2,
        // Grid resize can fire continuously while dragging; avoid rebuilding the
        // v1 compatibility projection on every pointer move.
        doc: state.doc
      };
    });

    return updated;
  },

  splitGridPreviewRegionHorizontal: (regionId) => {
    let changed = false;

    set((state) => {
      const sourceRegions = getGridRegionsSource(state);
      const region = sourceRegions.find((item) => item.id === regionId);
      if (!region || region.h < 2) {
        return state;
      }

      const topH = Math.max(1, Math.floor(region.h / 2));
      const bottomH = region.h - topH;
      if (bottomH < 1) {
        return state;
      }

      const topRegion: PosterMainRegion = {
        ...region,
        h: topH
      };
      const bottomRegion: PosterMainRegion = {
        ...region,
        id: createId("v2r"),
        y: region.y + topH,
        h: bottomH
      };

      changed = true;
      const nextRegions = sourceRegions.flatMap((item) =>
        item.id === regionId ? [topRegion, bottomRegion] : [item]
      );
      const nextGridModeDocV2 = syncGridModeDocV2Regions(state, nextRegions);
      return {
        ...state,
        isDirty: true,
        gridModeDocV2: nextGridModeDocV2,
        doc: state.doc,
        gridPreviewSelectedRegionId: topRegion.id
      };
    });

    return changed;
  },

  splitGridPreviewRegionVertical: (regionId) => {
    let changed = false;

    set((state) => {
      const sourceRegions = getGridRegionsSource(state);
      const region = sourceRegions.find((item) => item.id === regionId);
      if (!region || region.w < 2) {
        return state;
      }

      const leftW = Math.max(1, Math.floor(region.w / 2));
      const rightW = region.w - leftW;
      if (rightW < 1) {
        return state;
      }

      const leftRegion: PosterMainRegion = {
        ...region,
        w: leftW
      };
      const rightRegion: PosterMainRegion = {
        ...region,
        id: createId("v2r"),
        x: region.x + leftW,
        w: rightW
      };

      changed = true;
      const nextRegions = sourceRegions.flatMap((item) =>
        item.id === regionId ? [leftRegion, rightRegion] : [item]
      );
      const nextGridModeDocV2 = syncGridModeDocV2Regions(state, nextRegions);
      return {
        ...state,
        isDirty: true,
        gridModeDocV2: nextGridModeDocV2,
        doc: state.doc,
        gridPreviewSelectedRegionId: leftRegion.id
      };
    });

    return changed;
  },

  moveGridPreviewRegionBy: (regionId, dx, dy) => {
    let changed = false;

    set((state) => {
      const sourceRegions = getGridRegionsSource(state);
      const region = sourceRegions.find((item) => item.id === regionId);
      if (!region) {
        return state;
      }

      const nextRect = clampPreviewRegionRect(
        {
          x: region.x + dx,
          y: region.y + dy,
          w: region.w,
          h: region.h
        },
        { cols: 24, rows: 12 }
      );

      if (nextRect.x === region.x && nextRect.y === region.y && nextRect.w === region.w && nextRect.h === region.h) {
        return state;
      }

      const candidate: PosterMainRegion = { ...region, ...nextRect };
      if (sourceRegions.some((item) => regionsOverlap(candidate, item))) {
        return state;
      }

      const nextRegions = sourceRegions.map((item) => (item.id === regionId ? candidate : item));
      changed = true;
      const nextGridModeDocV2 = syncGridModeDocV2Regions(state, nextRegions);
      return {
        ...state,
        isDirty: true,
        gridModeDocV2: nextGridModeDocV2,
        // Grid move can fire continuously while dragging; keep compatibility doc
        // stale until a discrete action/save path needs it.
        doc: state.doc,
        gridPreviewSelectedRegionId: regionId
      };
    });

    return changed;
  },

  deleteGridPreviewRegion: (regionId) => {
    let changed = false;

    set((state) => {
      const sourceRegions = getGridRegionsSource(state);
      const region = sourceRegions.find((item) => item.id === regionId);
      if (!region || sourceRegions.length <= 1) {
        return state;
      }

      const nextRegions = sourceRegions.filter((item) => item.id !== regionId);
      const nextSelected = nextRegions[0]?.id ?? null;
      changed = true;
      const nextGridModeDocV2 = syncGridModeDocV2Regions(state, nextRegions);

      return {
        ...state,
        isDirty: true,
        gridModeDocV2: nextGridModeDocV2,
        doc: state.doc,
        gridPreviewSelectedRegionId: nextSelected
      };
    });

    return changed;
  },

  mergeGridPreviewRegionWithLeft: (regionId) => {
    let changed = false;

    set((state) => {
      const sourceRegions = getGridRegionsSource(state);
      const region = sourceRegions.find((item) => item.id === regionId);
      if (!region) {
        return state;
      }

      const leftNeighbor = sourceRegions.find(
        (item) => item.id !== region.id && item.x + item.w === region.x && item.y === region.y && item.h === region.h
      );
      if (!leftNeighbor) {
        return state;
      }

      const merged: PosterMainRegion = {
        ...leftNeighbor,
        w: leftNeighbor.w + region.w
      };
      const nextRegions = sourceRegions
        .filter((item) => item.id !== region.id)
        .map((item) => (item.id === leftNeighbor.id ? merged : item));

      changed = true;
      const nextGridModeDocV2 = syncGridModeDocV2Regions(state, nextRegions);
      return {
        ...state,
        isDirty: true,
        gridModeDocV2: nextGridModeDocV2,
        doc: state.doc,
        gridPreviewSelectedRegionId: merged.id
      };
    });

    return changed;
  },

  mergeGridPreviewRegionWithRight: (regionId) => {
    let changed = false;

    set((state) => {
      const sourceRegions = getGridRegionsSource(state);
      const region = sourceRegions.find((item) => item.id === regionId);
      if (!region) {
        return state;
      }

      const rightNeighbor = sourceRegions.find(
        (item) => item.id !== region.id && item.x === region.x + region.w && item.y === region.y && item.h === region.h
      );
      if (!rightNeighbor) {
        return state;
      }

      const merged: PosterMainRegion = {
        ...region,
        w: region.w + rightNeighbor.w
      };
      const nextRegions = sourceRegions.filter((item) => item.id !== rightNeighbor.id).map((item) => {
        if (item.id !== region.id) {
          return item;
        }

        return merged;
      });

      changed = true;
      const nextGridModeDocV2 = syncGridModeDocV2Regions(state, nextRegions);
      return {
        ...state,
        isDirty: true,
        gridModeDocV2: nextGridModeDocV2,
        doc: state.doc,
        gridPreviewSelectedRegionId: merged.id
      };
    });

    return changed;
  },

  createGridPreviewRegion: (rect) => {
    let changed = false;

    set((state) => {
      if (!state.doc) {
        return state;
      }

      const sourceRegions = getGridRegionsSource(state);
      const clamped = clampPreviewRegionRect(rect, { cols: 24, rows: 12 });
      if (clamped.w < 1 || clamped.h < 1) {
        return state;
      }

      const regionId = createId("v2r");
      const blockId = createId("block");
      const candidate: PosterMainRegion = {
        id: regionId,
        kind: "content",
        x: clamped.x,
        y: clamped.y,
        w: clamped.w,
        h: clamped.h,
        blockId
      };

      if (sourceRegions.some((region) => regionsOverlap(candidate, region))) {
        return state;
      }

      const nextState = commitGridModeMirrorMutation(state, (v2Doc) => ({
        ...v2Doc,
        sections: {
          ...v2Doc.sections,
          main: {
            ...v2Doc.sections.main,
            regions: [...v2Doc.sections.main.regions, candidate]
          }
        },
        blocks: {
          ...v2Doc.blocks,
          [blockId]: {
            id: blockId,
            type: "text",
            content: createDefaultTextContent()
          }
        }
      }));

      changed = true;
      return {
        ...nextState,
        gridPreviewSelectedRegionId: regionId
      };
    });

    return changed;
  },

  undo: () => {
    set((state) => {
      if (!state.gridModeDocV2 || state.gridHistoryPast.length === 0) {
        return state;
      }

      const previous = state.gridHistoryPast[state.gridHistoryPast.length - 1];
      const nextPast = state.gridHistoryPast.slice(0, -1);
      const currentSnapshot = cloneValue(state.gridModeDocV2);
      const nextFuture = [currentSnapshot, ...state.gridHistoryFuture].slice(0, MAX_HISTORY);
      const previousWithFlags = withHistoryFlagsV2(cloneValue(previous), nextPast.length > 0, nextFuture.length > 0);
      const nextCompatibilityDoc = deriveCompatibilityDocFromGridMode(state, previousWithFlags) ?? state.doc;

      return {
        ...state,
        isDirty: true,
        canUndo: nextPast.length > 0,
        canRedo: nextFuture.length > 0,
        gridHistoryPast: nextPast,
        gridHistoryFuture: nextFuture,
        gridHistoryGroupKey: null,
        gridHistoryGroupAt: 0,
        gridModeDocV2: previousWithFlags,
        doc: nextCompatibilityDoc
      };
    });
  },

  redo: () => {
    set((state) => {
      if (!state.gridModeDocV2 || state.gridHistoryFuture.length === 0) {
        return state;
      }

      const [next, ...remainingFuture] = state.gridHistoryFuture;
      const current = state.gridModeDocV2;
      const nextPast = [...state.gridHistoryPast, cloneValue(current)].slice(-MAX_HISTORY);
      const nextWithFlags = withHistoryFlagsV2(cloneValue(next), nextPast.length > 0, remainingFuture.length > 0);
      const nextCompatibilityDoc = deriveCompatibilityDocFromGridMode(state, nextWithFlags) ?? state.doc;

      return {
        ...state,
        isDirty: true,
        canUndo: nextPast.length > 0,
        canRedo: remainingFuture.length > 0,
        gridHistoryPast: nextPast,
        gridHistoryFuture: remainingFuture,
        gridHistoryGroupKey: null,
        gridHistoryGroupAt: 0,
        gridModeDocV2: nextWithFlags,
        doc: nextCompatibilityDoc
      };
    });
  },

  markSaved: () => {
    set((state) => ({
      ...state,
      isDirty: false
    }));
  }
}));
