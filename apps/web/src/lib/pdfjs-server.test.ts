import {describe, expect, it} from 'vitest';

import {hasInstalledPdfWorkerHandler} from './pdfjs-server.mjs';

describe('PDF.js server bootstrap', () => {
  it('installs the in-process worker handler before document loading', () => {
    expect(hasInstalledPdfWorkerHandler()).toBe(true);
  });
});
