import { ExpiryAnalysis, ExpiryBadgeStatus } from './types.ts';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const MONTH_MAP: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

interface ParsedComponents {
  year: number;
  month: number; // 1-12
  day: number | null; // 1-31 or null for month-only
  isMonthOnly: boolean;
}

/**
 * Normalizes two-digit years to four-digit years (assuming 2000-2099)
 */
function normalizeYear(year: number): number {
  if (year < 100) {
    return 2000 + year;
  }
  return year;
}

/**
 * Returns the last day of a given month (1-indexed) in a given year.
 */
export function getLastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Parses raw expiry date string into structured date components.
 * Handles formats such as:
 * - "EXP 03/2027" -> Month 3, Year 2027
 * - "03/27" -> Month 3, Year 2027
 * - "2027-03" -> Year 2027, Month 3
 * - "MAR 2027" -> Month 3, Year 2027
 * - "12.05.2026" -> Day 12, Month 5, Year 2026
 * - "EXP: 2027/03/31" -> Year 2027, Month 3, Day 31
 */
export function parseRawExpiryString(rawText: string | null | undefined): ParsedComponents | null {
  if (!rawText || typeof rawText !== 'string') return null;

  const cleaned = rawText
    .trim()
    .toUpperCase()
    // Remove common prefixes
    .replace(/^(EXP|EXPIRY|EXP\.? DATE|EXPIRY DATE|EXP DATE|BB|BEST BEFORE|USE BY|USE BEFORE)\s*[:.-]?\s*/i, '')
    .trim();

  if (!cleaned) return null;

  // Pattern 1: ISO Full Date YYYY[-/. ]MM[-/. ]DD (e.g., "2027/03/31" or "2027-03-31" or "2027.03.31")
  const ymdFullMatch = cleaned.match(/^(\d{4})[-/. ](\d{1,2})[-/. ](\d{1,2})$/);
  if (ymdFullMatch) {
    const year = parseInt(ymdFullMatch[1], 10);
    const month = parseInt(ymdFullMatch[2], 10);
    const day = parseInt(ymdFullMatch[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { year, month, day, isMonthOnly: false };
    }
  }

  // Pattern 2: Day-Month-Year Full Date DD[-/. ]MM[-/. ]YYYY (e.g., "12.05.2026", "12/05/2026", "12-05-2026")
  const dmyFullMatch = cleaned.match(/^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{4})$/);
  if (dmyFullMatch) {
    const day = parseInt(dmyFullMatch[1], 10);
    const month = parseInt(dmyFullMatch[2], 10);
    const year = parseInt(dmyFullMatch[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { year, month, day, isMonthOnly: false };
    }
  }

  // Pattern 3: Month Word with Year (e.g., "MAR 2027", "MARCH 2027", "MAR-2027", "MAR/27")
  const monthWordMatch = cleaned.match(/^([A-Z]{3,9})[-/. ]+(\d{2,4})$/);
  if (monthWordMatch) {
    const word = monthWordMatch[1].toLowerCase();
    const month = MONTH_MAP[word];
    let year = parseInt(monthWordMatch[2], 10);
    if (month && !isNaN(year)) {
      year = normalizeYear(year);
      return { year, month, day: null, isMonthOnly: true };
    }
  }

  // Pattern 4: Day with Month Word and Year (e.g., "15 MAR 2027", "15-MAR-2027", "15-MAR-27")
  const dayMonthWordMatch = cleaned.match(/^(\d{1,2})[-/. ]+([A-Z]{3,9})[-/. ]+(\d{2,4})$/);
  if (dayMonthWordMatch) {
    const day = parseInt(dayMonthWordMatch[1], 10);
    const word = dayMonthWordMatch[2].toLowerCase();
    const month = MONTH_MAP[word];
    let year = parseInt(dayMonthWordMatch[3], 10);
    if (month && !isNaN(year) && day >= 1 && day <= 31) {
      year = normalizeYear(year);
      return { year, month, day, isMonthOnly: false };
    }
  }

  // Pattern 5: Year-Month (e.g., "2027-03", "2027/03", "2027.03")
  const ymMatch = cleaned.match(/^(\d{4})[-/. ](\d{1,2})$/);
  if (ymMatch) {
    const year = parseInt(ymMatch[1], 10);
    const month = parseInt(ymMatch[2], 10);
    if (month >= 1 && month <= 12) {
      return { year, month, day: null, isMonthOnly: true };
    }
  }

  // Pattern 6: Month-Year (e.g., "03/2027", "03-2027", "03.2027", "03/27", "3/27")
  const myMatch = cleaned.match(/^(\d{1,2})[-/. ](\d{2,4})$/);
  if (myMatch) {
    const month = parseInt(myMatch[1], 10);
    let year = parseInt(myMatch[2], 10);
    if (month >= 1 && month <= 12) {
      year = normalizeYear(year);
      return { year, month, day: null, isMonthOnly: true };
    }
  }

  // Pattern 7: Embedded Month Word within string (e.g. "EXP: 31 MAR 2027")
  const embeddedDayMonthWord = cleaned.match(/(\d{1,2})\s*[-/. ]\s*([A-Z]{3,9})\s*[-/. ]\s*(\d{2,4})/);
  if (embeddedDayMonthWord) {
    const day = parseInt(embeddedDayMonthWord[1], 10);
    const word = embeddedDayMonthWord[2].toLowerCase();
    const month = MONTH_MAP[word];
    let year = parseInt(embeddedDayMonthWord[3], 10);
    if (month && !isNaN(year) && day >= 1 && day <= 31) {
      year = normalizeYear(year);
      return { year, month, day, isMonthOnly: false };
    }
  }

  return null;
}

/**
 * Evaluates the expiry date against a reference date (defaults to current time).
 * Produces the required status badge and plain-English description.
 */
export function analyzeExpiry(
  rawExpiry: string | null | undefined,
  referenceDate: Date = new Date()
): ExpiryAnalysis {
  const parsed = parseRawExpiryString(rawExpiry);

  if (!parsed) {
    return {
      status: 'not_found',
      badgeLabel: 'Expiry date not found',
      color: 'grey',
      words: 'Expiry date not found on label',
      parsedDate: null,
      daysRemaining: null,
      raw: rawExpiry || null,
    };
  }

  const { year, month, isMonthOnly } = parsed;
  const monthName = MONTH_NAMES[month - 1];

  let finalDay: number;
  if (isMonthOnly || parsed.day === null) {
    finalDay = getLastDayOfMonth(year, month);
  } else {
    finalDay = parsed.day;
  }

  // Set expiry timestamp to end of that calendar day (23:59:59.999 UTC)
  const expiryTimestamp = new Date(Date.UTC(year, month - 1, finalDay, 23, 59, 59, 999));
  const expiryIso = expiryTimestamp.toISOString();

  // Normalize reference date to UTC for consistent day difference
  const refMs = referenceDate.getTime();
  const diffMs = expiryTimestamp.getTime() - refMs;
  const daysRemaining = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const isExpired = diffMs < 0;

  // Formatting date in words: e.g. "Expires end of March 2027" or "Expires 31 March 2027"
  let words: string;
  if (isMonthOnly) {
    if (isExpired) {
      words = `Expired end of ${monthName} ${year}`;
    } else {
      words = `Expires end of ${monthName} ${year}`;
    }
  } else {
    if (isExpired) {
      words = `Expired ${finalDay} ${monthName} ${year}`;
    } else {
      words = `Expires ${finalDay} ${monthName} ${year}`;
    }
  }

  let status: ExpiryBadgeStatus;
  let badgeLabel: 'Expired' | 'Expires within 90 days' | 'Valid' | 'Expiry date not found';
  let color: 'red' | 'amber' | 'green' | 'grey';

  if (isExpired) {
    status = 'expired';
    badgeLabel = 'Expired';
    color = 'red';
  } else if (daysRemaining <= 90) {
    status = 'expiring_soon';
    badgeLabel = 'Expires within 90 days';
    color = 'amber';
  } else {
    status = 'valid';
    badgeLabel = 'Valid';
    color = 'green';
  }

  return {
    status,
    badgeLabel,
    color,
    words,
    parsedDate: expiryIso,
    daysRemaining,
    raw: rawExpiry || null,
  };
}
