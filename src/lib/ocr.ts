import { createWorker } from 'tesseract.js';

/**
 * Client-side OCR for SomaLabel.
 * Converts a label photo into raw text before the server call so Gemma
 * receives plain text instead of image bytes.
 */

export const OCR_TIMEOUT_MS = 20000;

type OcrWorker = Awaited<ReturnType<typeof createWorker>>;

let cachedWorker: OcrWorker | null = null;
let workerPromise: Promise<OcrWorker> | null = null;

function getWorker(): Promise<OcrWorker> {
  if (cachedWorker) return Promise.resolve(cachedWorker);
  if (!workerPromise) {
    workerPromise = createWorker('eng').then((worker) => {
      cachedWorker = worker;
      return worker;
    }).catch((err) => {
      workerPromise = null;
      throw err;
    });
  }
  return workerPromise;
}

function forgetWorker(): void {
  cachedWorker = null;
  workerPromise = null;
}

/**
 * Reads printed text from a label photo data URL.
 * Reuses one cached English worker, gives up after 20 seconds,
 * and returns an empty string on timeout or error.
 */
export async function readLabelText(dataUrl: string): Promise<string> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), OCR_TIMEOUT_MS);
    });
    const work = (async (): Promise<string> => {
      const worker = await getWorker();
      const result = await worker.recognize(dataUrl);
      const text = result?.data?.text;
      return typeof text === 'string' ? text.trim() : '';
    })();
    const outcome = await Promise.race([work, timeout]);
    if (timer) clearTimeout(timer);
    if (outcome === null) return '';
    return outcome;
  } catch {
    if (timer) clearTimeout(timer);
    forgetWorker();
    return '';
  }
}
