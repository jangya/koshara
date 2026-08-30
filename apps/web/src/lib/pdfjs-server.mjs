import {WorkerMessageHandler} from 'pdfjs-dist/legacy/build/pdf.worker.mjs';
import {
  getDocument,
  PasswordException,
  PasswordResponses,
  VerbosityLevel,
} from 'pdfjs-dist/legacy/build/pdf.mjs';

globalThis.pdfjsWorker = {WorkerMessageHandler};

export function hasInstalledPdfWorkerHandler() {
  return globalThis.pdfjsWorker?.WorkerMessageHandler === WorkerMessageHandler;
}

export {
  getDocument,
  PasswordException,
  PasswordResponses,
  VerbosityLevel,
};
