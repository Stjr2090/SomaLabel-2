import test from 'node:test';
import assert from 'node:assert/strict';
import { readSunbirdText } from '../src/lib/translation.ts';
import { SUNBIRD_API_URL } from '../src/lib/server-env.ts';

test('readSunbirdText - current nested shape from POST /tasks/translate', () => {
  const data = {
    id: 'trans-1a2b3c',
    status: 'COMPLETED',
    output: { translated_text: 'Oli otya?', source_language: 'eng', target_language: 'lug' },
  };
  assert.equal(readSunbirdText(data), 'Oli otya?');
});

test('readSunbirdText - older flat shapes are still accepted', () => {
  assert.equal(readSunbirdText({ output: 'Oli otya?' }), 'Oli otya?');
  assert.equal(readSunbirdText({ translated_text: 'Oli otya?' }), 'Oli otya?');
  assert.equal(readSunbirdText({ text: 'Oli otya?' }), 'Oli otya?');
  assert.equal(readSunbirdText({ translation: 'Oli otya?' }), 'Oli otya?');
});

test('readSunbirdText - unrecognised shapes return null', () => {
  assert.equal(readSunbirdText(null), null);
  assert.equal(readSunbirdText({}), null);
  assert.equal(readSunbirdText({ output: { something_else: 'x' } }), null);
  assert.equal(readSunbirdText({ output: { translated_text: '   ' } }), null);
});

test('default Sunbird URL is the documented /tasks/translate endpoint', () => {
  if (process.env.SUNBIRD_API_URL) return;
  assert.equal(SUNBIRD_API_URL, 'https://api.sunbird.ai/tasks/translate');
});
