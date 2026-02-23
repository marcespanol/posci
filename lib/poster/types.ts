export type PosterDocVersion = 1;
export type PosterDocV2Version = 2;

export type PosterOrientation = "portrait" | "landscape";
export type PosterSizePreset = "A1" | "SCREEN_X2";
export type TypographyTheme = "SERIF_HEADERS_SANS_BODY" | "SANS_HEADERS_MONO_BODY";
export type ColorTheme = "BLUE" | "GREEN";

export interface TipTapJsonContent {
  type: string;
  content?: TipTapJsonContent[];
  text?: string;
  attrs?: Record<string, string | number | boolean | null>;
  marks?: Array<{
    type: string;
    attrs?: Record<string, string | number | boolean | null>;
  }>;
}

export interface PosterHeaderFooter {
  content: TipTapJsonContent;
}

export interface PosterColumnSegment {
  id: string;
  blockIds: string[];
  heightRatio?: number;
}

export interface PosterColumn {
  id: string;
  widthRatio: number;
  segments: PosterColumnSegment[];
}

export interface PosterMainLayout {
  columnIds: string[];
  columns: Record<string, PosterColumn>;
}

export type PosterBlockType = "text" | "image" | "floatingParagraph";

export interface PosterBlockBase {
  id: string;
  type: PosterBlockType;
}

export interface PosterTextBlock extends PosterBlockBase {
  type: "text";
  content: TipTapJsonContent;
}

export interface PosterImageBlock extends PosterBlockBase {
  type: "image";
  assetId: string;
  src: string;
  alt: string;
  caption?: string;
}

export interface PosterFloatingParagraphBlock extends PosterBlockBase {
  type: "floatingParagraph";
  content: TipTapJsonContent;
  position: {
    x: number;
    y: number;
  };
}

export type PosterBlock = PosterTextBlock | PosterImageBlock | PosterFloatingParagraphBlock;

export interface PosterDoc {
  version: PosterDocVersion;
  meta: {
    title: string;
    orientation: PosterOrientation;
    sizePreset: PosterSizePreset;
    typographyTheme: TypographyTheme;
    colorTheme: ColorTheme;
    headerSubtitleVisible?: boolean;
    footerVisible: boolean;
  };
  sections: {
    header: PosterHeaderFooter;
    headerSubtitle?: PosterHeaderFooter;
    footer: PosterHeaderFooter;
    main: PosterMainLayout;
  };
  blocks: Record<string, PosterBlock>;
  experimental?: {
    mainEditorMode?: "legacy" | "grid-v2";
    mainGridV2?: PosterMainGridLayout;
  };
  history: {
    canUndo: boolean;
    canRedo: boolean;
  };
}

export interface PosterGridSpec {
  cols: 24;
  rows: 12;
  gapPx: number;
}

export interface PosterMainRegion {
  id: string;
  kind: "content";
  x: number;
  y: number;
  w: number;
  h: number;
  blockId: string;
  zIndex?: number;
  locked?: boolean;
}

export interface PosterMainGridLayout {
  grid: PosterGridSpec;
  regions: PosterMainRegion[];
}

export interface PosterDocV2 {
  version: PosterDocV2Version;
  meta: {
    title: string;
    orientation: PosterOrientation;
    sizePreset: PosterSizePreset;
    typographyTheme: TypographyTheme;
    colorTheme: ColorTheme;
    headerSubtitleVisible?: boolean;
    footerVisible: boolean;
  };
  sections: {
    header: PosterHeaderFooter;
    headerSubtitle?: PosterHeaderFooter;
    footer: PosterHeaderFooter;
    main: PosterMainGridLayout;
  };
  blocks: Record<string, PosterBlock>;
  history: {
    canUndo: boolean;
    canRedo: boolean;
  };
}

export type PosterDocV1 = PosterDoc;
export type PosterDocAny = PosterDocV1 | PosterDocV2;
export type PosterDocLatest = PosterDocV1;
