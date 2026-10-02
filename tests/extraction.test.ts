import test from 'node:test';
import assert from 'node:assert/strict';
import { extractJsonString, validateExtractedLabel } from '../src/lib/extraction.ts';

test('JSON extraction - Stripping code fences and surrounding text', async (t) => {
  await t.test('Strips ```json code fences', () => {
    const raw = '```json\n{"readable": true, "product_name": "Paracetamol"}\n```';
    const cleaned = extractJsonString(raw);
    assert.equal(cleaned, '{"readable": true, "product_name": "Paracetamol"}');
    const parsed = JSON.parse(cleaned);
    assert.equal(parsed.readable, true);
    assert.equal(parsed.product_name, 'Paracetamol');
  });

  await t.test('Strips text before and after JSON object', () => {
    const raw = 'Here is the extracted medicine information:\n```json\n{"readable": true, "product_name": "Coartem"}\n```\nHope this helps you understand the label!';
    const cleaned = extractJsonString(raw);
    assert.equal(cleaned, '{"readable": true, "product_name": "Coartem"}');
    const parsed = JSON.parse(cleaned);
    assert.equal(parsed.product_name, 'Coartem');
  });

  await t.test('Strips conversational preamble without code fences', () => {
    const raw = 'I inspected the photo and found:\n{"readable": false, "plain_explanation_en": "Blurry label"}\nThank you.';
    const cleaned = extractJsonString(raw);
    assert.equal(cleaned, '{"readable": false, "plain_explanation_en": "Blurry label"}');
    const parsed = JSON.parse(cleaned);
    assert.equal(parsed.readable, false);
  });

  await t.test('Handles already clean JSON string', () => {
    const raw = '{"readable": true, "product_name": "Amoxicillin"}';
    const cleaned = extractJsonString(raw);
    assert.equal(cleaned, raw);
  });

  await t.test('Handles empty or invalid input gracefully', () => {
    assert.equal(extractJsonString(''), '');
    assert.equal(extractJsonString(null as any), '');
  });
});

test('Label validation - readable vs unreadable shape', async (t) => {
  await t.test('Validates complete readable label', () => {
    const obj = {
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
    };

    const validated = validateExtractedLabel(obj);
    assert.ok(validated);
    assert.equal(validated.readable, true);
    assert.equal(validated.product_name, 'Paracetamol');
  });

  await t.test('Validates legitimate readable: false output', () => {
    const obj = {
      readable: false,
      plain_explanation_en: "We couldn't read this label clearly. Try again in good light, with the label flat and close up.",
    };

    const validated = validateExtractedLabel(obj);
    assert.ok(validated);
    assert.equal(validated.readable, false);
    assert.equal(validated.product_name, null);
  });
});
