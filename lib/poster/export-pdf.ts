const textEncoder = new TextEncoder();

const toBytes = (value: string): Uint8Array => textEncoder.encode(value);

const concatBytes = (chunks: Uint8Array[]): Uint8Array => {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
};

const base64ToBytes = (base64: string): Uint8Array => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const loadImageDimensions = (dataUrl: string): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      resolve({ width: image.width, height: image.height });
    };
    image.onerror = () => {
      reject(new Error("Failed to read export image dimensions"));
    };
    image.src = dataUrl;
  });
};

const pngDataUrlToJpegDataUrl = async (pngDataUrl: string): Promise<string> => {
  const { width, height } = await loadImageDimensions(pngDataUrl);
  const image = new Image();

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Failed to decode image for PDF export"));
    image.src = pngDataUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas context unavailable for PDF export");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.95);
};

export const downloadPdfFromPngDataUrl = async (pngDataUrl: string, filename: string): Promise<void> => {
  const jpegDataUrl = await pngDataUrlToJpegDataUrl(pngDataUrl);
  const match = jpegDataUrl.match(/^data:image\/jpeg;base64,(.+)$/);
  if (!match) {
    throw new Error("Failed to prepare JPEG stream for PDF export");
  }

  const jpegBytes = base64ToBytes(match[1]);
  const { width, height } = await loadImageDimensions(jpegDataUrl);

  const header = toBytes("%PDF-1.4\n");
  const objects: Array<{ id: number; bytes: Uint8Array }> = [];

  const addObject = (objectId: number, body: Uint8Array): void => {
    const bytes = concatBytes([toBytes(`${objectId} 0 obj\n`), body, toBytes("\nendobj\n")]);
    objects.push({ id: objectId, bytes });
  };

  addObject(1, toBytes("<< /Type /Catalog /Pages 2 0 R >>"));
  addObject(2, toBytes("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"));
  addObject(
    3,
    toBytes(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`
    )
  );
  addObject(
    4,
    concatBytes([
      toBytes(
        `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`
      ),
      jpegBytes,
      toBytes("\nendstream")
    ])
  );

  const contentStream = toBytes(`q\n${width} 0 0 ${height} 0 0 cm\n/Im0 Do\nQ\n`);
  addObject(
    5,
    concatBytes([toBytes(`<< /Length ${contentStream.length} >>\nstream\n`), contentStream, toBytes("endstream")])
  );

  const body = concatBytes(objects.map((entry) => entry.bytes));
  const fullBeforeXref = concatBytes([header, body]);

  const offsets: number[] = [0];
  let cursor = header.length;
  for (const entry of objects) {
    offsets[entry.id] = cursor;
    cursor += entry.bytes.length;
  }

  const xrefStart = fullBeforeXref.length;
  const xrefLines = [
    "xref",
    `0 ${offsets.length}`,
    "0000000000 65535 f "
  ];
  for (let index = 1; index < offsets.length; index += 1) {
    xrefLines.push(`${offsets[index].toString().padStart(10, "0")} 00000 n `);
  }

  const trailer = [
    "trailer",
    `<< /Size ${offsets.length} /Root 1 0 R >>`,
    "startxref",
    `${xrefStart}`,
    "%%EOF"
  ].join("\n");

  const pdfBytes = concatBytes([fullBeforeXref, toBytes(`${xrefLines.join("\n")}\n${trailer}`)]);
  const pdfBuffer = pdfBytes.buffer.slice(
    pdfBytes.byteOffset,
    pdfBytes.byteOffset + pdfBytes.byteLength
  ) as ArrayBuffer;
  const blob = new Blob([pdfBuffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
