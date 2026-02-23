import type {
  ColorTheme,
  PosterDocV2,
  PosterMainRegion,
  PosterOrientation,
  PosterSizePreset,
  TypographyTheme
} from "@/lib/poster/types";

type EditorStateReadSlice = {
  gridModeDocV2: PosterDocV2 | null;
  gridPreviewSelectedRegionId: string | null;
};

const EMPTY_GRID_REGIONS: PosterMainRegion[] = [];

export const selectPosterReadDoc = (state: EditorStateReadSlice): PosterDocV2 | null => state.gridModeDocV2;

export const selectPosterReadTitle = (state: EditorStateReadSlice): string => {
  return selectPosterReadDoc(state)?.meta.title ?? "";
};

export const selectPosterReadTypographyTheme = (state: EditorStateReadSlice): TypographyTheme | null => {
  return selectPosterReadDoc(state)?.meta.typographyTheme ?? null;
};

export const selectPosterReadColorTheme = (state: EditorStateReadSlice): ColorTheme | null => {
  return selectPosterReadDoc(state)?.meta.colorTheme ?? null;
};

export const selectPosterReadOrientation = (state: EditorStateReadSlice): PosterOrientation | null => {
  return selectPosterReadDoc(state)?.meta.orientation ?? null;
};

export const selectPosterReadSizePreset = (state: EditorStateReadSlice): PosterSizePreset | null => {
  return selectPosterReadDoc(state)?.meta.sizePreset ?? null;
};

export const selectPosterReadHeaderSubtitleVisible = (state: EditorStateReadSlice): boolean => {
  return selectPosterReadDoc(state)?.meta.headerSubtitleVisible ?? true;
};

export const selectPosterReadFooterVisible = (state: EditorStateReadSlice): boolean => {
  return selectPosterReadDoc(state)?.meta.footerVisible ?? true;
};

export const selectPosterReadHeaderContent = (state: EditorStateReadSlice) => {
  return selectPosterReadDoc(state)?.sections.header.content ?? null;
};

export const selectPosterReadHeaderSubtitleContent = (state: EditorStateReadSlice) => {
  return selectPosterReadDoc(state)?.sections.headerSubtitle?.content ?? null;
};

export const selectPosterReadFooterContent = (state: EditorStateReadSlice) => {
  return selectPosterReadDoc(state)?.sections.footer.content ?? null;
};

export const selectPosterGridRegionsForView = (state: EditorStateReadSlice): PosterMainRegion[] => {
  return state.gridModeDocV2?.sections.main.regions ?? EMPTY_GRID_REGIONS;
};

export const selectPosterGridSelectedRegionId = (state: EditorStateReadSlice): string | null => {
  return state.gridPreviewSelectedRegionId;
};
