import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveSunbirdUrl, readSunbirdTranslation } from '../src/lib/translation.ts';

test('sunbird - retired nllb_translate path maps to /tasks/translate', () => {
  assert.equal(resolveSunbirdUrl('https://api.sunbird.ai/tasks/nllb_translate'), 'https://api.sunbird.ai/tasks/translate');
  assert.equal(resolveSunbirdUrl('https://api.sunbird.ai/tasks/translate'), 'https://api.sunbird.ai/tasks/translate');
});

test('sunbird - reads nested output.translated_text', () => {
  assert.equal(readSunbirdTranslation({ output: { text: 'How are you?', translated_text: 'Oli otya?' } }), 'Oli otya?');
  assert.equal(readSunbirdTranslation({ translated_text: 'Oli otya?' }), 'Oli otya?');
  assert.equal(readSunbirdTranslation({ output: {} }), '');
  assert.equal(readSunbirdTranslation(null), '');
});
