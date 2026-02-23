import type {
  PosterBlock,
  PosterDoc,
  PosterDocAny,
  PosterDocV2,
  PosterMainRegion,
  TipTapJsonContent
} from "@/lib/poster/types";

const GRID_COLS = 24 as const;
const GRID_ROWS = 12 as const;
const DEFAULT_GAP_PX = 12;

interface RatioItem {
  id: string;
  ratio: number;
}

interface SpanItem {
  id: string;
  span: number;
}

const createDefaultTextDoc = (): TipTapJsonContent => ({
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "" }]
    }
  ]
});

const createDefaultHeaderSubtitleDoc = (): TipTapJsonContent => ({
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "Author Name • Institution Name • 2026" }]
    }
  ]
});

const safeRatio = (value: number | undefined): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return 1;
  }

  return value;
};

const clampInt = (value: number, min: number, max: number): number => {
  const next = Math.round(Number.isFinite(value) ? value : min);
  return Math.max(min, Math.min(max, next));
};

const ratiosToExactSpans = (items: RatioItem[], totalUnits: number): SpanItem[] => {
  if (items.length === 0) {
    return [];
  }

  const normalized = items.map((item) => ({
    id: item.id,
    ratio: safeRatio(item.ratio)
  }));

  const ratioSum = normalized.reduce((sum, item) => sum + item.ratio, 0) || 1;
  const raw = normalized.map((item) => ({
    id: item.id,
    value: (item.ratio / ratioSum) * totalUnits
  }));

  const base = raw.map((item) => ({
    id: item.id,
    span: Math.max(1, Math.floor(item.value)),
    remainder: item.value - Math.floor(item.value)
  }));

  let used = base.reduce((sum, item) => sum + item.span, 0);

  if (used > totalUnits) {
    const sorted = [...base].sort((a, b) => b.span - a.span);
    let guard = 0;

    while (used > totalUnits && guard < 10000) {
      let changed = false;
      for (const item of sorted) {
        if (used <= totalUnits) {
          break;
        }

        if (item.span > 1) {
          item.span -= 1;
          used -= 1;
          changed = true;
        }
      }

      if (!changed) {
        break;
      }

      guard += 1;
    }
  }

  if (used < totalUnits) {
    const sorted = [...base].sort((a, b) => b.remainder - a.remainder);
    let index = 0;
    while (used < totalUnits && index < 10000) {
      const target = sorted[index % sorted.length];
      target.span += 1;
      used += 1;
      index += 1;
    }
  }

  return base.map(({ id, span }) => ({ id, span }));
};

const buildStarts = (items: SpanItem[]): Map<string, number> => {
  const starts = new Map<string, number>();
  let cursor = 0;

  for (const item of items) {
    starts.set(item.id, cursor);
    cursor += item.span;
  }

  return starts;
};

const isTextBlock = (block: PosterBlock | undefined): block is Extract<PosterBlock, { type: "text" }> =>
  block?.type === "text";

const ensurePrimaryBlockIdForSegment = (
  blocks: Record<string, PosterBlock>,
  segmentBlockIds: string[],
  fallbackKey: string
): { blocks: Record<string, PosterBlock>; blockId: string } => {
  const firstTextBlockId = segmentBlockIds.find((blockId) => isTextBlock(blocks[blockId]));
  if (firstTextBlockId) {
    return { blocks, blockId: firstTextBlockId };
  }

  const firstExistingBlockId = segmentBlockIds.find((blockId) => Boolean(blocks[blockId]));
  if (firstExistingBlockId) {
    return { blocks, blockId: firstExistingBlockId };
  }

  const generatedBlockId = `migrated-block-${fallbackKey}`;
  return {
    blocks: {
      ...blocks,
      [generatedBlockId]: {
        id: generatedBlockId,
        type: "text",
        content: createDefaultTextDoc()
      }
    },
    blockId: generatedBlockId
  };
};

const normalizeRegions = (
  regions: PosterMainRegion[],
  grid: { cols: number; rows: number }
): PosterMainRegion[] => {
  return regions.map((region) => {
    const x = clampInt(region.x, 0, grid.cols - 1);
    const y = clampInt(region.y, 0, grid.rows - 1);
    const w = clampInt(region.w, 1, grid.cols - x);
    const h = clampInt(region.h, 1, grid.rows - y);

    return {
      ...region,
      x,
      y,
      w,
      h
    };
  });
};

export const normalizePosterDocV2 = (doc: PosterDocV2): PosterDocV2 => {
  const grid = {
    cols: GRID_COLS,
    rows: GRID_ROWS,
    gapPx: Math.max(0, Math.round(doc.sections.main.grid.gapPx ?? DEFAULT_GAP_PX))
  };

  return {
    ...doc,
    meta: {
      ...doc.meta,
      headerSubtitleVisible: doc.meta.headerSubtitleVisible ?? true
    },
    sections: {
      ...doc.sections,
      headerSubtitle: doc.sections.headerSubtitle ?? {
        content: createDefaultHeaderSubtitleDoc()
      },
      main: {
        grid,
        regions: normalizeRegions(doc.sections.main.regions, grid)
      }
    }
  };
};

