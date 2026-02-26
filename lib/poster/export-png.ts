const inlineComputedStyles = (source: Element, target: Element): void => {
  if (!(source instanceof HTMLElement) || !(target instanceof HTMLElement)) {
    return;
  }

  const computed = window.getComputedStyle(source);
  const cssText = Array.from(computed)
    .map((property) => `${property}:${computed.getPropertyValue(property)};`)
    .join("");
  target.setAttribute("style", cssText);
};

const cloneWithInlineStyles = (node: Element): Element => {
  const clone = node.cloneNode(true) as Element;
  const sourceWalker = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT);
  const cloneWalker = document.createTreeWalker(clone, NodeFilter.SHOW_ELEMENT);

  inlineComputedStyles(node, clone);

  while (sourceWalker.nextNode() && cloneWalker.nextNode()) {
    inlineComputedStyles(sourceWalker.currentNode as Element, cloneWalker.currentNode as Element);
  }

  return clone;
};

const createBlobFromDataUrl = async (dataUrl: string): Promise<Blob> => {
  const response = await fetch(dataUrl);
  return response.blob();
};

const triggerDownload = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const renderPosterElementToPngDataUrl = async (element: HTMLElement): Promise<string> => {
  const computed = window.getComputedStyle(element);
  const computedWidth = Number.parseFloat(computed.width);
  const computedHeight = Number.parseFloat(computed.height);
  const width = Math.max(
    1,
    Math.ceil(Number.isFinite(computedWidth) && computedWidth > 0 ? computedWidth : element.offsetWidth)
  );
  const height = Math.max(
    1,
    Math.ceil(Number.isFinite(computedHeight) && computedHeight > 0 ? computedHeight : element.offsetHeight)
  );
  const cloned = cloneWithInlineStyles(element);

  const serialized = new XMLSerializer().serializeToString(cloned);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <foreignObject x="0" y="0" width="100%" height="100%">${serialized}</foreignObject>
    </svg>
  `;
  const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

  return await new Promise<string>((resolve, reject) => {
    const image = new Image();
    image.onload = async () => {
      try {
        const canvas = document.createElement("canvas");
        const scale = 2;
        canvas.width = width * scale;
        canvas.height = height * scale;
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Canvas context unavailable"));
          return;
        }

        context.setTransform(scale, 0, 0, scale, 0, 0);
        context.drawImage(image, 0, 0);

        const dataUrl = canvas.toDataURL("image/png");
        resolve(dataUrl);
      } catch (error) {
        reject(error);
      }
    };
    image.onerror = () => {
      reject(new Error("Failed to render poster image"));
    };
    image.src = svgUrl;
  });
};

export const downloadPosterElementAsPng = async (element: HTMLElement, filename: string): Promise<void> => {
  const dataUrl = await renderPosterElementToPngDataUrl(element);
  const blob = await createBlobFromDataUrl(dataUrl);
  triggerDownload(blob, filename);
};
