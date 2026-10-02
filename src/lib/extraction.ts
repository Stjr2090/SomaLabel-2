import { GoogleGenAI } from '@google/genai';
import { MODEL_ID } from './config.ts';
import { GEMINI_API_KEY } from './server-env.ts';
import { ExtractedLabel } from './types.ts';

const EXTRACTION_INSTRUCTIONS = `You are SomaLabel's medicine label extraction engine.
Analyze the attached medicine package or label image and output factual information matching ONLY this exact JSON schema:
{
  "readable": boolean,
  "product_name": string | null,
  "active_ingredients": [ { "name": string, "strength": string | null } ],
  "dosage_form": string | null,
  "manufacturer": string | null,
  "batch_number": string | null,
  "manufacture_date_raw": string | null,
  "expiry_date_raw": string | null,
  "registration_number": string | null,
  "printed_warnings": [ string ],
  "printed_directions": string | null,
  "label_language": string | null,
  "plain_explanation_en": string
}

RULES:
1. Copy dates, numbers, registration numbers, batch codes, and names EXACTLY as printed.
2. Use null for anything not visible. Never guess.
3. Never add dosage, frequency, or usage advice that is not printed explicitly on the label.
4. plain_explanation_en must be 3 to 5 short sentences in simple English for an ordinary patient:
   - What the medicine is (and what it is for only if the label states it)
   - How to take it ONLY as printed on the label
   - Key printed warnings (such as keeping away from children or not exceeding dosage)
5. If the photo is too blurry, dark, cut off, or is not a medicine label, set "readable": false and explain in plain_explanation_en that the label could not be read clearly.
6. Return ONLY the raw JSON object. Do not include markdown code fences or conversational text.`;

/**
 * Strips code fences and surrounding text before JSON parsing.
 */
export function extractJsonString(rawText: string): string {
  if (!rawText || typeof rawText !== 'string') return '';
  let text = rawText.trim();

  // Find first { and last }
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    text = text.substring(firstBrace, lastBrace + 1);
  } else {
    // Strip markdown code fences if no braces found
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  }

  return text.trim();
}

/**
 * Validates that an object conforms to the required ExtractedLabel shape.
 */
export function validateExtractedLabel(obj: any): ExtractedLabel | null {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;

  if (typeof obj.readable !== 'boolean') return null;

  if (!obj.readable) {
    return {
      readable: false,
      product_name: typeof obj.product_name === 'string' ? obj.product_name : null,
      active_ingredients: Array.isArray(obj.active_ingredients) ? obj.active_ingredients : [],
      dosage_form: typeof obj.dosage_form === 'string' ? obj.dosage_form : null,
      manufacturer: typeof obj.manufacturer === 'string' ? obj.manufacturer : null,
      batch_number: typeof obj.batch_number === 'string' ? obj.batch_number : null,
      manufacture_date_raw: typeof obj.manufacture_date_raw === 'string' ? obj.manufacture_date_raw : null,
      expiry_date_raw: typeof obj.expiry_date_raw === 'string' ? obj.expiry_date_raw : null,
      registration_number: typeof obj.registration_number === 'string' ? obj.registration_number : null,
      printed_warnings: Array.isArray(obj.printed_warnings) ? obj.printed_warnings.map(String) : [],
      printed_directions: typeof obj.printed_directions === 'string' ? obj.printed_directions : null,
      label_language: typeof obj.label_language === 'string' ? obj.label_language : null,
      plain_explanation_en: typeof obj.plain_explanation_en === 'string'
        ? obj.plain_explanation_en
        : "We couldn't read this label clearly. Try again in good light, with the label flat and close up.",
    };
  }

  const ingredients: Array<{ name: string; strength: string | null }> = [];
  if (Array.isArray(obj.active_ingredients)) {
    for (const item of obj.active_ingredients) {
      if (item && typeof item === 'object' && typeof item.name === 'string') {
        ingredients.push({
          name: item.name,
          strength: typeof item.strength === 'string' ? item.strength : null,
        });
      }
    }
  }

  const warnings: string[] = [];
  if (Array.isArray(obj.printed_warnings)) {
    for (const w of obj.printed_warnings) {
      if (typeof w === 'string' && w.trim()) {
        warnings.push(w.trim());
      }
    }
  }

  return {
    readable: true,
    product_name: typeof obj.product_name === 'string' ? obj.product_name : null,
    active_ingredients: ingredients,
    dosage_form: typeof obj.dosage_form === 'string' ? obj.dosage_form : null,
    manufacturer: typeof obj.manufacturer === 'string' ? obj.manufacturer : null,
    batch_number: typeof obj.batch_number === 'string' ? obj.batch_number : null,
    manufacture_date_raw: typeof obj.manufacture_date_raw === 'string' ? obj.manufacture_date_raw : null,
    expiry_date_raw: typeof obj.expiry_date_raw === 'string' ? obj.expiry_date_raw : null,
    registration_number: typeof obj.registration_number === 'string' ? obj.registration_number : null,
    printed_warnings: warnings,
    printed_directions: typeof obj.printed_directions === 'string' ? obj.printed_directions : null,
    label_language: typeof obj.label_language === 'string' ? obj.label_language : null,
    plain_explanation_en: typeof obj.plain_explanation_en === 'string' && obj.plain_explanation_en.trim()
      ? obj.plain_explanation_en.trim()
      : 'This is a medicine package. Confirm usage with a healthcare professional.',
  };
}

