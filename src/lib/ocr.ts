import { createWorker, PSM } from 'tesseract.js';
import { prepareForOcr } from './image-utils.ts';
import { hasUsableLabelText } from './label-schema.ts';

/**
 * Client-side OCR for SomaLabel.
 * Converts a label photo into raw text so the server can send plain text to
 * the label reader instead of image bytes.
 *
 * The first scan used to fail whenever the OCR worker and English language
 * data had not been downloaded yet: the whole attempt was abandoned at 20s
 * and the app fell back to the slow vision path. Now the worker is warmed up
 * when the app opens, each pass has its own budget, and a second pass runs on
 * a cleaned, upscaled copy of the photo if the first read is poor.
 */

export const OCR_PASS_TIMEOUT_MS = 12000;

type OcrWorker = Awaited<ReturnType<typeof createWorker>>;

let cachedWorker: OcrWorker | null = null;
let workerPromise: Promise<OcrWorker> | null = null;

function getWorker(): Promise<OcrWorker> {
  if (cachedWorker) return Promise.resolve(cachedWorker);
  if (!workerPromise) {
    workerPromise = createWorker('eng')
      .then(async (worker) => {
        await worker.setParameters({
          // Full layout analysis: medicine packs mix a large brand name with
          // small print, which a single-block pass can drop entirely.
          tessedit_pageseg_mode: PSM.AUTO,
          preserve_interword_spaces: '1',
        });
        cachedWorker = worker;
        return worker;
      })
      .catch((err) => {
        workerPromise = null;
        throw err;
      });
  }
  return workerPromise;
}

/**
 * Starts the OCR worker before the user taps "Scan", so the language data
 * download does not eat into the first scan. Safe to call more than once.
 */
export function warmupOcr(): void {
  void getWorker().catch(() => {
    /* a failed warmup is retried by the next scan */
  });
}

function forgetWorker(): void {
  cachedWorker = null;
  workerPromise = null;
}

interface RecognizeOutcome {
  text: string;
  timedOut: boolean;
}

async function recognizeOnce(dataUrl: string, timeoutMs: number): Promise<RecognizeOutcome> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), timeoutMs);
    });
    const work = (async (): Promise<string> => {
      const worker = await getWorker();
      const result = await worker.recognize(dataUrl);
      const text = result?.data?.text;
      return typeof text === 'string' ? text.trim() : '';
    })();
    const outcome = await Promise.race([work, timeout]);
    if (outcome === null) return { text: '', timedOut: true };
    return { text: outcome, timedOut: false };
  } catch {
    forgetWorker();
    return { text: '', timedOut: false };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Reads printed text from a label photo data URL.
 * 1. one pass on the photo as resized for the server
 * 2. if that text is not usable, a second pass on an upscaled, contrast-stretched copy
 * Returns the better of the two, or '' when neither produced text.
 *
 * A pass that hits its timeout is not followed by a second pass: the worker is
 * still busy (usually still downloading the language data), and queueing a
 * second recognition behind it would only make the user wait longer.
 */
export async function readLabelText(dataUrl: string): Promise<string> {
  const first = await recognizeOnce(dataUrl, OCR_PASS_TIMEOUT_MS);
  if (first.timedOut) return '';
  if (hasUsableLabelText(first.text)) return first.text;

  try {
    const prepared = await prepareForOcr(dataUrl);
    const second = await recognizeOnce(prepared, OCR_PASS_TIMEOUT_MS);
    if (second.timedOut) return first.text;
    if (hasUsableLabelText(second.text)) return second.text;
    return second.text.length > first.text.length ? second.text : first.text;
  } catch {
    return first.text;
  }
}
