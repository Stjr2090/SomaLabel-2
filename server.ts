import express, { NextFunction, Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { extractLabel, normalizeLabelText, errorMessage } from './src/lib/extraction.ts';
import { analyzeExpiry } from './src/lib/expiry.ts';
import { lookupRegistration, loadNDASeed } from './src/lib/registration.ts';
import { toLuganda } from './src/lib/translation.ts';
import { MODEL_ID } from './src/lib/config.ts';
import { SomaScanResult } from './src/lib/types.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

// Memory-only JSON parser: 8mb cap for resized 1024px JPEG uploads
app.use(express.json({ limit: '8mb' }));

// Simple in-memory rate limit: 10 requests per minute per IP
const rateBuckets = new Map<string, number[]>();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 10;

export function clearRateLimits(): void {
  rateBuckets.clear();
}

function rateLimit(_req: Request, res: Response, next: NextFunction): void {
  const req = _req as Request & { ip?: string };
  const ip =
    req.ip || (req.socket && req.socket.remoteAddress) || 'unknown';
  const now = Date.now();
  const hits = rateBuckets.get(ip) || [];
  const fresh = hits.filter((t) => now - t < RATE_WINDOW_MS);
  if (fresh.length >= RATE_MAX) {
    res.status(429).json({
      success: false,
      error: 'Too many requests. Please wait a minute and try again.',
    });
    return;
  }
  fresh.push(now);
  rateBuckets.set(ip, fresh);
  next();
}

// Health Check API
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    appName: 'SomaLabel',
    model: MODEL_ID,
    openWeight: true,
    timestamp: new Date().toISOString(),
  });
});

// Model health check: text-only "Reply with OK" against MODEL_ID
app.get('/api/health/model', rateLimit, async (_req: Request, res: Response) => {
  const started = Date.now();
  try {
    const apiKey = process.env.GEMINI_API_KEY || '';
    if (!apiKey) {
      res.status(502).json({
        ok: false,
        modelUsed: MODEL_ID,
        latencyMs: Date.now() - started,
        rawError: 'GEMINI_API_KEY environment variable is not configured.',
      });
      return;
    }
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { timeout: 30000 },
    });
    await ai.models.generateContent({
      model: MODEL_ID,
      contents: [{ role: 'user', parts: [{ text: 'Reply with OK' }] }],
    });
    res.json({
      ok: true,
      modelUsed: MODEL_ID,
      latencyMs: Date.now() - started,
      rawError: null,
    });
  } catch (err: any) {
    const rawError = errorMessage(err);
    res.status(502).json({
      ok: false,
      modelUsed: MODEL_ID,
      latencyMs: Date.now() - started,
      rawError,
    });
  }
});

// Demo NDA Registry list
app.get('/api/nda-list', (_req: Request, res: Response) => {
  const list = loadNDASeed();
  res.json({ success: true, count: list.length, items: list });
});

// Step 1: Extract medicine label information via Gemma 4 open-weight model.
// Primary path is text-only (OCR label text); the image is a fallback.
const EXTRACT_DEADLINE_MS = 50000;

