# SomaLabel

SomaLabel is a mobile-first web app that photographs a medicine label and explains it in plain English or Luganda. It checks the printed expiry date and registration code, and shows a clear result with a pharmacist safety line.

## Model

A label is read in two steps. Tesseract.js turns the photo into text on the device, and that text is sent to Groq (`openai/gpt-oss-120b`, an open-weight model) which structures it into JSON and writes the plain-language explanation. Gemma 4 (`gemma-4-26b-a4b-it`, Apache 2.0) via the Gemini API is the fallback when Groq fails, and it is the only path that can look at the photo when OCR finds no usable text. No closed models are used.

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
| GROQ_API_KEY    | Required for the primary label reader. Read only on the server.                           | YOUR_GROQ_API_KEY                           |
| GROQ_MODEL      | Groq model id.                                                                            | openai/gpt-oss-120b                         |
| GROQ_API_URL    | Groq chat-completions endpoint.                                                           | https://api.groq.com/openai/v1/chat/completions |
| GEMINI_API_KEY  | Fallback label reader and the vision path when OCR finds no text. Read only on the server. | YOUR_GEMINI_API_KEY                         |
| MODEL_ID        | Gemma fallback / vision model id.                                                         | gemma-4-26b-a4b-it                          |
| SUNBIRD_API_KEY | Optional. Sunbird AI API key for Luganda translation. Read only on the server.            | (empty)                                     |
| SUNBIRD_API_URL | Optional. Sunbird AI translation endpoint.                                                | https://api.sunbird.ai/tasks/translate |
| PORT            | Server port.                                                                              | 3000                                        |

`.env` is ignored by git and must never be committed.

## Where the models are used

Groq (`openai/gpt-oss-120b`) does the label understanding: it turns the OCR text into JSON and writes the plain-language explanation in `src/lib/groq.ts`. Gemma 4 is the fallback in `src/lib/extraction.ts` and handles the photo when OCR finds no usable text. Tesseract.js converts the photo into raw text on the device, and the expiry and register checks are plain code, not AI.

## How it works

1. The photo is resized to at most 1024px, and Tesseract.js reads the printed text on the device. The OCR worker starts when the app opens, so the first scan does not wait for the language data. If the first read is poor, a second pass runs on an upscaled, contrast-stretched copy.
2. Usable text is sent to Groq; Gemma via the Gemini API is the fallback. The photo is only uploaded when OCR produced nothing usable, because the primary reader is text-only.
3. Code checks the expiry date against today and assigns an expiry badge.
4. A lookup checks the demo register in `data/nda_seed.json` for the registration number.
5. Sunbird translates to Luganda through `POST /tasks/translate` when configured, reading `output.translated_text`; otherwise the Gemma model provides a plain Luganda translation marked as machine translation.

Uploads are resized on the client to at most 1024px on the long side as JPEG at quality 0.8. The JSON body limit is 8mb. Groq calls have a 20-second timeout and one retry on 429/5xx; Gemma calls keep their existing retry rules. Error responses carry the error message only, never a stack trace. The whole `/api/extract` handler has a 50-second deadline. `GET /api/health/model` checks the configured primary provider.

## Safety

SomaLabel explains only what is printed on the label and gives no dosing advice beyond the printed directions. It stores no photos; images are processed in memory only, and the photo is only uploaded when OCR cannot read the label. The label text is sent to the configured model provider (Groq, with Gemma as fallback) to be structured and explained. Every result always shows the pharmacist line: "This explains what is printed on the label. Confirm with a pharmacist or health worker before use."

## Limitations

`data/nda_seed.json` is a demo register, not the official NDA register. Always confirm registration with the NDA or a pharmacist. The Luganda interface strings need native-speaker review.

## License

Apache 2.0. See [LICENSE](./LICENSE).
