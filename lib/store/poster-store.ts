import { create } from "zustand";

import type {
  ColorTheme,
  PosterBlock,
  PosterColumnSegment,
  PosterDoc,
  PosterMainLayout,
  PosterOrientation,
  PosterSizePreset,
  TipTapJsonContent,
  TypographyTheme
} from "@/lib/poster/types";

interface InitializePosterPayload {
  posterId: string;
  doc: PosterDoc;
}

interface CommitOptions {
  groupKey?: string;
  groupWindowMs?: number;
}

const cloneDoc = (doc: PosterDoc): PosterDoc => structuredClone(doc);
const MIN_COLUMNS = 1;
const MAX_COLUMNS = 5;
const MAX_SEGMENTS_PER_COLUMN = 5;
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

const normalizeColumnWidths = (layout: PosterMainLayout): PosterMainLayout => {
  const count = layout.columnIds.length;
  if (count === 0) {
    return layout;
  }

  const ratio = 1 / count;
  const columns = { ...layout.columns };

  layout.columnIds.forEach((columnId) => {
    const column = columns[columnId];
    if (!column) {
      return;
    }

    columns[columnId] = {
      ...column,
      widthRatio: ratio
    };
  });

  return {
    ...layout,
    columns
  };
};

const ensureColumnHasSegment = (segments: PosterColumnSegment[]): PosterColumnSegment[] => {
  if (segments.length > 0) {
    return segments;
  }

  return [
    {
      id: createId("seg"),
      blockIds: [],
      heightRatio: 1
    }
  ];
};

const normalizeSegmentHeights = (segments: PosterColumnSegment[]): PosterColumnSegment[] => {
  if (segments.length === 0) {
    return segments;
  }

  const fallbackRatio = 1 / segments.length;
  const rawRatios = segments.map((segment) =>
    typeof segment.heightRatio === "number" && Number.isFinite(segment.heightRatio) && segment.heightRatio > 0
      ? segment.heightRatio
      : fallbackRatio
  );
  const total = rawRatios.reduce((acc, ratio) => acc + ratio, 0);

  return segments.map((segment, index) => ({
    ...segment,
    heightRatio: rawRatios[index] / total
  }));
};

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
    sections: nextSections
  };
};

export interface PosterEditorState {
  posterId: string | null;
  doc: PosterDoc | null;
  isDirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  historyPast: PosterDoc[];
  historyFuture: PosterDoc[];
  historyGroupKey: string | null;
  historyGroupAt: number;
  initializePoster: (payload: InitializePosterPayload) => void;
  resetPoster: () => void;
  setDoc: (doc: PosterDoc) => void;
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
  addColumn: () => void;
  removeColumn: (columnId: string) => void;
  setAdjacentColumnRatios: (leftColumnId: string, rightColumnId: string, leftRatio: number, rightRatio: number) => void;
  setColumnLayoutRatios: (columnIds: string[], sizes: number[]) => void;
  setAdjacentSegmentRatios: (
    columnId: string,
    topSegmentId: string,
    bottomSegmentId: string,
    topRatio: number,
    bottomRatio: number
  ) => void;
  setColumnSegmentLayoutRatios: (columnId: string, segmentIds: string[], sizes: number[]) => void;
  addSegment: (columnId: string) => void;
  removeSegment: (columnId: string, segmentId: string) => void;
  addImageBlockToSegment: (columnId: string, segmentId: string, assetId: string, src: string, alt: string) => void;
  ensureColumnHasTextBlock: (columnId: string) => void;
  undo: () => void;
  redo: () => void;
  markSaved: () => void;
}

