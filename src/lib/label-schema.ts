import { ExtractedLabel } from './types.ts';

/**
 * Shared label schema helpers.
 *
 * Kept separate from extraction.ts so that any label reader (Gemma via the
 * Gemini API, Groq, or a test double) validates model output the same way,
 * without creating an import cycle between providers.
 */

/**
 * Some models emit narrow no-break spaces and non-breaking hyphens around
 * numbers ("500 mg", "24‑hour"). They look like boxes on some Android
 * fonts and break copy/paste, so label text is stored with normal characters.
 */
export function normalizeTypography(value: string): string {
  return value
    .replace(/[\u00A0\u202F\u2007\u2009]/g, " ")
    .replace(/[\u2010\u2011\u2012\u2013]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/** String field or null, with typographic characters normalized. */
function textOrNull(value: unknown): string | null {
  return typeof value === "string" ? normalizeTypography(value) : null;
}

export const MAX_LABEL_TEXT_LENGTH = 5000;
export const MIN_TEXT_LENGTH = 15;

export const UNREADABLE_NOTICE =
  "We couldn't read this label clearly. Try again in good light, with the label flat and close up.";

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
      product_name: textOrNull(obj.product_name),
      active_ingredients: Array.isArray(obj.active_ingredients) ? obj.active_ingredients : [],
      dosage_form: textOrNull(obj.dosage_form),
      manufacturer: textOrNull(obj.manufacturer),
      batch_number: textOrNull(obj.batch_number),
      manufacture_date_raw: textOrNull(obj.manufacture_date_raw),
      expiry_date_raw: textOrNull(obj.expiry_date_raw),
      registration_number: textOrNull(obj.registration_number),
      printed_warnings: Array.isArray(obj.printed_warnings) ? obj.printed_warnings.map((w: unknown) => normalizeTypography(String(w))) : [],
      printed_directions: textOrNull(obj.printed_directions),
      label_language: textOrNull(obj.label_language),
      plain_explanation_en: typeof obj.plain_explanation_en === 'string'
        ? normalizeTypography(obj.plain_explanation_en)
        : UNREADABLE_NOTICE,
    };
  }

  const ingredients: Array<{ name: string; strength: string | null }> = [];
  if (Array.isArray(obj.active_ingredients)) {
    for (const item of obj.active_ingredients) {
      if (item && typeof item === 'object' && typeof item.name === 'string') {
        ingredients.push({
          name: normalizeTypography(item.name),
          strength: textOrNull(item.strength),
        });
      }
    }
  }

  const warnings: string[] = [];
  if (Array.isArray(obj.printed_warnings)) {
    for (const w of obj.printed_warnings) {
      if (typeof w === 'string' && w.trim()) {
        warnings.push(normalizeTypography(w));
      }
    }
  }

  return {
    readable: true,
    product_name: textOrNull(obj.product_name),
    active_ingredients: ingredients,
    dosage_form: textOrNull(obj.dosage_form),
    manufacturer: textOrNull(obj.manufacturer),
    batch_number: textOrNull(obj.batch_number),
    manufacture_date_raw: textOrNull(obj.manufacture_date_raw),
    expiry_date_raw: textOrNull(obj.expiry_date_raw),
    registration_number: textOrNull(obj.registration_number),
    printed_warnings: warnings,
    printed_directions: textOrNull(obj.printed_directions),
    label_language: textOrNull(obj.label_language),
    plain_explanation_en: typeof obj.plain_explanation_en === 'string' && obj.plain_explanation_en.trim()
      ? normalizeTypography(obj.plain_explanation_en)
      : 'This is a medicine package. Confirm usage with a healthcare professional.',
  };
}

/**
 * True when OCR text looks like real label copy rather than glare, a finger,
 * or a handful of stray characters. Used to decide whether the photo still
 * needs to go to a vision model.
 */
export function hasUsableLabelText(text: string): boolean {
  const trimmed = (text || '').trim();
  if (trimmed.length < MIN_TEXT_LENGTH) return false;

  const words = trimmed.split(/\s+/).filter((w) => /[A-Za-z]{2,}/.test(w));
  const lettersAndDigits = (trimmed.match(/[A-Za-z0-9]/g) || []).length;
  const ratio = lettersAndDigits / trimmed.length;

  return trimmed.length >= 20 && words.length >= 2 && ratio >= 0.5;
}
