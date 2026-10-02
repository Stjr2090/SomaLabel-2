export interface ActiveIngredient {
  name: string;
  strength: string | null;
}

export interface ExtractedLabel {
  readable: boolean;
  product_name: string | null;
  active_ingredients: ActiveIngredient[];
  dosage_form: string | null;
  manufacturer: string | null;
  batch_number: string | null;
  manufacture_date_raw: string | null;
  expiry_date_raw: string | null;
  registration_number: string | null;
  printed_warnings: string[];
  printed_directions: string | null;
  label_language: string | null;
  plain_explanation_en: string;
}

export type ExpiryBadgeStatus = 'expired' | 'expiring_soon' | 'valid' | 'not_found';

export interface ExpiryAnalysis {
  status: ExpiryBadgeStatus;
  badgeLabel: 'Expired' | 'Expires within 90 days' | 'Valid' | 'Expiry date not found';
  color: 'red' | 'amber' | 'green' | 'grey';
  words: string;
  parsedDate: string | null;
  daysRemaining: number | null;
  raw: string | null;
}

export type RegistrationBadgeStatus = 'matched' | 'not_in_list' | 'not_printed';

export interface RegistrationAnalysis {
  status: RegistrationBadgeStatus;
  badgeLabel: 'Matched' | 'Not in our list' | 'Not printed on the label';
  color: 'green' | 'amber' | 'grey';
  matchedProductName: string | null;
  normalizedRegistrationNumber: string | null;
  rawRegistrationNumber: string | null;
  message: string;
}

export interface TranslationResult {
  lugandaText: string;
  source: 'sunbird' | 'gemma' | 'fallback';
  note: string;
}

export interface SomaScanResult {
  extracted: ExtractedLabel;
  expiry: ExpiryAnalysis;
  registration: RegistrationAnalysis;
  translation?: TranslationResult;
  modelUsed: string;
  timestamp: string;
  rawModelText?: string | null;
  rawApiError?: string | null;
}
