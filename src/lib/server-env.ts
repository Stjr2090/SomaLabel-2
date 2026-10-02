/**
 * Server-only environment access.
 * This module is imported only by server code (server.ts, extraction.ts,
 * translation.ts) and never by client components, so secret values
 * are never bundled into client JavaScript.
 */

function getServerEnv(key: string, defaultValue: string = ''): string {
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key] as string;
  }
  return defaultValue;
}

export const GEMINI_API_KEY = getServerEnv('GEMINI_API_KEY', '');
export const SUNBIRD_API_KEY = getServerEnv('SUNBIRD_API_KEY', '');
export const SUNBIRD_API_URL = getServerEnv(
  'SUNBIRD_API_URL',
  'https://api.sunbird.ai/tasks/nllb_translate'
);
