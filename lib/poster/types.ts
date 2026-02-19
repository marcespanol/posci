export type PosterDocVersion = 1;

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
    footerVisible: boolean;
  };
  sections: {
    header: PosterHeaderFooter;
    footer: PosterHeaderFooter;
    main: PosterMainLayout;
  };
  blocks: Record<string, PosterBlock>;
  history: {
    canUndo: boolean;
    canRedo: boolean;
  };
}
