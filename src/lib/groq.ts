import type { ExtractionResult } from './extraction.ts';
import { extractJsonString, validateExtractedLabel } from './label-schema.ts';
import { GROQ_API_KEY, GROQ_API_URL, GROQ_MODEL } from './server-env.ts';

/**
 * Groq label reader.
 *
 * The photo never reaches this provider: OCR on the device produces the text
 * and Groq only structures it. That keeps the request small and the answer
 * fast (measured ~1.6s), which is what the Gemini/Gemma endpoint could not
 * promise under load.
 */

export const GROQ_TIMEOUT_MS = 20000;
export const GROQ_RETRY_DELAY_MS = 800;

const SYSTEM_PROMPT = `You are SomaLabel's medicine label extraction engine for Uganda.
You receive OCR text read from a medicine label photo. The text may contain recognition errors.
Output factual information matching ONLY the given JSON schema.

RULES:
1. Use only values present in the OCR text. Copy dates, numbers, registration numbers, batch codes and names as given.
2. Use null for anything not present or not legible. Never guess a strength, date or registration number.
3. Never add dosage, frequency or usage advice that is not printed on the label.
4. plain_explanation_en must be 3 to 5 short sentences in simple English for an ordinary patient:
   - what the medicine is (and what it is for only if the label states it)
   - how to take it ONLY as printed
   - key printed warnings
5. Set readable to false when the text is not a medicine label or is too garbled to trust, and say so in plain_explanation_en.`;

const LABEL_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'readable',
    'product_name',
    'active_ingredients',
    'dosage_form',
    'manufacturer',
    'batch_number',
    'manufacture_date_raw',
    'expiry_date_raw',
    'registration_number',
    'printed_warnings',
    'printed_directions',
    'label_language',
    'plain_explanation_en',
  ],
  properties: {
    readable: { type: 'boolean' },
    product_name: { type: ['string', 'null'] },
    active_ingredients: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'strength'],
        properties: {
          name: { type: 'string' },
          strength: { type: ['string', 'null'] },
        },
      },
    },
    dosage_form: { type: ['string', 'null'] },
    manufacturer: { type: ['string', 'null'] },
    batch_number: { type: ['string', 'null'] },
    manufacture_date_raw: { type: ['string', 'null'] },
    expiry_date_raw: { type: ['string', 'null'] },
    registration_number: { type: ['string', 'null'] },
    printed_warnings: { type: 'array', items: { type: 'string' } },
    printed_directions: { type: ['string', 'null'] },
    label_language: { type: ['string', 'null'] },
    plain_explanation_en: { type: 'string' },
  },
} as const;

export function buildGroqRequestBody(ocrText: string, model: string = GROQ_MODEL): string {
  return JSON.stringify({
    model,
    temperature: 0,
    // gpt-oss spends fewer reasoning tokens at low effort; labels do not need deep reasoning.
    reasoning_effort: 'low',
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'medicine_label',
        strict: true,
        schema: LABEL_JSON_SCHEMA,
      },
    },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content:
          'OCR text from a medicine label photo (may contain recognition errors):\n\n' +
          ocrText.slice(0, 5000),
      },
    ],
  });
}

/** Short, safe message for the UI and logs. Never includes the API key or a stack trace. */
export function readGroqError(body: any, status: number): string {
  const message =
    body?.error?.message ||
    body?.message ||
    (typeof body === 'string' ? body : '');
  const detail = String(message || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  const reason = detail || (status === 401 || status === 403 ? 'API key rejected' : 'request failed');
  return `Groq HTTP ${status}: ${reason}`;
}

export function isRetryableGroqStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503;
}

