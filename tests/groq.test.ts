import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGroqRequestBody,
  extractWithGroq,
  readGroqError,
  isRetryableGroqStatus,
  GROQ_TIMEOUT_MS,
} from '../src/lib/groq.ts';
import { hasUsableLabelText, validateExtractedLabel } from '../src/lib/label-schema.ts';
import { analyzeExpiry, normalizeOcrDigits } from '../src/lib/expiry.ts';
import { lookupRegistration, normalizeRegistrationNumber, recoverRegistrationNumber } from '../src/lib/registration.ts';
import { recoverMissedFields } from '../src/lib/extraction.ts';

const LABEL = {
  readable: true,
  product_name: 'PARACETAMOL 500mg TABLETS',
  active_ingredients: [{ name: 'Paracetamol', strength: '500mg' }],
  dosage_form: 'TABLETS',
  manufacturer: 'Kampala Pharmaceutical Industries 1996 Ltd',
  batch_number: 'PCM2401',
  manufacture_date_raw: '03/2024',
  expiry_date_raw: '02/2027',
  registration_number: 'NDA/MAL/HPD/0189',
  printed_warnings: ['Keep out of reach of children.'],
  printed_directions: 'Take 1 tablet every 6 hours after food.',
  label_language: 'English',
  plain_explanation_en: 'This medicine is paracetamol 500mg tablets.',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function chatResponse(content: string): Response {
  return jsonResponse({
    id: 'chatcmpl-test',
    choices: [{ index: 0, message: { role: 'assistant', content } }],
  });
}

const noSleep = async () => {};

test('groq request: json schema, temperature 0, low reasoning, text payload', () => {
  const body = JSON.parse(buildGroqRequestBody('PARACETAMOL 500mg'));
  assert.equal(body.temperature, 0);
  assert.equal(body.reasoning_effort, 'low');
  assert.equal(body.response_format.type, 'json_schema');
  assert.equal(body.response_format.json_schema.strict, true);
  assert.equal(body.messages[0].role, 'system');
  assert.match(body.messages[1].content, /PARACETAMOL 500mg/);
  // No image parts anywhere: Groq only ever receives text.
  assert.equal(JSON.stringify(body).includes('inlineData'), false);
});

test('groq request: long OCR text is capped at 5000 characters', () => {
  const body = JSON.parse(buildGroqRequestBody('A'.repeat(9000)));
  assert.ok(body.messages[1].content.length < 5200);
});

test('groq success: valid JSON becomes a successful ExtractionResult', async () => {
  const result = await extractWithGroq('PARACETAMOL 500mg TABLETS', {
    apiKey: 'test-key',
    model: 'openai/gpt-oss-120b',
    sleep: noSleep,
    fetchImpl: async () => chatResponse(JSON.stringify(LABEL)),
  });

  assert.equal(result.status, 'success');
  assert.equal(result.modelUsed, 'groq:openai/gpt-oss-120b');
  assert.equal(result.data?.product_name, LABEL.product_name);
  assert.equal(result.data?.expiry_date_raw, '02/2027');
});

test('groq success: code-fenced JSON is still parsed', async () => {
  const result = await extractWithGroq('label text', {
    apiKey: 'test-key',
    sleep: noSleep,
    fetchImpl: async () => chatResponse('```json\n' + JSON.stringify(LABEL) + '\n```'),
  });
  assert.equal(result.status, 'success');
});

test('groq unreadable: readable:false is reported as unreadable, not an error', async () => {
  const result = await extractWithGroq('blurry photo text', {
    apiKey: 'test-key',
    sleep: noSleep,
    fetchImpl: async () =>
      chatResponse(JSON.stringify({ readable: false, plain_explanation_en: 'Could not read.' })),
  });
  assert.equal(result.status, 'unreadable');
  assert.equal(result.data?.readable, false);
});

test('groq 503: retries once then reports a clean api_error', async () => {
  let calls = 0;
  const result = await extractWithGroq('PARACETAMOL', {
    apiKey: 'test-key',
    sleep: noSleep,
    fetchImpl: async () => {
      calls += 1;
      return jsonResponse({ error: { message: 'upstream overloaded' } }, 503);
    },
  });

  assert.equal(calls, 2);
  assert.equal(result.status, 'api_error');
  assert.match(result.rawApiError || '', /Groq HTTP 503/);
  assert.match(result.rawApiError || '', /upstream overloaded/);
});

test('groq 503 then 200: the retry succeeds', async () => {
  let calls = 0;
  const result = await extractWithGroq('PARACETAMOL', {
    apiKey: 'test-key',
    sleep: noSleep,
    fetchImpl: async () => {
      calls += 1;
      return calls === 1 ? jsonResponse({ error: { message: 'busy' } }, 503) : chatResponse(JSON.stringify(LABEL));
    },
  });

  assert.equal(calls, 2);
  assert.equal(result.status, 'success');
});

test('groq 401: no retry, key is never echoed back', async () => {
  let calls = 0;
  const result = await extractWithGroq('PARACETAMOL', {
    apiKey: 'secret-test-key',
    sleep: noSleep,
    fetchImpl: async () => {
      calls += 1;
      return jsonResponse({ error: { message: 'Invalid API Key' } }, 401);
    },
  });

  assert.equal(calls, 1);
  assert.equal(result.status, 'api_error');
  assert.match(result.rawApiError || '', /Groq HTTP 401/);
  assert.equal((result.rawApiError || '').includes('secret-test-key'), false);
});

test('groq: non-JSON content is a parse_error, not a crash', async () => {
  const result = await extractWithGroq('PARACETAMOL', {
    apiKey: 'test-key',
    sleep: noSleep,
    fetchImpl: async () => chatResponse('I cannot help with that.'),
  });
  assert.equal(result.status, 'parse_error');
});

test('groq: a network failure becomes api_error without throwing', async () => {
  const result = await extractWithGroq('PARACETAMOL', {
    apiKey: 'test-key',
    sleep: noSleep,
    fetchImpl: async () => {
      throw new Error('connect ECONNREFUSED');
    },
  });
  assert.equal(result.status, 'api_error');
  assert.match(result.rawApiError || '', /ECONNREFUSED/);
});

test('groq: missing key and empty text fail fast without a request', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return chatResponse(JSON.stringify(LABEL));
  };

  const noKey = await extractWithGroq('PARACETAMOL', { apiKey: '', fetchImpl, sleep: noSleep });
  assert.equal(noKey.status, 'api_error');
  assert.match(noKey.rawApiError || '', /GROQ_API_KEY/);

  const noText = await extractWithGroq('   ', { apiKey: 'test-key', fetchImpl, sleep: noSleep });
  assert.equal(noText.status, 'api_error');

  assert.equal(calls, 0);
});