const commitMutation = (state: PosterEditorState, nextDoc: PosterDoc, options?: CommitOptions): PosterEditorState => {
  const groupKey = options?.groupKey;
  const groupWindowMs = options?.groupWindowMs ?? 1200;
  const now = Date.now();
  const shouldGroup =
    Boolean(groupKey) &&
    state.historyGroupKey === groupKey &&
    now - state.historyGroupAt <= groupWindowMs;

  if (shouldGroup) {
    const nextHistoryDoc = withHistoryFlags(nextDoc, state.historyPast.length > 0, false);

    return {
      ...state,
      isDirty: true,
      canUndo: state.historyPast.length > 0,
      canRedo: false,
      historyFuture: [],
      historyGroupKey: groupKey ?? null,
      historyGroupAt: now,
      doc: nextHistoryDoc
    };
  }

  const snapshot = cloneDoc(state.doc as PosterDoc);
  const nextPast = [...state.historyPast, snapshot].slice(-MAX_HISTORY);
  const nextHistoryDoc = withHistoryFlags(nextDoc, nextPast.length > 0, false);

  return {
    ...state,
    isDirty: true,
    canUndo: nextPast.length > 0,
    canRedo: false,
    historyPast: nextPast,
    historyFuture: [],
    historyGroupKey: groupKey ?? null,
    historyGroupAt: now,
    doc: nextHistoryDoc
  };
};

