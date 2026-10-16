/**
 * D45 / ST-6 (LTR-226): the text of a PDF, line by line, read in the browser (the file never goes through the API).
 * Pieces of text on the same height make one line, left to right. A scanned invoice has no text: empty list.
 */
export async function pdfTextLines(file: File): Promise<string[]> {
  const { getDocumentProxy } = await import('unpdf');
  const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
  const lines: string[] = [];
  for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, 10); pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const rows = new Map<number, Array<{ x: number; text: string }>>();
    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue;
      const [, , , , x, y] = item.transform as number[];
      // Items within 2 points of height are the same line.
      const key = [...rows.keys()].find((existing) => Math.abs(existing - y) <= 2) ?? Math.round(y);
      const row = rows.get(key) ?? [];
      row.push({ x, text: item.str.trim() });
      rows.set(key, row);
    }
    for (const key of [...rows.keys()].sort((top, bottom) => bottom - top)) {
      lines.push(rows.get(key)!.sort((left, right) => left.x - right.x).map((piece) => piece.text).join(' '));
    }
  }
  return lines;
}