test('groq: only 429/500/502/503 are retryable', () => {
  for (const s of [429, 500, 502, 503]) assert.equal(isRetryableGroqStatus(s), true);
  for (const s of [400, 401, 403, 404, 422]) assert.equal(isRetryableGroqStatus(s), false);
});

test('groq: error text is flattened to one short line', () => {
  const msg = readGroqError({ error: { message: 'line one\nline two' } }, 500);
  assert.equal(msg.includes('\n'), false);
  assert.match(msg, /Groq HTTP 500/);
});

test('groq timeout is short enough for a phone demo', () => {
  assert.ok(GROQ_TIMEOUT_MS <= 25000);
});

test('OCR quality gate: real label text passes, noise does not', () => {
  assert.equal(hasUsableLabelText('PARACETAMOL 500mg TABLETS\nBatch No: PCM2401\nExp: 02/2027'), true);
  assert.equal(hasUsableLabelText(''), false);
  assert.equal(hasUsableLabelText('||| /// ...'), false);
  assert.equal(hasUsableLabelText('abc'), false);
  assert.equal(hasUsableLabelText('!@#$%^&*()_+{}|:"?><'), false);
});

test('OCR digit repair: date tokens with letter confusions are recovered', () => {
  assert.equal(normalizeOcrDigits('O2/2027'), '02/2027');
  assert.equal(normalizeOcrDigits('O3/2O27'), '03/2027');
  assert.equal(normalizeOcrDigits('12.OS.2026'), '12.05.2026');
  assert.equal(normalizeOcrDigits('MAR 2027'), 'MAR 2027');
  assert.equal(normalizeOcrDigits('EXP 03/2027'), 'EXP 03/2027');
});

