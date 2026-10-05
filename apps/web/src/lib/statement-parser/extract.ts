import type { PdfTextItem } from "./types";

export async function extractPdfText(
  file: File,
  onProgress: (page: number, total: number) => void,
): Promise<PdfTextItem[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const task = pdfjs.getDocument({ data: bytes, useSystemFonts: true });
  const document = await task.promise;
  const items: PdfTextItem[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      onProgress(pageNumber, document.numPages);
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      for (const item of content.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        items.push({
          text: item.str,
          page: pageNumber,
          x: item.transform[4],
          y: item.transform[5],
          width: item.width,
          height: item.height,
        });
      }
      page.cleanup();
    }
  } finally {
    await task.destroy();
  }
  return items;
}
