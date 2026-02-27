import type { PosterDocV2 } from "@/lib/poster/types";

export const createDefaultPosterDoc = (title: string): PosterDocV2 => {
  return {
    version: 2,
    meta: {
      title,
      orientation: "portrait",
      sizePreset: "A1",
      typographyTheme: "SERIF_HEADERS_SANS_BODY",
      baseTypeSizePt: 12,
      colorTheme: "BLUE",
      headerSubtitleVisible: true,
      footerVisible: true
    },
    sections: {
      header: {
        content: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: title }]
            }
          ]
        }
      },
      headerSubtitle: {
        content: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Author Name • Institution Name • 2026" }]
            }
          ]
        }
      },
      footer: {
        content: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Author, Institution" }]
            }
          ]
        }
      },
      main: {
        grid: {
          cols: 24,
          rows: 12,
          gapPx: 12
        },
        regions: []
      }
    },
    blocks: {},
    history: {
      canUndo: false,
      canRedo: false
    }
  };
};