test('expiry: OCR "O2/2027" is a valid date, not "not found"', () => {
  const result = analyzeExpiry('O2/2027', new Date('2026-11-16T00:00:00Z'));
  assert.equal(result.status, 'valid');
  assert.equal(result.parsedDate, '2027-02-28T23:59:59.999Z');
});

test('expiry: OCR "O3/2O27" is read as March 2027', () => {
  const result = analyzeExpiry('O3/2O27', new Date('2026-11-16T00:00:00Z'));
  assert.equal(result.status, 'valid');
  assert.match(result.words, /March 2027/);
});

test('registration: OCR "@189" still matches the demo pack', () => {
  const seed = [
    {
      registration_number: 'NDA/MAL/HPD/0189',
      product_name: 'Paracetamol 500mg Tablets (Demo Pack)',
    },
  ];

  assert.equal(normalizeRegistrationNumber('NDA/MAL/HPD/@189'), 'nda/mal/hpd/0189');

  const matched = lookupRegistration('NDA/MAL/HPD/@189', seed);
  assert.equal(matched.status, 'matched');
  assert.equal(matched.matchedProductName, 'Paracetamol 500mg Tablets (Demo Pack)');

  const stillUnknown = lookupRegistration('UG/MED/9981-SAMPLE', seed);
  assert.equal(stillUnknown.status, 'not_in_list');
});

test('label text: narrow no-break spaces and hyphens are normalized', () => {
  const label = validateExtractedLabel({
    readable: true,
    plain_explanation_en: 'Take 500\u202Fmg, up to 4\u2011hourly.',
  });
  assert.equal(label?.plain_explanation_en, 'Take 500 mg, up to 4-hourly.');
});

test('registration recovery: code on a shared line is found in the OCR text', () => {
  const line = 'BATCH: QCL-7761     MFG: 11/2024     EXP: NOV 2026 NDA: NDA/MAL/HPD/@421';
  assert.equal(recoverRegistrationNumber(line), 'NDA/MAL/HPD/@421');
  assert.equal(recoverRegistrationNumber('REG: UG/MED/9981-SAMPLE'), 'UG/MED/9981-SAMPLE');
  assert.equal(recoverRegistrationNumber('NDA/MED/2024/0912'), 'NDA/MED/2024/0912');
  assert.equal(recoverRegistrationNumber('No code printed here'), null);
  assert.equal(recoverRegistrationNumber(null), null);
});

test('recoverMissedFields: a null registration number is filled from the text, not invented', () => {
  const base = {
    status: 'success' as const,
    modelUsed: 'groq:test',
    data: {
      readable: true,
      product_name: 'COARTEM 20/120',
      active_ingredients: [],
      dosage_form: null,
      manufacturer: null,
      batch_number: 'QCL-7761',
      manufacture_date_raw: null,
      expiry_date_raw: 'NOV 2026',
      registration_number: null,
      printed_warnings: [],
      printed_directions: null,
      label_language: null,
      plain_explanation_en: 'Coartem treats malaria.',
    },
  };

  const filled = recoverMissedFields(base, 'EXP: NOV 2026 NDA: NDA/MAL/HPD/@421');
  assert.equal(filled.data?.registration_number, 'NDA/MAL/HPD/@421');

  const untouched = recoverMissedFields(base, 'EXP: NOV 2026');
  assert.equal(untouched.data?.registration_number, null);

  // A model value always wins over the recovery.
  const given = { ...base, data: { ...base.data, registration_number: 'NDA/X/1' } };
  assert.equal(recoverMissedFields(given, 'NDA/MAL/HPD/@421').data?.registration_number, 'NDA/X/1');
});