export type ExtractionStatus = 'success' | 'unreadable' | 'api_error' | 'rejection' | 'parse_error';

export interface ExtractionResult {
  status: ExtractionStatus;
  data?: ExtractedLabel;
  modelUsed: string;
  rawModelText?: string;
  rawApiError?: string;
  rejectedByGemma?: boolean;
}

export const PRIMARY_MODEL_DEFAULT = 'gemma-4-26b-a4b-it';
export const ALTERNATE_MODEL_DEFAULT = 'gemma-4-31b-it';
export const RETRY_DELAY_MS = 2000;
export const REQUEST_TIMEOUT_MS = 30000;

/**
 * Returns [primary, alternate] using MODEL_ID as primary.
 * Only Gemma 4 open-weight models are allowed.
 */
export function getPrimaryAndAlternate(): [string, string] {
  const configured = MODEL_ID || PRIMARY_MODEL_DEFAULT;
  const primary =
    configured === ALTERNATE_MODEL_DEFAULT ? ALTERNATE_MODEL_DEFAULT : PRIMARY_MODEL_DEFAULT;
  const alternate = primary === PRIMARY_MODEL_DEFAULT ? ALTERNATE_MODEL_DEFAULT : PRIMARY_MODEL_DEFAULT;
  return [primary, alternate];
}

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(() => resolve(), ms));

/**
 * True only for 429, 500 or 503.
 */
export function isRetryableError(err: any): boolean {
  if (!err) return false;
  const status = err.status ?? err.code ?? err.statusCode;
  if (status === 429 || status === 500 || status === 503) return true;
  if (typeof status === 'string') {
    const n = Number(status);
    if (n === 429 || n === 500 || n === 503) return true;
  }

  const msg = String(err.message || err).toLowerCase();
  // Only treat as retryable when the message names one of the three codes.
  // Avoid matching bare substrings inside other numbers where possible.
  if (/(^|[^0-9])(429|500|503)([^0-9]|$)/.test(msg)) return true;
  return false;
}

/**
 * Invokes generateContent for a specific model without system instruction or JSON response mode.
 * Instructions are placed in the user prompt and logged with the exact model ID.
 */
async function callModel(
  ai: GoogleGenAI,
  modelId: string,
  base64Data: string,
  mimeType: string
): Promise<{ text: string }> {
  // Requirement: Log the exact model ID used in every generateContent call
  console.log(`[extractMedicineLabel] Calling model: ${modelId}`);

  const userPrompt = `${EXTRACTION_INSTRUCTIONS}\n\nPlease inspect the attached medicine label image and produce ONLY the valid JSON output.`;

  const contents = [
    {
      role: 'user',
      parts: [
        {
          inlineData: {
            mimeType,
            data: base64Data.replace(/^data:image\/\w+;base64,/, ''),
          },
        },
        {
          text: userPrompt,
        },
      ],
    },
  ];

  // Do not use system instruction or JSON response mode for Gemma models
  const response = await ai.models.generateContent({
    model: modelId,
    contents,
  });

  return { text: response.text || '' };
}

