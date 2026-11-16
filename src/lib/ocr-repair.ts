/**
 * Repair of OCR character confusion in printed numbers.
 *
 * Tesseract regularly swaps letters for digits on medicine packs:
 * "NDA/MAL/HPD/0189" is read as "@189" or "O189", and "02/2027" as "O2/2O27".
 * Only whole tokens that become pure digits are rewritten, so words such as
 * MAR, NDA, MAL or HPD are never touched.
 */

const OCR_DIGIT_SYMBOLS: Record<string, string> = {
  O: '0',
  Q: '0',
  I: '1',
  L: '1',
  S: '5',
  B: '8',
  Z: '2',
  G: '6',
  '@': '0',
  $: '5',
};

export function normalizeOcrDigits(value: string): string {
  if (!value || typeof value !== 'string') return value;
  return value
    .toUpperCase()
    .replace(/[A-Z0-9@$]+/g, (token) => {
      if (!/[A-Z@$]/.test(token)) return token;
      const mapped = token.replace(/[A-Z@$]/g, (ch) => OCR_DIGIT_SYMBOLS[ch] ?? ch);
      return /^\d+$/.test(mapped) ? mapped : token;
    });
}