export const migratePosterDocV1ToV2 = (v1: PosterDoc): PosterDocV2 => {
  if (v1.experimental?.mainGridV2) {
    const fromExperimental = normalizePosterDocV2({
      version: 2,
      meta: {
        ...v1.meta,
        headerSubtitleVisible: v1.meta.headerSubtitleVisible ?? true
      },
      sections: {
        header: v1.sections.header,
        headerSubtitle: v1.sections.headerSubtitle ?? {
          content: createDefaultHeaderSubtitleDoc()
        },
        footer: v1.sections.footer,
        main: v1.experimental.mainGridV2
      },
      blocks: structuredClone(v1.blocks),
      history: v1.history
    });

    // Guard against stale/partial experimental grid snapshots (observed during migration):
    // if the saved experimental grid has no regions but legacy columns still exist, rebuild from v1.
    if (fromExperimental.sections.main.regions.length > 0 || v1.sections.main.columnIds.length === 0) {
      return fromExperimental;
    }
  }

  const columnIds = v1.sections.main.columnIds.filter((columnId) => Boolean(v1.sections.main.columns[columnId]));
  const columnSpans = ratiosToExactSpans(
    columnIds.map((columnId) => ({
      id: columnId,
      ratio: safeRatio(v1.sections.main.columns[columnId]?.widthRatio)
    })),
    GRID_COLS
  );
  const columnStarts = buildStarts(columnSpans);

  let nextBlocks = structuredClone(v1.blocks);
  const regions: PosterMainRegion[] = [];

  for (const columnId of columnIds) {
    const column = v1.sections.main.columns[columnId];
    if (!column) {
      continue;
    }

    const columnSpan = columnSpans.find((item) => item.id === columnId);
    const x = columnStarts.get(columnId);

    if (!columnSpan || x === undefined) {
      continue;
    }

    const segmentSpans = ratiosToExactSpans(
      column.segments.map((segment) => ({
        id: segment.id,
        ratio: safeRatio(segment.heightRatio)
      })),
      GRID_ROWS
    );
    const rowStarts = buildStarts(segmentSpans);

    for (const segment of column.segments) {
      const rowSpan = segmentSpans.find((item) => item.id === segment.id);
      const y = rowStarts.get(segment.id);
      if (!rowSpan || y === undefined) {
        continue;
      }

      // v1 can contain multiple block IDs per segment; v2 regions attach one primary block.
      // Prefer text blocks to preserve editability during migration.
      const primary = ensurePrimaryBlockIdForSegment(nextBlocks, segment.blockIds, `${columnId}-${segment.id}`);
      nextBlocks = primary.blocks;

      regions.push({
        id: segment.id,
        kind: "content",
        x,
        y,
        w: columnSpan.span,
        h: rowSpan.span,
        blockId: primary.blockId
      });
    }
  }

  return normalizePosterDocV2({
    version: 2,
    meta: {
      ...v1.meta,
      headerSubtitleVisible: v1.meta.headerSubtitleVisible ?? true
    },
    sections: {
      header: v1.sections.header,
      headerSubtitle: v1.sections.headerSubtitle ?? {
        content: createDefaultHeaderSubtitleDoc()
      },
      footer: v1.sections.footer,
      main: {
        grid: {
          cols: GRID_COLS,
          rows: GRID_ROWS,
          gapPx: DEFAULT_GAP_PX
        },
        regions
      }
    },
    blocks: nextBlocks,
    history: v1.history
  });
};

export const migratePosterDocToLatest = (doc: PosterDocAny): PosterDocV2 => {
  if (doc.version === 2) {
    return normalizePosterDocV2(doc);
  }

  return migratePosterDocV1ToV2(doc);
};

export const adaptPosterDocV2ToEditorV1 = (v2: PosterDocV2): PosterDoc => {
  const normalized = normalizePosterDocV2(v2);
  const nextBlocks = structuredClone(normalized.blocks);
  const sortedRegions = [...normalized.sections.main.regions].sort((a, b) => {
    if (a.y !== b.y) {
      return a.y - b.y;
    }
    if (a.x !== b.x) {
      return a.x - b.x;
    }
    return a.id.localeCompare(b.id);
  });

  const preferredBlockId =
    sortedRegions
      .map((region) => region.blockId)
      .find((blockId) => nextBlocks[blockId]?.type === "text") ??
    Object.values(nextBlocks).find((block) => block.type === "text")?.id;

  let fallbackBlockId = preferredBlockId;
  if (!fallbackBlockId) {
    fallbackBlockId = "v2-fallback-text";
    nextBlocks[fallbackBlockId] = {
      id: fallbackBlockId,
      type: "text",
      content: createDefaultTextDoc()
    };
  }

  const fallbackSegments =
    sortedRegions.length > 0
      ? sortedRegions.map((region, index) => ({
          id: `v2-compat-seg-${index + 1}`,
          blockIds: [region.blockId in nextBlocks ? region.blockId : fallbackBlockId],
          heightRatio: 1 / sortedRegions.length
        }))
      : [
          {
            id: "v2-compat-seg-1",
            blockIds: [fallbackBlockId],
            heightRatio: 1
          }
        ];

  return {
    version: 1,
    meta: {
      ...normalized.meta,
      headerSubtitleVisible: normalized.meta.headerSubtitleVisible ?? true
    },
    sections: {
      header: normalized.sections.header,
      headerSubtitle: normalized.sections.headerSubtitle,
      footer: normalized.sections.footer,
      // Editor currently still expects v1 columns/segments in many places.
      // Build a compatibility fallback that keeps all grid regions visible in Legacy mode.
      // Exact grid geometry is not preserved; regions are flattened into stacked rows.
      main: {
        columnIds: ["v2-compat-col-1"],
        columns: {
          "v2-compat-col-1": {
            id: "v2-compat-col-1",
            widthRatio: 1,
            segments: fallbackSegments
          }
        }
      }
    },
    blocks: nextBlocks,
    experimental: {
      mainEditorMode: "grid-v2",
      mainGridV2: normalized.sections.main
    },
    history: {
      canUndo: v2.history.canUndo,
      canRedo: v2.history.canRedo
    }
  };
};
