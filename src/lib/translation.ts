import { GoogleGenAI } from '@google/genai';
import { MODEL_ID } from './config.ts';
import { GEMINI_API_KEY, SUNBIRD_API_KEY, SUNBIRD_API_URL } from './server-env.ts';
import { TranslationResult } from './types.ts';

// In-memory cache for translations during the session
const translationCache = new Map<string, TranslationResult>();

/**
 * High-quality medical translation fallback dictionary for common Ugandan medicine label phrasing
 */
const MEDICAL_PHRASE_MAPPINGS: Array<[RegExp, string]> = [
  [/this medicine is/gi, 'Eddagala lino lye'],
  [/take (\d+) tablet/gi, 'Mira empeke $1'],
  [/take (\d+) capsule/gi, 'Mira kapuso $1'],
  [/take two tablets/gi, 'Mira empeke bbiri'],
  [/take one tablet/gi, 'Mira empeke emu'],
  [/every (\d+) hours/gi, 'buli luvannyuma lwa ssaawa $1'],
  [/with water/gi, 'n\'amazzi amayonjo'],
  [/after food|after meals/gi, 'oluvannyuma lw\'okulya emmere'],
  [/before food|before meals/gi, 'nga tonnalya mmere'],
  [/for headache or fever/gi, 'ery\'omutwe oguluma oba omusujja'],
  [/for pain/gi, 'ery\'obulumi'],
  [/for malaria/gi, 'ery\'omusujja gw\'ensiri (malaria)'],
  [/for bacterial infections/gi, 'ery\'obuwuka (infections)'],
  [/do not take more than/gi, 'Tosukka kumira'],
  [/do not exceed/gi, 'Tosukka kumira'],
  [/keep out of reach of children/gi, 'Liteeke awalala abaana we batayinza kulituukako'],
  [/store in a cool dry place/gi, 'Literekere mu kifo ekirunji ekitanywa kasana era ekitannyogoga nnyo'],
  [/protect from light/gi, 'Likuumire awalala okuva ku musana omungi'],
  [/shake well before use/gi, 'Liseenye bulungi nga tonnakozesa'],
  [/finish the entire course/gi, 'Ggusaayo eddagala lyonna nga musawo bwe yakugambye'],
  [/confirm with a pharmacist or health worker before use/gi, 'Sooka weebuuze ku musawo oba omutunzi w\'eddagala nga tonnalikozesa'],
];

/**
 * Translates medicine instructions to Luganda using rule-based medical dictionary
 */
function translateWithDictionary(englishText: string): string {
  let translated = englishText;
  for (const [regex, replacement] of MEDICAL_PHRASE_MAPPINGS) {
    translated = translated.replace(regex, replacement);
  }
  return translated;
}

const SUNBIRD_TRANSLATE_PATH = '/tasks/translate';

/**
 * Maps the retired /tasks/nllb_translate path to the current /tasks/translate endpoint.
 */
export function resolveSunbirdUrl(url: string): string {
  return url.replace(/\/tasks\/nllb_translate\/?$/, SUNBIRD_TRANSLATE_PATH);
}

/**
 * Reads the translated text from a Sunbird response.
 * Current shape: { output: { translated_text } }. Flat string fields are also accepted.
 */
export function readSunbirdTranslation(data: any): string {
  if (!data || typeof data !== 'object') return '';
  const candidates = [
    data.output?.translated_text,
    typeof data.output === 'string' ? data.output : undefined,
    data.translated_text,
    data.translation,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return '';
}

/**
 * Translates English text to Luganda.
 * 1. If SUNBIRD_API_KEY and SUNBIRD_API_URL are set, calls Sunbird AI translation API.
 * 2. Otherwise falls back to asking the Gemma 4 model for a simple Luganda translation.
 * 3. Includes fallback resilience with a "machine translation" note.
 */
export async function toLuganda(text: string): Promise<TranslationResult> {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      lugandaText: '',
      source: 'fallback',
      note: 'No text provided for translation.',
    };
  }

  // Check in-memory cache
  if (translationCache.has(trimmed)) {
    return translationCache.get(trimmed)!;
  }

  // 1. Try Sunbird AI API if configured
  if (SUNBIRD_API_KEY && SUNBIRD_API_URL) {
    const sunbirdUrl = resolveSunbirdUrl(SUNBIRD_API_URL);
    try {
      const response = await fetch(sunbirdUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUNBIRD_API_KEY}`,
        },
        body: JSON.stringify({
          source_language: 'eng',
          target_language: 'lug',
          text: trimmed,
        }),
      });

      if (!response.ok) {
        console.warn(`[translate] Sunbird returned HTTP ${response.status} from ${sunbirdUrl}`);
      } else {
        const data = await response.json();
        const lugandaText = readSunbirdTranslation(data);
        if (lugandaText) {
          const result: TranslationResult = {
            lugandaText,
            source: 'sunbird',
            note: 'Translated via Sunbird AI (Sunbird AI translation engine for Ugandan languages)',
          };
          translationCache.set(trimmed, result);
          return result;
        }
        console.warn(
          '[translate] Sunbird response had no translated text. Keys:',
          data && typeof data === 'object' ? Object.keys(data).join(',') : typeof data
        );
      }
    } catch (sunbirdErr: any) {
      console.warn('[translate] Sunbird request failed:', sunbirdErr?.message || sunbirdErr);
    }
  }

  // 2. Fall back to asking Gemma 4 model (open-weight model specified in config)
  if (GEMINI_API_KEY) {
    try {
      const ai = new GoogleGenAI({
        apiKey: GEMINI_API_KEY,
        httpOptions: {
          timeout: 10000,
        },
      });

      const prompt = `You are a medical translator for Uganda. Translate the following plain-language medicine explanation into simple, clear Luganda that an ordinary Ugandan can easily understand.
Keep all brand names, numbers, milligram strengths, and times exact.
Do not add any medical advice not present in the original text.
Provide ONLY the translated Luganda text with no conversational preamble or markdown.

Original English text:
${trimmed}`;

      const response = await ai.models.generateContent({
        model: MODEL_ID,
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
      });

      const translatedLuganda = response.text?.trim();
      if (translatedLuganda && translatedLuganda.length > 5) {
        const result: TranslationResult = {
          lugandaText: translatedLuganda,
          source: 'gemma',
          note: 'Machine translation (Envvuunula ey\'ebyuma)',
        };
        translationCache.set(trimmed, result);
        return result;
      }
    } catch (gemmaErr) {
      console.warn('[translate] Gemma Luganda translation failed:', (gemmaErr as any)?.message || gemmaErr);
    }
  }

  // 3. Resilient medical phrase dictionary translation
  const dictTranslated = translateWithDictionary(trimmed);
  const result: TranslationResult = {
    lugandaText: dictTranslated,
    source: 'fallback',
    note: 'Machine translation (Envvuunula ey\'ebyuma)',
  };
  translationCache.set(trimmed, result);
  return result;
}
