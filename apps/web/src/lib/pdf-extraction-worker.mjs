import {parentPort, workerData} from 'node:worker_threads';

import {
  getDocument,
  PasswordException,
  PasswordResponses,
  VerbosityLevel,
} from './pdfjs-server.mjs';

function extractionError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function pageRows(items) {
  const rows = [];
  for (const item of items) {
    const row = rows.find((candidate) => Math.abs(candidate.y - item.y) <= 2);
    if (row) row.items.push(item);
    else rows.push({y: item.y, items: [item]});
  }
  return rows
    .sort((left, right) => right.y - left.y)
    .map((row) => row.items.sort((left, right) => left.x - right.x).map((item) => item.text));
}

async function extract() {
  const {data, limits, password} = workerData;
  const loadingTask = getDocument({
    data,
    password,
    stopAtErrors: true,
    maxImageSize: 1_000_000,
    useWasm: false,
    disableFontFace: true,
    verbosity: VerbosityLevel.ERRORS,
  });
  try {
    const document = await loadingTask.promise;
    if (document.numPages < 1 || document.numPages > limits.maxPages) {
      throw extractionError('PDF_LIMIT_EXCEEDED', `PDF exceeds the ${limits.maxPages} page limit`);
    }

    const extractedRows = [];
    let extractedTextBytes = 0;
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      try {
        const textContent = await page.getTextContent({disableNormalization: false, includeMarkedContent: false});
        const items = [];
        for (const item of textContent.items) {
          if (!('str' in item)) continue;
          const text = item.str.trim();
          if (!text) continue;
          if (text.length > limits.maxFieldLength) {
            throw extractionError('PDF_LIMIT_EXCEEDED', 'A PDF text field exceeds the extraction limit');
          }
          extractedTextBytes += new TextEncoder().encode(text).length;
          if (extractedTextBytes > limits.maxExtractedTextBytes) {
            throw extractionError('PDF_LIMIT_EXCEEDED', 'PDF extracted text exceeds the configured limit');
          }
          items.push({x: item.transform[4], y: item.transform[5], text});
        }
        extractedRows.push(...pageRows(items));
        if (extractedRows.length > limits.maxRows) {
          throw extractionError('PDF_LIMIT_EXCEEDED', `PDF exceeds the ${limits.maxRows} extracted row limit`);
        }
      } finally {
        page.cleanup();
      }
    }

    if (extractedRows.length === 0) {
      throw extractionError('MALFORMED_PDF', 'PDF does not contain extractable statement text');
    }
    const columnCount = Math.max(...extractedRows.map((row) => row.length));
    if (columnCount < 1 || columnCount > limits.maxColumns) {
      throw extractionError('PDF_LIMIT_EXCEEDED', `PDF exceeds the ${limits.maxColumns} extracted column limit`);
    }
    const headers = Array.from({length: columnCount}, (_, index) => `Column ${index + 1}`);
    return {
      pageCount: document.numPages,
      extractedTextBytes,
      parsedCsv: {
        headers,
        rows: extractedRows.map((row, index) => ({
          rowNumber: index + 2,
          values: Object.fromEntries(headers.map((header, columnIndex) => [header, row[columnIndex] ?? ''])),
        })),
      },
    };
  } finally {
    await loadingTask.destroy().catch(() => undefined);
  }
}

try {
  parentPort.postMessage({ok: true, value: await extract()});
} catch (error) {
  if (error instanceof PasswordException || error?.name === 'PasswordException') {
    parentPort.postMessage(error.code === PasswordResponses.NEED_PASSWORD
      ? {ok: false, code: 'PDF_PASSWORD_REQUIRED', message: 'This PDF requires a password'}
      : {ok: false, code: 'PDF_PASSWORD_INVALID', message: 'The PDF password is incorrect'});
  } else if (error?.code === 'PDF_LIMIT_EXCEEDED' || error?.code === 'MALFORMED_PDF') {
    parentPort.postMessage({ok: false, code: error.code, message: error.message});
  } else {
    parentPort.postMessage({ok: false, code: 'MALFORMED_PDF', message: 'The PDF could not be parsed safely'});
  }
}
