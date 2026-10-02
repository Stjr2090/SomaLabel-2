import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractMedicineLabel } from './src/lib/extraction.ts';
import { analyzeExpiry } from './src/lib/expiry.ts';
import { lookupRegistration, loadNDASeed } from './src/lib/registration.ts';
import { toLuganda } from './src/lib/translation.ts';
import { MODEL_ID } from './src/lib/config.ts';
import { SomaScanResult } from './src/lib/types.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Memory-only JSON parser with reasonable limit for base64 images
app.use(express.json({ limit: '25mb' }));

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

// Demo NDA Registry list
app.get('/api/nda-list', (_req: Request, res: Response) => {
  const list = loadNDASeed();
  res.json({ success: true, count: list.length, items: list });
});

// Step 1: Extract medicine label information via Gemma 4 open-weight model
app.post('/api/extract', async (req: Request, res: Response) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg' } = req.body;

    if (!imageBase64 || typeof imageBase64 !== 'string') {
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
    const extractionResult = await extractMedicineLabel(imageBase64, mimeType);

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
    console.error('Unhandled server error in /api/extract:', error);
    res.status(500).json({
      success: false,
      status: 'api_error',
      error: error.message || 'Internal server error during medicine label extraction.',
      rawApiError: typeof error === 'object' ? JSON.stringify(error, Object.getOwnPropertyNames(error)) : String(error),
      rawModelText: null,
    });
  }
});

// Step 4: Luganda Translation Endpoint
app.post('/api/translate', async (req: Request, res: Response) => {
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

// Full-stack Vite middleware configuration
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist/index.html'));
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
