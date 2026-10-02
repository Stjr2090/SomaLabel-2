import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  extractJsonString,
  validateExtractedLabel,
  extractWithCaller,
  isRetryableError,
} from '../src/lib/extraction.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LIB_DIR = path.resolve(__dirname, '../src/lib');

test('extractJsonString - code fences, leading prose and trailing prose', async (t) => {
  await t.test('code fences only', () => {
    const raw = '```json\n{"readable": true, "product_name": "Paracetamol"}\n```';
    assert.equal(extractJsonString(raw), '{"readable": true, "product_name": "Paracetamol"}');
  });

  await t.test('leading prose before JSON', () => {
    const raw = 'Here is what I found on the label:\n{"readable": true, "product_name": "Coartem"}';
    assert.equal(extractJsonString(raw), '{"readable": true, "product_name": "Coartem"}');
  });

  await t.test('trailing prose after JSON', () => {
    const raw = '{"readable": true, "product_name": "Coartem"}\nHope this helps!';
    assert.equal(extractJsonString(raw), '{"readable": true, "product_name": "Coartem"}');
  });

  await t.test('leading prose plus code fences plus trailing prose', () => {
    const raw =
      'I inspected the photo and found:\n```json\n{"readable": false, "plain_explanation_en": "Blurry"}\n```\nLet me know if you need anything else.';
    assert.equal(
      extractJsonString(raw),
      '{"readable": false, "plain_explanation_en": "Blurry"}'
    );
  });
});

test('validateExtractedLabel - valid, unreadable and malformed input', async (t) => {
  await t.test('accepts a valid readable label', () => {
    const validated = validateExtractedLabel({
      readable: true,
      product_name: 'Paracetamol',
      active_ingredients: [{ name: 'Paracetamol', strength: '500mg' }],
      dosage_form: 'Tablet',
      manufacturer: 'KPI',
      batch_number: 'B123',
      manufacture_date_raw: '01/2024',
      expiry_date_raw: 'EXP 03/2027',
      registration_number: 'NDA/MAL/HPD/0189',
      printed_warnings: ['Keep away from children'],
      printed_directions: 'Take 2 tablets',
      label_language: 'en',
      plain_explanation_en: 'This medicine is Paracetamol 500mg.',
    });
    assert.ok(validated);
    assert.equal(validated.readable, true);
    assert.equal(validated.product_name, 'Paracetamol');
  });

  await t.test('accepts a valid unreadable label', () => {
    const validated = validateExtractedLabel({
      readable: false,
      plain_explanation_en: 'Blurry label, please retake.',
    });
    assert.ok(validated);
    assert.equal(validated.readable, false);
  });

  await t.test('rejects malformed input', () => {
    assert.equal(validateExtractedLabel(null), null);
    assert.equal(validateExtractedLabel(undefined), null);
    assert.equal(validateExtractedLabel([]), null);
    assert.equal(validateExtractedLabel('not an object'), null);
    assert.equal(validateExtractedLabel({}), null);
    assert.equal(validateExtractedLabel({ readable: 'yes' }), null);
    assert.equal(validateExtractedLabel({ readable: 1 }), null);
    assert.equal(validateExtractedLabel({ product_name: 'No readable flag' }), null);
  });
});

test('retry cap - mocked client that always returns 500 is called exactly 3 times', async () => {
  let calls = 0;
  const always500 = async (_modelId: string): Promise<string> => {
    calls += 1;
    const err: any = new Error('Internal server error (500)');
    err.status = 500;
    throw err;
  };
  const noSleep = async (_ms: number): Promise<void> => {};

  const result = await extractWithCaller(
    always500,
    'gemma-4-26b-a4b-it',
    'gemma-4-31b-it',
    noSleep
  );

  assert.equal(calls, 3);
  assert.equal(result.status, 'api_error');
  assert.ok(result.rawApiError && result.rawApiError.length > 0);
});

test('retry policy - only 429, 500 or 503 trigger a primary retry', async (t) => {
  await t.test('non-retryable error uses exactly 2 calls (primary + alternate)', async () => {
    let calls = 0;
    const badRequest = async (): Promise<string> => {
      calls += 1;
      const err: any = new Error('Bad request (400)');
      err.status = 400;
      throw err;
    };
    const noSleep = async (): Promise<void> => {};
    const result = await extractWithCaller(
      badRequest,
      'gemma-4-26b-a4b-it',
      'gemma-4-31b-it',
      noSleep
    );
    assert.equal(calls, 2);
    assert.equal(result.status, 'api_error');
  });

  await t.test('isRetryableError matches only 429, 500 and 503', () => {
    assert.equal(isRetryableError({ status: 429 }), true);
    assert.equal(isRetryableError({ status: 500 }), true);
    assert.equal(isRetryableError({ status: 503 }), true);
    assert.equal(isRetryableError({ status: 400 }), false);
    assert.equal(isRetryableError({ status: 404 }), false);
    assert.equal(isRetryableError(new Error('boom')), false);
  });
});

test('no closed fallback - no model id in src/lib contains "gemini-"', async () => {
  const files = readdirSync(LIB_DIR).filter((f) => f.endsWith('.ts'));
  assert.ok(files.length > 0);
  const offenders: string[] = [];
  for (const file of files) {
    const content = readFileSync(path.join(LIB_DIR, file), 'utf-8');
    if (content.toLowerCase().includes('gemini-')) {
      offenders.push(file);
    }
  }
  assert.deepEqual(offenders, []);
});