export const usePosterEditorStore = create<PosterEditorState>((set) => ({
  posterId: null,
  doc: null,
  isDirty: false,
  canUndo: false,
  canRedo: false,
  historyPast: [],
  historyFuture: [],
  historyGroupKey: null,
  historyGroupAt: 0,

  initializePoster: ({ posterId, doc }) => {
    const normalizedDoc = normalizePosterDoc(cloneDoc(doc));
    set({
      posterId,
      doc: withHistoryFlags(normalizedDoc, false, false),
      isDirty: false,
      canUndo: false,
      canRedo: false,
      historyPast: [],
      historyFuture: [],
      historyGroupKey: null,
      historyGroupAt: 0
    });
  },

  resetPoster: () => {
    set({
      posterId: null,
      doc: null,
      isDirty: false,
      canUndo: false,
      canRedo: false,
      historyPast: [],
      historyFuture: [],
      historyGroupKey: null,
      historyGroupAt: 0
    });
  },

  setDoc: (doc) => {
    set((state) => {
      if (!state.doc) {
        return state;
      }

      return commitMutation(state, cloneDoc(doc));
    });
  },

  setMetaTitle: (title) => {
    set((state) => {
      if (!state.doc) {
        return state;
      }

      return commitMutation(state, {
        ...state.doc,
        meta: {
          ...state.doc.meta,
          title
        }
      });
    });
  },

  setTypographyTheme: (theme) => {
    set((state) => {
      if (!state.doc) {
        return state;
      }

      return commitMutation(state, {
        ...state.doc,
        meta: {
          ...state.doc.meta,
          typographyTheme: theme
        }
      });
    });
  },

  setColorTheme: (theme) => {
    set((state) => {
      if (!state.doc) {
        return state;
      }

      return commitMutation(state, {
        ...state.doc,
        meta: {
          ...state.doc.meta,
          colorTheme: theme
        }
      });
    });
  },

  setOrientation: (orientation) => {
    set((state) => {
      if (!state.doc) {
        return state;
      }

      return commitMutation(state, {
        ...state.doc,
        meta: {
          ...state.doc.meta,
          orientation
        }
      });
    });
  },

  setSizePreset: (size) => {
    set((state) => {
      if (!state.doc) {
        return state;
      }

      return commitMutation(state, {
        ...state.doc,
        meta: {
          ...state.doc.meta,
          sizePreset: size
        }
      });
    });
  },

  toggleFooterVisible: () => {
    set((state) => {
      if (!state.doc) {
        return state;
      }

      return commitMutation(state, {
        ...state.doc,
        meta: {
          ...state.doc.meta,
          footerVisible: !state.doc.meta.footerVisible
        }
      });
    });
  },

  toggleHeaderSubtitleVisible: () => {
    set((state) => {
      if (!state.doc) {
        return state;
      }

      return commitMutation(state, {
        ...state.doc,
        meta: {
          ...state.doc.meta,
          headerSubtitleVisible: !(state.doc.meta.headerSubtitleVisible ?? true)
        }
      });
    });
  },

  setHeaderContent: (content) => {
    set((state) => {
      if (!state.doc) {
        return state;
      }

      return commitMutation(
        state,
        {
        ...state.doc,
        sections: {
          ...state.doc.sections,
          header: {
            ...state.doc.sections.header,
            content
          }
        }
      },
        { groupKey: "header-content", groupWindowMs: 1200 }
      );
    });
  },

  setHeaderSubtitleContent: (content) => {
    set((state) => {
      if (!state.doc) {
        return state;
      }

      return commitMutation(
        state,
        {
          ...state.doc,
          sections: {
            ...state.doc.sections,
            headerSubtitle: {
              content
            }
          }
        },
        { groupKey: "header-subtitle-content", groupWindowMs: 1200 }
      );
    });
  },

  setFooterContent: (content) => {
    set((state) => {
      if (!state.doc) {
        return state;
      }

      return commitMutation(
        state,
        {
        ...state.doc,
        sections: {
          ...state.doc.sections,
          footer: {
            ...state.doc.sections.footer,
            content
          }
        }
      },
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

      return commitMutation(
        state,
        {
        ...state.doc,
        blocks: {
          ...state.doc.blocks,
          [blockId]: {
            ...block,
            content: safeContent
          }
        }
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

      return commitMutation(
        state,
        {
        ...state.doc,
        blocks: {
          ...state.doc.blocks,
          [blockId]: {
            ...block,
            position: { x, y }
          }
        }
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

      return commitMutation(state, {
        ...state.doc,
        blocks: {
          ...state.doc.blocks,
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
      });
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

      const nextBlocks = { ...state.doc.blocks };
      delete nextBlocks[blockId];

      return commitMutation(state, {
        ...state.doc,
        blocks: nextBlocks
      });
    });
  },

  addColumn: () => {
    set((state) => {
      if (!state.doc) {
        return state;
      }

      const currentIds = state.doc.sections.main.columnIds;
      if (currentIds.length >= MAX_COLUMNS) {
        return state;
      }

      const columnId = createId("col");
      const topSegmentId = createId("seg");
      const bottomSegmentId = createId("seg");
      const topBlockId = createId("block");
      const bottomBlockId = createId("block");

      const nextLayout = normalizeColumnWidths({
        columnIds: [...currentIds, columnId],
        columns: {
          ...state.doc.sections.main.columns,
          [columnId]: {
            id: columnId,
            widthRatio: 0,
            segments: [
              {
                id: topSegmentId,
                blockIds: [topBlockId],
                heightRatio: 0.5
              },
              {
                id: bottomSegmentId,
                blockIds: [bottomBlockId],
                heightRatio: 0.5
              }
            ]
          }
        }
      });

      return commitMutation(state, {
        ...state.doc,
        sections: {
          ...state.doc.sections,
          main: nextLayout
        },
        blocks: {
          ...state.doc.blocks,
          [topBlockId]: {
            id: topBlockId,
            type: "text",
            content: createDefaultTextContent("New Section")
          },
          [bottomBlockId]: {
            id: bottomBlockId,
            type: "text",
            content: createDefaultTextContent()
          }
        }
      });
    });
  },

  removeColumn: (columnId) => {
    set((state) => {
      if (!state.doc) {
        return state;
      }

      const currentIds = state.doc.sections.main.columnIds;
      if (currentIds.length <= MIN_COLUMNS || !currentIds.includes(columnId)) {
        return state;
      }

      const removedIndex = currentIds.indexOf(columnId);
      const targetColumnId = currentIds[removedIndex - 1] ?? currentIds[removedIndex + 1];
      if (!targetColumnId) {
        return state;
      }

      const removedColumn = state.doc.sections.main.columns[columnId];
      const targetColumn = state.doc.sections.main.columns[targetColumnId];
      if (!removedColumn || !targetColumn) {
        return state;
      }

      const incomingBlockIds = removedColumn.segments.flatMap((segment) => segment.blockIds);
      const targetSegments = ensureColumnHasSegment([...targetColumn.segments]);
      targetSegments[0] = {
        ...targetSegments[0],
        blockIds: [...targetSegments[0].blockIds, ...incomingBlockIds]
      };

      const remainingIds = currentIds.filter((id) => id !== columnId);
      const remainingColumns = { ...state.doc.sections.main.columns };
      delete remainingColumns[columnId];
      remainingColumns[targetColumnId] = {
        ...targetColumn,
        segments: targetSegments
      };

      const nextLayout = normalizeColumnWidths({
        columnIds: remainingIds,
        columns: remainingColumns
      });

      return commitMutation(state, {
        ...state.doc,
        sections: {
          ...state.doc.sections,
          main: nextLayout
        }
      });
    });
  },

  setAdjacentColumnRatios: (leftColumnId, rightColumnId, leftRatio, rightRatio) => {
    set((state) => {
      if (!state.doc) {
        return state;
      }

      const leftColumn = state.doc.sections.main.columns[leftColumnId];
      const rightColumn = state.doc.sections.main.columns[rightColumnId];
      if (!leftColumn || !rightColumn) {
        return state;
      }

      if (leftRatio <= 0 || rightRatio <= 0) {
        return state;
      }

      return commitMutation(state, {
        ...state.doc,
        sections: {
          ...state.doc.sections,
          main: {
            ...state.doc.sections.main,
            columns: {
              ...state.doc.sections.main.columns,
              [leftColumnId]: {
                ...leftColumn,
                widthRatio: leftRatio
              },
              [rightColumnId]: {
                ...rightColumn,
                widthRatio: rightRatio
              }
            }
          }
        }
      });
    });
  },

  setColumnLayoutRatios: (columnIds, sizes) => {
    set((state) => {
      if (!state.doc || columnIds.length === 0 || columnIds.length !== sizes.length) {
        return state;
      }

      const nextColumns = { ...state.doc.sections.main.columns };
      let changed = false;

      columnIds.forEach((columnId, index) => {
        const column = nextColumns[columnId];
        if (!column) {
          return;
        }

        const nextRatio = Math.max(0, sizes[index] / 100);
        if (Math.abs(column.widthRatio - nextRatio) < 0.0001) {
          return;
        }

        nextColumns[columnId] = {
          ...column,
          widthRatio: nextRatio
        };
        changed = true;
      });

      if (!changed) {
        return state;
      }

      return commitMutation(state, {
        ...state.doc,
        sections: {
          ...state.doc.sections,
          main: {
            ...state.doc.sections.main,
            columns: nextColumns
          }
        }
      });
    });
  },

  setAdjacentSegmentRatios: (columnId, topSegmentId, bottomSegmentId, topRatio, bottomRatio) => {
    set((state) => {
      if (!state.doc) {
        return state;
      }

      const column = state.doc.sections.main.columns[columnId];
      if (!column) {
        return state;
      }

      const topSegment = column.segments.find((segment) => segment.id === topSegmentId);
      const bottomSegment = column.segments.find((segment) => segment.id === bottomSegmentId);
      if (!topSegment || !bottomSegment) {
        return state;
      }

      if (topRatio <= 0 || bottomRatio <= 0) {
        return state;
      }

      const nextSegments = column.segments.map((segment) => {
        if (segment.id === topSegmentId) {
          return {
            ...segment,
            heightRatio: topRatio
          };
        }

        if (segment.id === bottomSegmentId) {
          return {
            ...segment,
            heightRatio: bottomRatio
          };
        }

        return segment;
      });

      return commitMutation(state, {
        ...state.doc,
        sections: {
          ...state.doc.sections,
          main: {
            ...state.doc.sections.main,
            columns: {
              ...state.doc.sections.main.columns,
              [columnId]: {
                ...column,
                segments: nextSegments
              }
            }
          }
        }
      });
    });
  },

  setColumnSegmentLayoutRatios: (columnId, segmentIds, sizes) => {
    set((state) => {
      if (!state.doc || segmentIds.length === 0 || segmentIds.length !== sizes.length) {
        return state;
      }

      const column = state.doc.sections.main.columns[columnId];
      if (!column) {
        return state;
      }

      let changed = false;
      const nextSegments = column.segments.map((segment) => {
        const index = segmentIds.indexOf(segment.id);
        if (index < 0) {
          return segment;
        }

        const nextRatio = Math.max(0, sizes[index] / 100);
        const prevRatio = segment.heightRatio ?? 0;
        if (Math.abs(prevRatio - nextRatio) < 0.0001) {
          return segment;
        }

        changed = true;
        return {
          ...segment,
          heightRatio: nextRatio
        };
      });

      if (!changed) {
        return state;
      }

      return commitMutation(state, {
        ...state.doc,
        sections: {
          ...state.doc.sections,
          main: {
            ...state.doc.sections.main,
            columns: {
              ...state.doc.sections.main.columns,
              [columnId]: {
                ...column,
                segments: nextSegments
              }
            }
          }
        }
      });
    });
  },

  addSegment: (columnId) => {
    set((state) => {
      if (!state.doc) {
        return state;
      }

      const column = state.doc.sections.main.columns[columnId];
      if (!column) {
        return state;
      }
      if (column.segments.length >= MAX_SEGMENTS_PER_COLUMN) {
        return state;
      }

      const segmentId = createId("seg");
      const blockId = createId("block");

      const updatedColumn = {
        ...column,
        segments: normalizeSegmentHeights([
          ...column.segments,
          {
            id: segmentId,
            blockIds: [blockId],
            heightRatio: 1
          }
        ])
      };

      return commitMutation(state, {
        ...state.doc,
        sections: {
          ...state.doc.sections,
          main: {
            ...state.doc.sections.main,
            columns: {
              ...state.doc.sections.main.columns,
              [columnId]: updatedColumn
            }
          }
        },
        blocks: {
          ...state.doc.blocks,
          [blockId]: {
            id: blockId,
            type: "text",
            content: createDefaultTextContent()
          }
        }
      });
    });
  },

  removeSegment: (columnId, segmentId) => {
    set((state) => {
      if (!state.doc) {
        return state;
      }

      const column = state.doc.sections.main.columns[columnId];
      if (!column || column.segments.length <= 1) {
        return state;
      }

      const segmentIndex = column.segments.findIndex((segment) => segment.id === segmentId);
      if (segmentIndex < 0) {
        return state;
      }

      const targetSegmentId =
        segmentIndex > 0 ? column.segments[segmentIndex - 1]?.id : column.segments[segmentIndex + 1]?.id;
      if (!targetSegmentId) {
        return state;
      }
      const removedSegment = column.segments[segmentIndex];

      const nextSegments = column.segments
        .filter((segment) => segment.id !== segmentId)
        .map((segment) => {
          if (segment.id !== targetSegmentId) {
            return segment;
          }

          return {
            ...segment,
            blockIds: [...segment.blockIds, ...removedSegment.blockIds]
          };
        });
      const normalizedSegments = normalizeSegmentHeights(nextSegments);

      return commitMutation(state, {
        ...state.doc,
        sections: {
          ...state.doc.sections,
          main: {
            ...state.doc.sections.main,
            columns: {
              ...state.doc.sections.main.columns,
              [columnId]: {
                ...column,
                segments: normalizedSegments
              }
            }
          }
        }
      });
    });
  },

  addImageBlockToSegment: (columnId, segmentId, assetId, src, alt) => {
    set((state) => {
      if (!state.doc) {
        return state;
      }

      const column = state.doc.sections.main.columns[columnId];
      if (!column) {
        return state;
      }

      const segment = column.segments.find((item) => item.id === segmentId);
      if (!segment) {
        return state;
      }

      const blockId = createId("img");

      const nextSegments = column.segments.map((item) => {
        if (item.id !== segmentId) {
          return item;
        }

        return {
          ...item,
          blockIds: [...item.blockIds, blockId]
        };
      });

      return commitMutation(state, {
        ...state.doc,
        sections: {
          ...state.doc.sections,
          main: {
            ...state.doc.sections.main,
            columns: {
              ...state.doc.sections.main.columns,
              [columnId]: {
                ...column,
                segments: nextSegments
              }
            }
          }
        },
        blocks: {
          ...state.doc.blocks,
          [blockId]: {
            id: blockId,
            type: "image",
            assetId,
            src,
            alt
          }
        }
      });
    });
  },

  ensureColumnHasTextBlock: (columnId) => {
    set((state) => {
      if (!state.doc) {
        return state;
      }

      const column = state.doc.sections.main.columns[columnId];
      if (!column) {
        return state;
      }
      let changed = false;
      let nextBlocks = { ...state.doc.blocks };
      let nextSegments = ensureColumnHasSegment([...column.segments]).map((segment) => ({ ...segment }));

      if (nextSegments.length > MAX_SEGMENTS_PER_COLUMN) {
        const kept = nextSegments.slice(0, MAX_SEGMENTS_PER_COLUMN);
        const overflowBlocks = nextSegments.slice(MAX_SEGMENTS_PER_COLUMN).flatMap((segment) => segment.blockIds);
        const lastKept = kept[kept.length - 1];

        nextSegments = kept.map((segment, index) => {
          if (!lastKept || index !== kept.length - 1) {
            return segment;
          }

          return {
            ...segment,
            blockIds: [...segment.blockIds, ...overflowBlocks]
          };
        });
        changed = true;
      }

      nextSegments = nextSegments.map((segment) => {
        const hasTextBlock = segment.blockIds.some((blockId) => nextBlocks[blockId]?.type === "text");
        if (hasTextBlock) {
          return segment;
        }

        const blockId = createId("block");
        nextBlocks = {
          ...nextBlocks,
          [blockId]: {
            id: blockId,
            type: "text",
            content: createDefaultTextContent()
          }
        };
        changed = true;

        return {
          ...segment,
          blockIds: [...segment.blockIds, blockId]
        };
      });

      const hasInvalidHeight = nextSegments.some(
        (segment) =>
          typeof segment.heightRatio !== "number" || !Number.isFinite(segment.heightRatio) || (segment.heightRatio ?? 0) <= 0
      );
      const totalHeight = nextSegments.reduce((acc, segment) => acc + (segment.heightRatio ?? 0), 0);
      if (hasInvalidHeight || Math.abs(totalHeight - 1) > 0.0001) {
        nextSegments = normalizeSegmentHeights(nextSegments);
        changed = true;
      }

      if (!changed) {
        return state;
      }

      return commitMutation(state, {
        ...state.doc,
        sections: {
          ...state.doc.sections,
          main: {
            ...state.doc.sections.main,
            columns: {
              ...state.doc.sections.main.columns,
              [columnId]: {
                ...column,
                segments: nextSegments
              }
            }
          }
        },
        blocks: nextBlocks
      });
    });
  },

  undo: () => {
    set((state) => {
      if (!state.doc || state.historyPast.length === 0) {
        return state;
      }

      const previous = state.historyPast[state.historyPast.length - 1];
      const nextPast = state.historyPast.slice(0, -1);
      const currentSnapshot = cloneDoc(state.doc);
      const nextFuture = [currentSnapshot, ...state.historyFuture].slice(0, MAX_HISTORY);

      return {
        ...state,
        isDirty: true,
        canUndo: nextPast.length > 0,
        canRedo: nextFuture.length > 0,
        historyPast: nextPast,
        historyFuture: nextFuture,
        historyGroupKey: null,
        historyGroupAt: 0,
        doc: withHistoryFlags(cloneDoc(previous), nextPast.length > 0, nextFuture.length > 0)
      };
    });
  },

  redo: () => {
    set((state) => {
      if (!state.doc || state.historyFuture.length === 0) {
        return state;
      }

      const [next, ...remainingFuture] = state.historyFuture;
      const nextPast = [...state.historyPast, cloneDoc(state.doc)].slice(-MAX_HISTORY);

      return {
        ...state,
        isDirty: true,
        canUndo: nextPast.length > 0,
        canRedo: remainingFuture.length > 0,
        historyPast: nextPast,
        historyFuture: remainingFuture,
        historyGroupKey: null,
        historyGroupAt: 0,
        doc: withHistoryFlags(cloneDoc(next), nextPast.length > 0, remainingFuture.length > 0)
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