export type ModelTextCaller = (modelId: string) => Promise<string>;

/**
 * Core retry orchestration. Worst case is 3 model calls:
 * primary attempt, one retry on 429/500/503 after RETRY_DELAY_MS, then one alternate attempt.
 */
export async function extractWithCaller(
  caller: ModelTextCaller,
  primary: string,
  alternate: string,
  sleep: (ms: number) => Promise<void> = delay
): Promise<ExtractionResult> {
  let lastError: any = null;
  let lastRawText = '';
  let modelUsed = primary;

  const tryOnce = async (modelId: string): Promise<ExtractionResult | null> => {
    modelUsed = modelId;
    const text = await caller(modelId);
    lastRawText = text;
    const cleanJson = extractJsonString(text);
    const parsed = JSON.parse(cleanJson);
    const validated = validateExtractedLabel(parsed);
    if (validated) {
      return {
        status: validated.readable ? 'success' : 'unreadable',
        data: validated,
        modelUsed: modelId,
        rawModelText: text,
        rawApiError: '',
      };
    }
    lastError = new Error(`Model ${modelId} output did not match expected JSON schema.`);
    return null;
  };

  // Attempt 1: primary
  try {
    const done = await tryOnce(primary);
    if (done) return done;
  } catch (err: any) {
    lastError = err;
    // Retryable? wait then attempt 2 on primary.
    if (isRetryableError(err)) {
      await sleep(RETRY_DELAY_MS);
      try {
        const done = await tryOnce(primary);
        if (done) return done;
      } catch (retryErr: any) {
        lastError = retryErr;
      }
    }
  }

  // If the first attempt failed with a validation error (no throw), lastError is set
  // but we still fall through to the alternate. If first attempt threw a
  // non-retryable error, we also fall through directly to the alternate.

  // Attempt 3 (at most): alternate model, exactly once.
  try {
    const done = await tryOnce(alternate);
    if (done) return done;
  } catch (err: any) {
    lastError = err;
  }

  const errorDetails = lastError
    ? typeof lastError === 'object'
      ? JSON.stringify(lastError, Object.getOwnPropertyNames(lastError))
      : String(lastError)
    : 'All model attempts failed.';

  return {
    status: 'api_error',
    modelUsed,
    rawApiError: errorDetails,
    rawModelText: lastRawText || '(No model text generated)',
  };
}

/**
 * Executes medicine label extraction with open-weight Gemma 4 models only:
 * 1. Primary model (MODEL_ID) with at most one retry on 429/500/503 after 2s.
 * 2. Then a single attempt on the alternate Gemma 4 model.
 * 3. Otherwise returns api_error. No closed-model fallback.
 */
export async function extractMedicineLabel(
  base64ImageData: string,
  mimeType: string = 'image/jpeg'
): Promise<ExtractionResult> {
  if (!GEMINI_API_KEY) {
    return {
      status: 'api_error',
      modelUsed: MODEL_ID,
      rawApiError: 'GEMINI_API_KEY environment variable is not configured.',
      rawModelText: '',
    };
  }

  const ai = new GoogleGenAI({
    apiKey: GEMINI_API_KEY,
    httpOptions: {
      timeout: REQUEST_TIMEOUT_MS,
    },
  });

  const [primaryGemma, alternateGemma] = getPrimaryAndAlternate();

  console.log(`[extractMedicineLabel] Attempting primary model: ${primaryGemma}`);
  const caller: ModelTextCaller = async (modelId: string) => {
    const { text } = await callModel(ai, modelId, base64ImageData, mimeType);
    return text;
  };

  return extractWithCaller(caller, primaryGemma, alternateGemma);
}
