# SomaLabel

SomaLabel is a mobile-first web app that photographs a medicine label and explains it in plain English or Luganda. It checks the printed expiry date and registration code, and shows a clear result with a pharmacist safety line.

## Model

Core AI work is done by the open-weight Gemma 4 26B A4B IT model (`gemma-4-26b-a4b-it`) via the Gemini API. Gemma is licensed under Apache 2.0. The scanner uses this single model. No closed models are used; if the Gemma call fails after its retry, the scanner returns an API error.

## Dependencies and licenses

| Dependency             | License      |
| :--------------------- | :----------- |
| @google/genai          | Apache-2.0   |
| @tailwindcss/vite      | MIT          |
| @vitejs/plugin-react   | MIT          |
| lucide-react           | ISC          |
| react                  | MIT          |
| react-dom              | MIT          |
| vite                   | MIT          |
| express                | MIT          |
| dotenv                 | BSD-2-Clause |
| motion                 | MIT          |
| autoprefixer (dev)     | MIT          |
| esbuild (dev)          | MIT          |
| tailwindcss (dev)      | MIT          |
| tsx (dev)              | MIT          |
| typescript (dev)       | Apache-2.0   |
| @types/node (dev)      | MIT          |
| @types/react (dev)     | MIT          |
| @types/react-dom (dev) | MIT          |
| @types/express (dev)   | MIT          |
| Dependency | License |
| :--- | :--- |
| @google/genai | Apache-2.0 |
| @tailwindcss/vite | MIT |
| @vitejs/plugin-react | MIT |
| lucide-react | ISC |
| react | MIT |
| react-dom | MIT |
| vite | MIT |
| express | MIT |
| dotenv | BSD-2-Clause |
| motion | MIT |
| tesseract.js | Apache-2.0 |
| autoprefixer (dev) | MIT |
| esbuild (dev) | MIT |
| tailwindcss (dev) | MIT |
| tsx (dev) | MIT |
| typescript (dev) | Apache-2.0 |
| @types/node (dev) | MIT |
| @types/react (dev) | MIT |
| @types/react-dom (dev) | MIT |
| @types/express (dev) | MIT |

## Setup and run

Prerequisites: Node.js 20 or 22, npm.

```bash
git clone https://github.com/Stjr2090/SomaLabel-2
cd SomaLabel-2
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:3000`.

Production run:

```bash
npm run build
npm start
```

`npm run build` builds the Vite client and bundles `server.ts` into `dist/server.js` with esbuild. `npm start` runs `node dist/server.js` with `NODE_ENV=production`.

Checks:

```bash
npm test
npm run lint
```

## Environment variables

Copy `.env.example` to `.env`. Every variable from `.env.example`:

| Variable        | Description                                                                               | Example                                     |
| :-------------- | :---------------------------------------------------------------------------------------- | :------------------------------------------ |
| GEMINI_API_KEY  | Required. API key for calling Gemma 4 models via the Gemini API. Read only on the server. | YOUR_GEMINI_API_KEY                         |
| MODEL_ID        | Primary open-weight model id.                                                             | gemma-4-26b-a4b-it                          |
| SUNBIRD_API_KEY | Optional. Sunbird AI API key for Luganda translation. Read only on the server.            | (empty)                                     |
| SUNBIRD_API_URL | Optional. Sunbird AI translation endpoint.                                                | https://api.sunbird.ai/tasks/translate |
| PORT            | Server port.                                                                              | 3000                                        |

`.env` is ignored by git and must never be committed.

## Where Gemma is used

Gemma 4 (`gemma-4-26b-a4b-it`, Apache 2.0) does all label understanding: structuring the label into JSON and writing the plain-language explanation in `src/lib/extraction.ts`, plus the Luganda fallback when Sunbird is not configured. Tesseract.js only converts the photo into raw text, and the expiry and register checks are plain code, not AI.

## How it works

1. OCR reads the printed text from the label photo on the device, then Gemma structures that text into JSON.
2. Code checks the expiry date against today and assigns an expiry badge.
3. A lookup checks the demo register in `data/nda_seed.json` for the registration number.
4. Sunbird translates to Luganda through `POST /tasks/translate` when configured, reading `output.translated_text`; otherwise the Gemma model provides a plain Luganda translation marked as machine translation.

Uploads are resized on the client to at most 1024px on the long side as JPEG at quality 0.8. The JSON body limit is 8mb. The text path allows one retry on the same model for 429, 500 or 503 after 2 seconds; the image fallback makes a single attempt with no retry. Error responses carry the error message only, never a stack trace. The whole `/api/extract` handler has a 35-second deadline and the client aborts at 40 seconds. `GET /api/health/model` sends a text-only "Reply with OK" to the configured model for health checks.

## Safety

SomaLabel explains only what is printed on the label and gives no dosing advice beyond the printed directions. It stores no photos; images are processed in memory only. Every result always shows the pharmacist line: "This explains what is printed on the label. Confirm with a pharmacist or health worker before use."

## Limitations

`data/nda_seed.json` is a demo register, not the official NDA register. Always confirm registration with the NDA or a pharmacist. The Luganda interface strings need native-speaker review.

## License

Apache 2.0. See [LICENSE](./LICENSE).
