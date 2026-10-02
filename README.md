# SomaLabel (Uganda) 🇺🇬💊

> **"Snap a medicine label. Understand it in English or Luganda."**
> *(Soma eddagala mu Luganda n'Olungereza)*

SomaLabel is a mobile-first web application designed for ordinary people in Uganda to photograph a medicine pack or label with their phone and instantly understand three essential things:
1. **Plain-Language Explanation**: 3 to 5 simple sentences in English or Luganda (at a primary school reading level) explaining what the medicine is, how to take it *only* as printed, and critical safety warnings.
2. **Expiry Status**: Automated code-based date parser comparing the printed expiry against today's date, displaying high-contrast badges (*Valid*, *Expires within 90 days*, *Expired*, or *Expiry date not found*) and the date in plain words (e.g., *"Expires end of March 2027"*).
3. **National Drug Authority (NDA) Registration**: Verification against a local demo registry of Uganda National Drug Authority records, flagging matched products, unlisted codes, or missing numbers.

---

## The Problem SomaLabel Solves

In Uganda and across East Africa:
- Medicine packaging often uses dense pharmaceutical terminology, small print, complex Latinate abbreviations, or unfamiliar international layouts.
- Patients with limited formal education or non-fluent English literacy struggle to read expiry dates, leading to unintentional consumption of expired medications.
- Counterfeit, substandard, or unregistered medicines circulate in informal markets. Patients lack an immediate, accessible tool to check whether a package bears a recognized registration code.
- Language barrier: Luganda is spoken by millions across Central and Southern Uganda, yet medicine packaging is printed exclusively in English or foreign languages.

SomaLabel bridges this divide with high contrast, big tap targets, client-side image resizing, and memory-only privacy protection suitable for low-cost Android smartphones over slow 2G/3G mobile networks.

---

## Model & Architecture

- **Open-Weight Model**: Powered exclusively by Google's open-weight **Gemma 4 instruction-tuned models** (`gemma-4-26b-a4b-it` or `gemma-4-31b-it`) accessed through the Gemini API.
- **Model Documentation**: [Gemma 4 on ai.google.dev](https://ai.google.dev/gemma/docs/core) (Licensed under Apache 2.0).
- **Model Independence**: The application is configured with a modular constant `MODEL_ID` in `src/lib/config.ts`. As required by the project specifications, the application does not silently substitute or switch to proprietary Gemini models if image input is rejected.
- **Privacy by Design**: No photos or scan results are saved to disks or databases. All image processing and inferences are performed strictly in temporary memory.

---

## Key Dependencies

- **`@google/genai`**: Official TypeScript SDK for calling open-weight Gemma 4 models server-side.
- **`express`**: Server-side proxy for API keys and request orchestration.
- **`vite`**: Modern frontend tooling with dev server middleware integration.
- **`react` 19 & `react-dom`**: Mobile-first responsive user interface.
- **`tailwindcss`**: Accessible styling and high-contrast palette.
- **`lucide-react`**: Accessible iconography.

---

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | **Required**. API key used to query the Gemma 4 model via the Gemini API. | Injected by AI Studio |
| `MODEL_ID` | Open-weight Gemma 4 instruction-tuned model name. | `gemma-4-26b-a4b-it` |
| `SUNBIRD_API_KEY` | Optional. Sunbird AI API key for specialized Ugandan language translation. | `""` |
| `SUNBIRD_API_URL` | Optional. Sunbird AI translation API endpoint. | `https://api.sunbird.ai/tasks/nllb_translate` |
| `PORT` | Local server port. | `3000` |

---

## How to Run Locally

### Prerequisites
- Node.js (v20 or v22 recommended)
- npm or bun

### Setup
```bash
# 1. Clone repository
git clone <repo-url>
cd somalabel

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env
# Edit .env with your GEMINI_API_KEY

# 4. Start local development server (runs on port 3000)
npm run dev
```

Visit `http://localhost:3000` in your mobile or desktop browser.

### Running Unit Tests
SomaLabel includes a test suite for the expiry date parser covering all required formats (`EXP 03/2027`, `03/27`, `2027-03`, `MAR 2027`, `12.05.2026`, `EXP: 2027/03/31`, month-end calculation, and edge cases):
```bash
npm run test
```

### Type Checking & Build
```bash
npm run lint
npm run build
npm start
```

---

## How It Works (Step-by-Step)

1. **Capture / Upload**:
   - The user taps **"Scan label"**, which directly activates the rear camera (`capture="environment"`).
   - Alternatively, users can choose an existing photo from the gallery or tap one of the built-in **demo medicine sample packs** (Paracetamol 500mg, Coartem 20/120mg, Expired Amoxicillin).
   - Before transmission, the client resizes the image to a maximum of 1600px on the long edge to minimize cellular data consumption.

2. **Step 1: Gemma 4 Extraction**:
   - The image is processed in memory by the server and sent to Gemma 4 with instructions to extract exact factual fields (product name, active ingredients, dosage form, manufacturer, batch number, manufacture date, expiry date, registration number, warnings, directions).
   - Hallucination guard: The model is strictly instructed to return `null` for non-visible fields and never add unprinted medical advice.

3. **Step 2: Code-Based Expiry Analysis**:
   - The raw expiry string is parsed by code (not the model).
   - Handles month-only dates (which expire at the end of the month) and full calendar dates.
   - Compares with the current date and outputs:
     - 🔴 **Expired** (red)
     - 🟡 **Expires within 90 days** (amber)
     - 🟢 **Valid** (green)
     - ⚪ **Expiry date not found** (grey)

4. **Step 3: NDA Registration Lookup**:
   - Normalizes the registration code (removing whitespace, case-insensitive).
   - Looks up the code in `data/nda_seed.json`.
   - Badges:
     - 🟢 **Matched** (green, shows verified product name)
     - 🟡 **Not in our list** (amber: *"Not in our demo list. Check with NDA or a pharmacist."*)
     - ⚪ **Not printed on the label** (grey)

5. **Step 4: English & Luganda Language Support**:
   - The result card features an **English | Luganda** toggle.
   - When Sunbird AI keys are set, it queries the Sunbird AI translation model.
   - When not configured, it falls back to Gemma 4 for plain Luganda translation, marked with a small `machine translation` notice.

---

## Current Limitations

- **Medicines Only**: SomaLabel is strictly designed for human medicine labels and packages. It does not analyze general groceries, veterinary products, or non-medicinal items.
- **Demo Registration List**: The NDA registration database is seeded with demonstration records (`data/nda_seed.json`). It does not yet connect to a live government NDA database and must be validated with an official pharmacist.
- **Translation Quality**: Machine translations into Luganda provide general comprehension for ordinary instructions; users are reminded to confirm all medical decisions with a qualified healthcare worker.
- **Mandatory Safety Disclaimer**: *"This explains what is printed on the label. Confirm with a pharmacist or health worker before use."*

---

## License

This project is licensed under the **Apache License 2.0**. See the [LICENSE](./LICENSE) file for details.