export interface GroqDeps {
  fetchImpl?: typeof fetch;
  apiKey?: string;
  model?: string;
  url?: string;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Sends OCR text to Groq and returns the validated label.
 * One retry on 429/5xx, then api_error so the caller can fall back to Gemma.
 */
export async function extractWithGroq(
  ocrText: string,
  deps: GroqDeps = {}
): Promise<ExtractionResult> {
  const apiKey = deps.apiKey ?? GROQ_API_KEY;
  const model = deps.model ?? GROQ_MODEL;
  const url = deps.url ?? GROQ_API_URL;
  const doFetch = deps.fetchImpl ?? fetch;
  const sleep = deps.sleep ?? defaultSleep;
  const modelUsed = `groq:${model}`;

  const trimmed = (ocrText || '').trim();
  if (!trimmed) {
    return {
      status: 'api_error',
      modelUsed,
      rawApiError: 'No OCR text to send to Groq.',
      rawModelText: '',
    };
  }
  if (!apiKey) {
    return {
      status: 'api_error',
      modelUsed,
      rawApiError: 'GROQ_API_KEY environment variable is not configured.',
      rawModelText: '',
    };
  }

  const body = buildGroqRequestBody(trimmed, model);
  let lastApiError = 'Groq request failed.';
  let lastRawText = '';

  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS);
    try {
      const response = await doFetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body,
        signal: controller.signal,
      });

      if (!response.ok) {
        let parsed: any = null;
        try {
          parsed = await response.json();
        } catch {
          parsed = null;
        }
        lastApiError = readGroqError(parsed, response.status);
        if (attempt === 0 && isRetryableGroqStatus(response.status)) {
          await sleep(GROQ_RETRY_DELAY_MS);
          continue;
        }
        return { status: 'api_error', modelUsed, rawApiError: lastApiError, rawModelText: lastRawText };
      }

      const data: any = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      lastRawText = typeof content === 'string' ? content : '';

      let parsed: any = null;
      try {
        parsed = JSON.parse(extractJsonString(lastRawText));
      } catch {
        parsed = null;
      }

      const validated = validateExtractedLabel(parsed);
      if (validated) {
        return {
          status: validated.readable ? 'success' : 'unreadable',
          data: validated,
          modelUsed,
          rawModelText: lastRawText,
          rawApiError: '',
        };
      }
      return {
        status: 'parse_error',
        modelUsed,
        rawApiError: 'Groq returned JSON that did not match the label schema.',
        rawModelText: lastRawText,
      };
    } catch (err: any) {
      const aborted = err?.name === 'AbortError';
      lastApiError = aborted
        ? `Groq timed out after ${GROQ_TIMEOUT_MS / 1000}s.`
        : String(err?.message || err).slice(0, 300);
      if (attempt === 0) {
        await sleep(GROQ_RETRY_DELAY_MS);
        continue;
      }
      return { status: 'api_error', modelUsed, rawApiError: lastApiError, rawModelText: lastRawText };
    } finally {
      clearTimeout(timer);
    }
  }

  return { status: 'api_error', modelUsed, rawApiError: lastApiError, rawModelText: lastRawText };
}

export interface GroqHealth {
  ok: boolean;
  modelUsed: string;
  latencyMs: number;
  rawError: string | null;
}

/**
 * One short text-only call, used by /api/health/model so the deployment can be
 * checked before a demo without scanning a label.
 */
export async function checkGroqHealth(
  deps: GroqDeps = {}
): Promise<GroqHealth> {
  const started = Date.now();
  const apiKey = deps.apiKey ?? GROQ_API_KEY;
  const model = deps.model ?? GROQ_MODEL;
  const url = deps.url ?? GROQ_API_URL;
  const doFetch = deps.fetchImpl ?? fetch;
  const modelUsed = `groq:${model}`;

  if (!apiKey) {
    return {
      ok: false,
      modelUsed,
      latencyMs: 0,
      rawError: 'GROQ_API_KEY environment variable is not configured.',
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await doFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0,
        reasoning_effort: 'low',
        max_completion_tokens: 16,
        messages: [{ role: 'user', content: 'Reply with OK' }],
      }),
      signal: controller.signal,
    });
    const latencyMs = Date.now() - started;
    if (!response.ok) {
      let body: any = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }
      return { ok: false, modelUsed, latencyMs, rawError: readGroqError(body, response.status) };
    }
    await response.json();
    return { ok: true, modelUsed, latencyMs, rawError: null };
  } catch (err: any) {
    return {
      ok: false,
      modelUsed,
      latencyMs: Date.now() - started,
      rawError: err?.name === 'AbortError' ? 'Groq health check timed out.' : String(err?.message || err).slice(0, 300),
    };
  } finally {
    clearTimeout(timer);
  }
}
