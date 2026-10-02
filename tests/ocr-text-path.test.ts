import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractTextWithCaller,
  extractImageWithCaller,
  normalizeLabelText,
} from '../src/lib/extraction.ts';

const FENCED_LABEL_JSON = '```json\n' + JSON.stringify({
  readable: true,
  product_name: 'Paracetamol',
  active_ingredients: [{ name: 'Paracetamol', strength: '500mg' }],
  dosage_form: 'Tablet',
  manufacturer: 'Kampala Pharma',
  batch_number: 'KPI-84920',
  manufacture_date_raw: '04/2024',
  expiry_date_raw: 'EXP 03/2027',
  registration_number: 'NDA/MAL/HPD/0189',
  printed_warnings: ['Keep out of reach of children'],
  printed_directions: 'Adults: 1 to 2 tablets every 4 to 6 hours with water.',
  label_language: 'en',
  plain_explanation_en: 'This medicine is Paracetamol 500mg tablets.',
}) + '\n```';

test('extractFromText - parses a mocked fenced JSON response', async () => {
  const caller = async (_modelId: string): Promise<string> => FENCED_LABEL_JSON;
  const noSleep = async (_ms: number): Promise<void> => {};

  const result = await extractTextWithCaller(
    caller,
    'gemma-4-26b-a4b-it',
    'gemma-4-31b-it',
    noSleep
  );

  assert.equal(result.status, 'success');
  assert.ok(result.data);
  assert.equal(result.data.readable, true);
  assert.equal(result.data.product_name, 'Paracetamol');
  assert.equal(result.modelUsed, 'gemma-4-26b-a4b-it');
});

test('text path - makes at most 3 calls when every call fails', async () => {
  let calls = 0;
  const alwaysFailing = async (_modelId: string): Promise<string> => {
    calls += 1;
    const err: any = new Error('Service unavailable (503)');
    err.status = 503;
    throw err;
  };
  const noSleep = async (_ms: number): Promise<void> => {};

  const result = await extractTextWithCaller(
    alwaysFailing,
    'gemma-4-26b-a4b-it',
    'gemma-4-31b-it',
    noSleep
  );

  assert.ok(calls <= 3);
  assert.equal(calls, 3);
  assert.equal(result.status, 'api_error');
});

test('image fallback - makes exactly 1 call when it gets a 500', async () => {
  let calls = 0;
  const always500 = async (_modelId: string): Promise<string> => {
    calls += 1;
    const err: any = new Error('Internal server error (500)');
    err.status = 500;
    throw err;
  };

  const result = await extractImageWithCaller(always500, 'gemma-4-26b-a4b-it');

  assert.equal(calls, 1);
  assert.equal(result.status, 'unreadable');
  assert.ok(result.data);
  assert.equal(result.data.readable, false);
});

test('labelText over 5000 characters is ignored', async (t) => {
  await t.test('longer than 5000 characters returns empty', () => {
    assert.equal(normalizeLabelText('x'.repeat(5001)), '');
  });

  await t.test('exactly 5000 characters is kept', () => {
    const text = 'y'.repeat(5000);
    assert.equal(normalizeLabelText(text), text);
  });

  await t.test('non-strings return empty', () => {
    assert.equal(normalizeLabelText(undefined), '');
    assert.equal(normalizeLabelText(null), '');
    assert.equal(normalizeLabelText(123), '');
  });
});
