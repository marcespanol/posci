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
    "block-main-intro-b": createTextBlock("block-main-intro-b", "Background", "Add background details."),
    "block-main-methods": createTextBlock("block-main-methods", "Methods", "Describe methods, materials, and setup."),
    "block-main-methods-b": createTextBlock("block-main-methods-b", "Procedure", "Write step-by-step process."),
    "block-main-results": createTextBlock("block-main-results", "Results", "Summarize findings and key visuals."),
    "block-main-results-b": createTextBlock("block-main-results-b", "Discussion", "Interpret the results and key takeaways.")
  };

  return {
    version: 1,
    meta: {
      title,
      orientation: "portrait",
      sizePreset: "A1",
      typographyTheme: "SERIF_HEADERS_SANS_BODY",
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
        columnIds,
        columns: {
          "col-1": {
            id: "col-1",
            widthRatio: 1 / 3,
            segments: [
              {
                id: "seg-1",
                blockIds: ["block-main-intro"],
                heightRatio: 0.5
              },
              {
                id: "seg-1b",
                blockIds: ["block-main-intro-b"],
                heightRatio: 0.5
              }
            ]
          },
          "col-2": {
            id: "col-2",
            widthRatio: 1 / 3,
            segments: [
              {
                id: "seg-2",
                blockIds: ["block-main-methods"],
                heightRatio: 0.5
              },
              {
                id: "seg-2b",
                blockIds: ["block-main-methods-b"],
                heightRatio: 0.5
              }
            ]
          },
          "col-3": {
            id: "col-3",
            widthRatio: 1 / 3,
            segments: [
              {
                id: "seg-3",
                blockIds: ["block-main-results"],
                heightRatio: 0.5
              },
              {
                id: "seg-3b",
                blockIds: ["block-main-results-b"],
                heightRatio: 0.5
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
