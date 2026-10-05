import type {PdfLine, PdfTextItem} from './types';

export function groupIntoLines(items: PdfTextItem[]): PdfLine[] {
  const sorted = items.filter(({text}) => text.trim()).sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x);
  const lines: PdfLine[] = [];
  for (const item of sorted) {
    const last = lines.at(-1);
    const tolerance = Math.min(4, Math.max(2, (item.height ?? 8) * 0.35));
    if (last && last.page === item.page && Math.abs(last.y - item.y) <= tolerance) {
      last.items.push(item);
      last.y = (last.y * (last.items.length - 1) + item.y) / last.items.length;
    } else {
      lines.push({page: item.page, y: item.y, items: [item], text: ''});
    }
  }
  for (const line of lines) {
    line.items.sort((a, b) => a.x - b.x);
    line.text = line.items.map(({text}) => text.trim()).filter(Boolean).join(' ');
  }
  return lines;
}
