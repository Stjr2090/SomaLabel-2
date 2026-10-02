/**
 * Configuration for SomaLabel
 * Uses Gemma 4 instruction-tuned open-weight model via Gemini API.
 * Config constant MODEL_ID allows easy swapping between gemma-4-26b-a4b-it and gemma-4-31b-it.
 */

function getEnvVar(key: string, defaultValue: string = ''): string {
  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key];
    }
  } catch {
    // browser environment
  }
  return defaultValue;
}

export const MODEL_ID = getEnvVar('MODEL_ID', 'gemma-4-26b-a4b-it');

export const APP_CONFIG = {
  appName: 'SomaLabel',
  tagline: 'Snap a medicine label. Understand it in English or Luganda.',
  maxImageDimension: 1024,
  disclaimer: 'This explains what is printed on the label. Confirm with a pharmacist or health worker before use.',
  unreadableNotice: "We couldn't read this label clearly. Try again in good light, with the label flat and close up.",
};
