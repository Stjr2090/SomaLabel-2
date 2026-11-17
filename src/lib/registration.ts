import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { RegistrationAnalysis, RegistrationBadgeStatus } from './types.ts';
import { normalizeOcrDigits } from './ocr-repair.ts';

export interface NDARecord {
  registration_number: string;
  product_name: string;
  dosage_form?: string;
  strength?: string;
  manufacturer?: string;
  status?: string;
  note?: string;
}

// In-memory cache of the seed database
let cachedSeed: NDARecord[] | null = null;

/**
 * Normalizes a registration string by stripping all whitespace and converting to lowercase.
 * Example: "NDA / MAL / HPD / 0189" -> "nda/mal/hpd/0189"
 */
export function normalizeRegistrationNumber(raw: string | null | undefined): string {
  if (!raw || typeof raw !== 'string') return '';
  // Repair OCR confusion first: on the demo packs "0189" is often read "@189".
  return normalizeOcrDigits(raw).replace(/\s+/g, '').toLowerCase();
}

/**
 * Finds a printed NDA/UG registration code in raw OCR text.
 *
 * Used only when the model does not return one: the code has a fixed printed
 * shape ("NDA/MAL/HPD/0189", "NDA/MED/2024/0912", "UG/MED/9981-SAMPLE"), and
 * the model intermittently drops it when it shares a line with EXP/MFG/BATCH.
 */
export function recoverRegistrationNumber(rawText: string | null | undefined): string | null {
  if (!rawText || typeof rawText !== 'string') return null;
  const match = rawText.match(/\b(?:NDA|UG)\s*[/|-]\s*[A-Z]{3}(?:\s*[/|-]\s*[A-Z0-9@$]+){1,4}/i);
  if (!match) return null;
  return match[0].replace(/\s+/g, '').toUpperCase();
}

/**
 * Loads the local NDA seed records from data/nda_seed.json.
 */
export function loadNDASeed(): NDARecord[] {
  if (cachedSeed) return cachedSeed;

  const possiblePaths = [
    path.resolve(process.cwd(), 'data/nda_seed.json'),
    path.resolve(process.cwd(), '../data/nda_seed.json'),
    '/data/nda_seed.json',
  ];

  for (const p of possiblePaths) {
    if (existsSync(p)) {
      try {
        const content = readFileSync(p, 'utf-8');
        cachedSeed = JSON.parse(content);
        return cachedSeed!;
      } catch (e) {
        console.error('Failed reading NDA seed file at', p, e);
      }
    }
  }

  // Fallback default in-memory demo records if file read fails
  return [
    {
      registration_number: "NDA/MAL/HPD/0189",
      product_name: "Paracetamol 500mg Tablets (Kampala Pharma Demo Pack)",
    },
    {
      registration_number: "NDA/MAL/HPD/0421",
      product_name: "Coartem 20/120mg Dispersible Tablets (QCIL Demo Pack)",
    },
    {
      registration_number: "NDA/MED/2024/0912",
      product_name: "Amoxicillin 250mg Capsules (Abacus Demo Pack)",
    },
  ];
}

/**
 * Checks a registration number against the local NDA seed records.
 */
export function lookupRegistration(
  rawRegistrationNumber: string | null | undefined,
  seedRecords: NDARecord[] = loadNDASeed()
): RegistrationAnalysis {
  const trimmed = rawRegistrationNumber?.trim() || '';

  if (!trimmed) {
    return {
      status: 'not_printed',
      badgeLabel: 'Not printed on the label',
      color: 'grey',
      matchedProductName: null,
      normalizedRegistrationNumber: null,
      rawRegistrationNumber: null,
      message: 'Registration number not printed or not visible on the label.',
    };
  }

  const normalizedInput = normalizeRegistrationNumber(trimmed);

  // Exact normalized match or alphanumeric match
  const matched = seedRecords.find((record) => {
    const normRecord = normalizeRegistrationNumber(record.registration_number);
    if (normRecord === normalizedInput) return true;
    // Also support match if slashes or dashes vary slightly
    const cleanRecord = normRecord.replace(/[^a-z0-9]/g, '');
    const cleanInput = normalizedInput.replace(/[^a-z0-9]/g, '');
    return cleanRecord.length >= 6 && cleanRecord === cleanInput;
  });

  if (matched) {
    return {
      status: 'matched',
      badgeLabel: 'Matched',
      color: 'green',
      matchedProductName: matched.product_name,
      normalizedRegistrationNumber: normalizedInput,
      rawRegistrationNumber: trimmed,
      message: `Verified in demo list: ${matched.product_name}`,
    };
  }

  return {
    status: 'not_in_list',
    badgeLabel: 'Not in our list',
    color: 'amber',
    matchedProductName: null,
    normalizedRegistrationNumber: normalizedInput,
    rawRegistrationNumber: trimmed,
    message: 'Not in our demo list. Check with NDA or a pharmacist.',
  };
}