app.post('/api/extract', rateLimit, async (req: Request, res: Response) => {
  const deadline = setTimeout(() => {
    if (!res.headersSent) {
      res.status(504).json({
        success: false,
        status: 'api_error',
        error: 'timeout',
        rawApiError: 'timeout',
        rawModelText: null,
      });
    }
  }, EXTRACT_DEADLINE_MS);

  try {
    const { imageBase64, mimeType = 'image/jpeg' } = req.body;
    const labelText = normalizeLabelText(req.body?.labelText);

    if (
      (!imageBase64 || typeof imageBase64 !== 'string') &&
      labelText.trim().length < 15
    ) {
      clearTimeout(deadline);
      res.status(400).json({
        success: false,
        status: 'api_error',
        error: 'Missing imageBase64 string in request.',
        rawApiError: 'Missing imageBase64 parameter in request body.',
        rawModelText: null,
      });
      return;
    }

    console.log(`Processing scan with model ${MODEL_ID}...`);
    const extractionResult = await extractLabel({
      labelText,
      imageBase64: typeof imageBase64 === 'string' ? imageBase64 : '',
      mimeType,
    });
    if (res.headersSent) return;
    clearTimeout(deadline);

    // 1. Model rejected image/multimodal input
    if (extractionResult.status === 'rejection' || extractionResult.rejectedByGemma) {
      res.status(422).json({
        success: false,
        status: 'rejection',
        rejectedByGemma: true,
        error: extractionResult.rawApiError || `Gemma 4 model (${MODEL_ID}) rejected image input.`,
        rawApiError: extractionResult.rawApiError || null,
        rawModelText: extractionResult.rawModelText || null,
        modelUsed: MODEL_ID,
      });
      return;
    }

    // 2. Real API error (e.g. 500, network, timeout)
    if (extractionResult.status === 'api_error') {
      res.status(500).json({
        success: false,
        status: 'api_error',
        error: extractionResult.rawApiError || 'API error from Gemma model.',
        rawApiError: extractionResult.rawApiError || null,
        rawModelText: extractionResult.rawModelText || null,
        modelUsed: extractionResult.modelUsed,
      });
      return;
    }

    // 3. Real JSON parse error (model returned text, but invalid JSON)
    if (extractionResult.status === 'parse_error') {
      res.status(502).json({
        success: false,
        status: 'parse_error',
        error: 'Model response was not valid JSON.',
        rawApiError: extractionResult.rawApiError || 'JSON parsing failed on model output.',
        rawModelText: extractionResult.rawModelText || null,
        modelUsed: extractionResult.modelUsed,
      });
      return;
    }

    // 4. Model successfully returned JSON!
    const extracted = extractionResult.data!;

    // Code-based expiry and NDA checks
    const expiry = analyzeExpiry(extracted.expiry_date_raw);
    const registration = lookupRegistration(extracted.registration_number);

    const scanResult: SomaScanResult = {
      extracted,
      expiry,
      registration,
      modelUsed: extractionResult.modelUsed,
      timestamp: new Date().toISOString(),
      rawModelText: extractionResult.rawModelText || null,
      rawApiError: null,
    };

    // If readable is false, status is 'unreadable' (this is the ONLY case for blurry screen)
    if (!extracted.readable || extractionResult.status === 'unreadable') {
      res.json({
        success: true,
        status: 'unreadable',
        result: scanResult,
        rawApiError: null,
        rawModelText: extractionResult.rawModelText || null,
      });
      return;
    }

    // Otherwise success!
    res.json({
      success: true,
      status: 'success',
      result: scanResult,
      rawApiError: null,
      rawModelText: extractionResult.rawModelText || null,
    });
  } catch (error: any) {
    clearTimeout(deadline);
    if (res.headersSent) return;
    console.error('Unhandled server error in /api/extract:', error);
    res.status(500).json({
      success: false,
      status: 'api_error',
      error: error.message || 'Internal server error during medicine label extraction.',
      rawApiError: errorMessage(error),
      rawModelText: null,
    });
  }
});

// Step 4: Luganda Translation Endpoint
app.post('/api/translate', rateLimit, async (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      res.status(400).json({ success: false, error: 'Missing text to translate.' });
      return;
    }

    const translation = await toLuganda(text);
    res.json({ success: true, translation });
  } catch (err: any) {
    console.error('Translation error in /api/translate:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to translate to Luganda.' });
  }
});

// Payload-too-large handler: clear 413 above the 8mb cap
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err && (err.type === 'entity.too.large' || err.status === 413)) {
    res.status(413).json({
      success: false,
      status: 'api_error',
      error: 'Image is too large. Please retake the photo; images are resized to 1024px before upload and must be under 8MB.',
    });
    return;
  }
  res.status(err?.status || 500).json({
    success: false,
    status: 'api_error',
    error: err?.message || 'Unexpected server error.',
  });
});

// Full-stack Vite middleware configuration
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    const clientDir = path.basename(__dirname) === 'dist' ? __dirname : path.resolve(__dirname, 'dist');
    app.use(express.static(clientDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(clientDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, () => {
    console.log(`SomaLabel server running on port ${PORT} [Model: ${MODEL_ID}]`);
  });
}

startServer();
