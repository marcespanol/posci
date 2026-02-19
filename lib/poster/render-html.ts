import type { PosterBlock, TipTapJsonContent } from "@/lib/poster/types";

const escapeHtml = (value: string): string => {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
};

const wrapWithMarks = (text: string, marks?: TipTapJsonContent["marks"]): string => {
  if (!marks || marks.length === 0) {
    return text;
  }

  return marks.reduce((acc, mark) => {
    if (mark.type === "bold") {
      return `<strong>${acc}</strong>`;
    }

    if (mark.type === "italic") {
      return `<em>${acc}</em>`;
    }

    if (mark.type === "underline") {
      return `<u>${acc}</u>`;
    }

    return acc;
  }, text);
};

const renderNode = (node: TipTapJsonContent): string => {
  const children = (node.content ?? []).map((item) => renderNode(item)).join("");

  if (node.type === "doc") {
    return children;
  }

  if (node.type === "paragraph") {
    return `<p>${children || "<br />"}</p>`;
  }

  if (node.type === "heading") {
    const level = typeof node.attrs?.level === "number" ? node.attrs.level : 2;
    const headingTag = level === 1 ? "h1" : level === 3 ? "h3" : "h2";
    return `<${headingTag}>${children}</${headingTag}>`;
  }

  if (node.type === "text") {
    const safeText = escapeHtml(node.text ?? "");
    return wrapWithMarks(safeText, node.marks);
  }

  if (node.type === "image" || node.type === "inlineImage") {
    const src = typeof node.attrs?.src === "string" ? escapeHtml(node.attrs.src) : "";
    const alt = typeof node.attrs?.alt === "string" ? escapeHtml(node.attrs.alt) : "";
    if (!src) {
      return "";
    }

    return `<img src="${src}" alt="${alt}" ${node.type === "inlineImage" ? "class=\"inline-image\"" : ""} />`;
  }

  return children;
};

export const renderTipTapDocToHtml = (content: TipTapJsonContent): string => {
  return renderNode(content);
};

export const renderPosterBlockToHtml = (block: PosterBlock): string => {
  if (block.type === "text" || block.type === "floatingParagraph") {
    return renderTipTapDocToHtml(block.content);
  }

  if (block.type === "image") {
    const safeAlt = escapeHtml(block.alt);
    const safeSrc = escapeHtml(block.src);
    const safeCaption = block.caption ? `<figcaption>${escapeHtml(block.caption)}</figcaption>` : "";

    return `<figure><img src="${safeSrc}" alt="${safeAlt}" />${safeCaption}</figure>`;
  }

  return "";
};
