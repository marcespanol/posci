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

const cloneDoc = (doc: PosterDoc): PosterDoc => structuredClone(doc);
const MIN_COLUMNS = 1;
const MAX_COLUMNS = 5;
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
      blockIds: []
    }
  ];
};

export interface PosterEditorState {
  posterId: string | null;
  doc: PosterDoc | null;
  isDirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  historyPast: PosterDoc[];
  historyFuture: PosterDoc[];
  initializePoster: (payload: InitializePosterPayload) => void;
  resetPoster: () => void;
  setDoc: (doc: PosterDoc) => void;
  setMetaTitle: (title: string) => void;
  setTypographyTheme: (theme: TypographyTheme) => void;
  setColorTheme: (theme: ColorTheme) => void;
  setOrientation: (orientation: PosterOrientation) => void;
  setSizePreset: (size: PosterSizePreset) => void;
  toggleFooterVisible: () => void;
  setHeaderContent: (content: TipTapJsonContent) => void;
  setFooterContent: (content: TipTapJsonContent) => void;
  setBlockContent: (blockId: string, content: TipTapJsonContent) => void;
  setFloatingBlockPosition: (blockId: string, x: number, y: number) => void;
  addFloatingParagraph: () => void;
  addColumn: () => void;
  removeColumn: (columnId: string) => void;
  setAdjacentColumnRatios: (leftColumnId: string, rightColumnId: string, leftRatio: number, rightRatio: number) => void;
  addSegment: (columnId: string) => void;
  removeSegment: (columnId: string, segmentId: string) => void;
  addImageBlockToSegment: (columnId: string, segmentId: string, assetId: string, src: string, alt: string) => void;
  undo: () => void;
  redo: () => void;
  markSaved: () => void;
}

const commitMutation = (state: PosterEditorState, nextDoc: PosterDoc): PosterEditorState => {
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

  initializePoster: ({ posterId, doc }) => {
    set({
      posterId,
      doc: withHistoryFlags(cloneDoc(doc), false, false),
      isDirty: false,
      canUndo: false,
      canRedo: false,
      historyPast: [],
      historyFuture: []
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
      historyFuture: []
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

  setHeaderContent: (content) => {
    set((state) => {
      if (!state.doc) {
        return state;
      }

      return commitMutation(state, {
        ...state.doc,
        sections: {
          ...state.doc.sections,
          header: {
            ...state.doc.sections.header,
            content
          }
        }
      });
    });
  },

  setFooterContent: (content) => {
    set((state) => {
      if (!state.doc) {
        return state;
      }

      return commitMutation(state, {
        ...state.doc,
        sections: {
          ...state.doc.sections,
          footer: {
            ...state.doc.sections.footer,
            content
          }
        }
      });
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

      return commitMutation(state, {
        ...state.doc,
        blocks: {
          ...state.doc.blocks,
          [blockId]: {
            ...block,
            content
          }
        }
      });
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

      return commitMutation(state, {
        ...state.doc,
        blocks: {
          ...state.doc.blocks,
          [blockId]: {
            ...block,
            position: { x, y }
          }
        }
      });
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
      const segmentId = createId("seg");
      const blockId = createId("block");

      const nextLayout = normalizeColumnWidths({
        columnIds: [...currentIds, columnId],
        columns: {
          ...state.doc.sections.main.columns,
          [columnId]: {
            id: columnId,
            widthRatio: 0,
            segments: [
              {
                id: segmentId,
                blockIds: [blockId]
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
          [blockId]: {
            id: blockId,
            type: "text",
            content: createDefaultTextContent("New Section")
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

  addSegment: (columnId) => {
    set((state) => {
      if (!state.doc) {
        return state;
      }

      const column = state.doc.sections.main.columns[columnId];
      if (!column) {
        return state;
      }

      const segmentId = createId("seg");
      const blockId = createId("block");

      const updatedColumn = {
        ...column,
        segments: [
          ...column.segments,
          {
            id: segmentId,
            blockIds: [blockId]
          }
        ]
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
