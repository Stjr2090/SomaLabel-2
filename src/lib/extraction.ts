import { GoogleGenAI } from '@google/genai';
import { GEMINI_API_KEY, MODEL_ID } from './config.ts';
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

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Checks if an error qualifies for retry (500, 503, or 429).
 */
function isRetryableError(err: any): boolean {
  if (!err) return false;
  const status = err.status || err.code || err.statusCode;
  if (status === 500 || status === 503 || status === 429) return true;

  const msg = (err.message || '').toLowerCase();
  return (
    msg.includes('500') ||
    msg.includes('503') ||
    msg.includes('429') ||
    msg.includes('internal') ||
    msg.includes('unavailable') ||
    msg.includes('resource_exhausted') ||
    msg.includes('overloaded')
  );
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

/**
 * Executes medicine label extraction with:
 * 1. Primary Gemma 4 model with up to 3 retries on 500, 503, or 429 (waiting 1s, then 2s, then 4s).
 * 2. If all retries fail, switches to the other Gemma 4 model (gemma-4-31b-it <-> gemma-4-26b-a4b-it).
 * 3. If that also fails, falls back to gemini-2.5-flash and sets modelUsed in the response.
 * 4. Places instructions in user prompt (no systemInstruction or JSON response mode for Gemma).
 * 5. Strips code fences and surrounding text before parsing JSON.
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
      headers: { 'User-Agent': 'aistudio-build' },
      timeout: 45000,
    },
  });

  // Determine primary and alternate Gemma 4 models
  const configuredModel = MODEL_ID || 'gemma-4-31b-it';
  const primaryGemma =
    configuredModel === 'gemma-4-26b-a4b-it' ? 'gemma-4-26b-a4b-it' : 'gemma-4-31b-it';
  const alternateGemma =
    primaryGemma === 'gemma-4-31b-it' ? 'gemma-4-26b-a4b-it' : 'gemma-4-31b-it';
  const ultimateFallback = 'gemini-2.5-flash';

  const retryDelays = [1000, 2000, 4000]; // 1s, 2s, 4s

  let lastError: any = null;
  let lastRawText = '';
  let modelUsed = primaryGemma;

  // STEP 1: Try Primary Gemma 4 model with up to 3 retries on 500, 503, or 429
  console.log(`[extractMedicineLabel] Attempting primary model: ${primaryGemma}`);
  for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
    try {
      modelUsed = primaryGemma;
      const { text } = await callModel(ai, primaryGemma, base64ImageData, mimeType);
      lastRawText = text;

      const cleanJson = extractJsonString(text);
      const parsed = JSON.parse(cleanJson);
      const validated = validateExtractedLabel(parsed);

      if (validated) {
        return {
          status: validated.readable ? 'success' : 'unreadable',
          data: validated,
          modelUsed: primaryGemma,
          rawModelText: text,
          rawApiError: '',
        };
      }
      // If JSON was not valid, record for retry
      lastError = new Error('Model output did not match expected JSON schema.');
    } catch (err: any) {
      lastError = err;
      console.warn(`[extractMedicineLabel] Primary model ${primaryGemma} attempt ${attempt + 1} error:`, err?.message || err);

      // Check if retryable (500, 503, 429) and attempts remaining
      if (attempt < retryDelays.length && isRetryableError(err)) {
        const waitMs = retryDelays[attempt];
        console.log(`[extractMedicineLabel] Retrying ${primaryGemma} in ${waitMs / 1000}s...`);
        await delay(waitMs);
        continue;
      }

      // If not retryable or max retries reached, break to alternate model
      break;
    }
  }

  // STEP 2: If primary Gemma retries all failed, try once more with the other Gemma 4 model
  console.log(`[extractMedicineLabel] Primary model failed. Trying alternate Gemma model: ${alternateGemma}`);
  try {
    modelUsed = alternateGemma;
    const { text } = await callModel(ai, alternateGemma, base64ImageData, mimeType);
    lastRawText = text;

    const cleanJson = extractJsonString(text);
    const parsed = JSON.parse(cleanJson);
    const validated = validateExtractedLabel(parsed);

    if (validated) {
      return {
        status: validated.readable ? 'success' : 'unreadable',
        data: validated,
        modelUsed: alternateGemma,
        rawModelText: text,
        rawApiError: '',
      };
    }
    lastError = new Error(`Alternate model ${alternateGemma} output was not valid JSON.`);
  } catch (err: any) {
    lastError = err;
    console.warn(`[extractMedicineLabel] Alternate model ${alternateGemma} failed:`, err?.message || err);
  }

  // STEP 3: If alternate Gemma also fails, fall back to gemini-2.5-flash
  console.log(`[extractMedicineLabel] Gemma models failed. Falling back to: ${ultimateFallback}`);
  try {
    modelUsed = ultimateFallback;
    const { text } = await callModel(ai, ultimateFallback, base64ImageData, mimeType);
    lastRawText = text;

    const cleanJson = extractJsonString(text);
    const parsed = JSON.parse(cleanJson);
    const validated = validateExtractedLabel(parsed);

    if (validated) {
      return {
        status: validated.readable ? 'success' : 'unreadable',
        data: validated,
        modelUsed: ultimateFallback,
        rawModelText: text,
        rawApiError: '',
      };
    }
    lastError = new Error(`Fallback model ${ultimateFallback} output was not valid JSON.`);
  } catch (err: any) {
    lastError = err;
    console.error(`[extractMedicineLabel] Ultimate fallback ${ultimateFallback} also failed:`, err?.message || err);
  }

  // If ALL attempts failed, return final failure with full debug details
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
