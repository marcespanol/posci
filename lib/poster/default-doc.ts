import type { PosterDoc } from "@/lib/poster/types";

const createTextBlock = (id: string, heading: string, paragraph: string) => ({
  id,
  type: "text" as const,
  content: {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: heading }]
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: paragraph }]
      }
    ]
  }
});

export const createDefaultPosterDoc = (title: string): PosterDoc => {
  const columnIds = ["col-1", "col-2", "col-3"];

  const blocks = {
    "block-main-intro": createTextBlock("block-main-intro", "Introduction", "Start writing your poster content here."),
    "block-main-methods": createTextBlock("block-main-methods", "Methods", "Describe methods, materials, and setup."),
    "block-main-results": createTextBlock("block-main-results", "Results", "Summarize findings and key visuals.")
  };

  return {
    version: 1,
    meta: {
      title,
      orientation: "portrait",
      sizePreset: "A1",
      typographyTheme: "SERIF_HEADERS_SANS_BODY",
      colorTheme: "BLUE",
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
        columnIds,
        columns: {
          "col-1": {
            id: "col-1",
            widthRatio: 1 / 3,
            segments: [
              {
                id: "seg-1",
                blockIds: ["block-main-intro"]
              }
            ]
          },
          "col-2": {
            id: "col-2",
            widthRatio: 1 / 3,
            segments: [
              {
                id: "seg-2",
                blockIds: ["block-main-methods"]
              }
            ]
          },
          "col-3": {
            id: "col-3",
            widthRatio: 1 / 3,
            segments: [
              {
                id: "seg-3",
                blockIds: ["block-main-results"]
              }
            ]
          }
        }
      }
    },
    blocks,
    history: {
      canUndo: false,
      canRedo: false
    }
  };
};
