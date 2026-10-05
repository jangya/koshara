import {extractPdfText} from './extract';
import type {ParseResult, PdfTextItem} from './types';

function reconstruct(items: PdfTextItem[], creditCard: boolean, onProgress: (label: string) => void): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./statement-parser.worker.ts', import.meta.url));
    worker.onmessage = (event: MessageEvent<{type: 'progress'; label: string} | {type: 'result'; result: ParseResult} | {type: 'error'; message: string}>) => {
      const message = event.data;
      if (message.type === 'progress') onProgress(message.label);
      if (message.type === 'result') { worker.terminate(); resolve(message.result); }
      if (message.type === 'error') { worker.terminate(); reject(new Error(message.message)); }
    };
    worker.onerror = () => { worker.terminate(); reject(new Error('The statement parser worker failed.')); };
    worker.postMessage({items, creditCard});
  });
}

export async function parsePdfStatement(file: File, creditCard: boolean, onProgress: (label: string) => void) {
  const items = await extractPdfText(file, (page, total) => onProgress(`Reading page ${page} of ${total}`));
  return reconstruct(items, creditCard, onProgress);
}
