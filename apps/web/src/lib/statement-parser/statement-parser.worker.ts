/// <reference lib="webworker" />

import {parseTransactions} from './parse';
import type {PdfTextItem} from './types';

self.onmessage = (event: MessageEvent<{items: PdfTextItem[]; creditCard: boolean}>) => {
  try {
    self.postMessage({type: 'progress', label: 'Reconstructing transactions'});
    const result = parseTransactions(event.data.items, event.data.creditCard);
    self.postMessage({type: 'progress', label: 'Validating statement'});
    self.postMessage({type: 'result', result});
  } catch {
    self.postMessage({type: 'error', message: 'The statement layout could not be parsed.'});
  }
};
