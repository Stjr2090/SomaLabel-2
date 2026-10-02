import { useState } from 'react';
import { Header } from './components/Header.tsx';
import { HomeScanner } from './components/HomeScanner.tsx';
import { LoadingScanner } from './components/LoadingScanner.tsx';
import { ResultCard } from './components/ResultCard.tsx';
import { ErrorCard, ErrorType } from './components/ErrorCard.tsx';
import { resizeImageFile } from './lib/image-utils.ts';
import { readLabelText } from './lib/ocr.ts';
import { APP_CONFIG } from './lib/config.ts';
import { SomaScanResult } from './lib/types.ts';
import { Language, TRANSLATIONS } from './lib/translations.ts';

type AppStep = 'home' | 'loading' | 'result' | 'error';
type ScanPhase = 'reading' | 'explaining';

const FETCH_TIMEOUT_MS = 55000;

export default function App() {
  const [step, setStep] = useState<AppStep>('home');
  const [phase, setPhase] = useState<ScanPhase>('reading');
  const [language, setLanguage] = useState<Language>('en');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<SomaScanResult | null>(null);
  const [errorType, setErrorType] = useState<ErrorType>('connection');
  const [customErrorMsg, setCustomErrorMsg] = useState<string | null>(null);
  const [rawApiError, setRawApiError] = useState<string | null>(null);
  const [rawModelText, setRawModelText] = useState<string | null>(null);

  const t = TRANSLATIONS[language];

  // Sends the scan to the server, aborting if it takes longer than 55 seconds.
  // Shows 'connection' only when fetch itself throws (network failure or abort),
  // 'rate_limited' for HTTP 429, and 'service' for any other server error.
  const postExtract = async (body: { labelText: string; imageBase64: string; mimeType: string }) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setRawApiError(data.rawApiError || data.error || 'All model attempts failed.');
        setRawModelText(data.rawModelText || null);
        if (!response.ok && response.status === 429) {
          setErrorType('rate_limited');
        } else {
          setErrorType('service');
        }
        setCustomErrorMsg(null);
        setStep('error');
        return;
      }

      setRawApiError(data.rawApiError || null);
      setRawModelText(data.rawModelText || null);

      const result: SomaScanResult = data.result;

      // ONLY show the blurry screen when the model itself successfully ran and returned readable: false
      if (data.status === 'unreadable' || !result.extracted.readable) {
        const expl = (result.extracted.plain_explanation_en || '').toLowerCase();
        if (expl.includes('not a medicine') || expl.includes('not medicine')) {
          setErrorType('not_medicine');
        } else {
          setErrorType('blurry');
        }
        setStep('error');
        return;
      }

      // Valid readable medicine label
      setScanResult(result);
      setStep('result');
    } catch (err: any) {
      console.error('Scan error:', err);
      setErrorType('connection');
      setCustomErrorMsg(null);
      setRawApiError(typeof err === 'object' ? JSON.stringify(err, Object.getOwnPropertyNames(err)) : String(err));
      setRawModelText(null);
      setStep('error');
    } finally {
      clearTimeout(timer);
    }
  };

  // Process user captured/uploaded photo
  const processImageFile = async (file: File) => {
    try {
      setStep('loading');
      setPhase('reading');
      setCustomErrorMsg(null);
      setRawApiError(null);
      setRawModelText(null);

      // Resize photo to at most 1024px on the long side as JPEG at quality 0.8
      const processed = await resizeImageFile(file, APP_CONFIG.maxImageDimension, 0.8);
      setPreviewUrl(processed.dataUrl);

      // Read the printed text on the device before calling the server
      const labelText = await readLabelText(processed.dataUrl);
      setPhase('explaining');

      await postExtract({
        labelText,
        imageBase64: processed.base64,
        mimeType: processed.mimeType,
      });
    } catch (err: any) {
      console.error('Scan error:', err);
      setErrorType('connection');
      setCustomErrorMsg(null);
      setRawApiError(typeof err === 'object' ? JSON.stringify(err, Object.getOwnPropertyNames(err)) : String(err));
      setRawModelText(null);
      setStep('error');
    }
  };

  // Process demo sample pack
  const processDemoPack = async (base64: string) => {
    setStep('loading');
    setPhase('reading');
    setCustomErrorMsg(null);
    setRawApiError(null);
    setRawModelText(null);
    const dataUrl = `data:image/jpeg;base64,${base64}`;
    setPreviewUrl(dataUrl);

    // Read the printed text on the device before calling the server
    const labelText = await readLabelText(dataUrl);
    setPhase('explaining');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          labelText,
          imageBase64: base64,
          mimeType: 'image/jpeg',
        }),
        signal: controller.signal,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setRawApiError(data.rawApiError || data.error || 'All model attempts failed.');
        setRawModelText(data.rawModelText || null);
        if (!response.ok && response.status === 429) {
          setErrorType('rate_limited');
        } else {
          setErrorType('service');
        }
        setCustomErrorMsg(null);
        setStep('error');
        return;
      }

      setRawApiError(data.rawApiError || null);
      setRawModelText(data.rawModelText || null);

      const result: SomaScanResult = data.result;

      // ONLY show blurry screen when the model returned readable: false
      if (data.status === 'unreadable' || !result.extracted.readable) {
        setErrorType('blurry');
        setStep('error');
        return;
      }

      setScanResult(result);
      setStep('result');
    } catch (err: any) {
      console.error('Demo scan error:', err);
      setErrorType('connection');
      setCustomErrorMsg(null);
      setRawApiError(typeof err === 'object' ? JSON.stringify(err, Object.getOwnPropertyNames(err)) : String(err));
      setRawModelText(null);
      setStep('error');
    } finally {
      clearTimeout(timer);
    }
  };

  const handleReset = () => {
    setStep('home');
    setPhase('reading');
    setPreviewUrl(null);
    setScanResult(null);
    setCustomErrorMsg(null);
    setRawApiError(null);
    setRawModelText(null);
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col font-sans antialiased">
      {/* Light Theme Header: Logo + SomaLabel only, plus English | Luganda toggle */}
      <Header
        onReset={handleReset}
        language={language}
        onLanguageChange={setLanguage}
      />

      {/* Main Content Area (Designed for 390px wide phone screen first) */}
      <main className="flex-1 w-full max-w-[390px] mx-auto px-4 flex flex-col">
        {step === 'home' && (
          <HomeScanner
            language={language}
            onImageSelected={processImageFile}
            onDemoSelected={processDemoPack}
          />
        )}

        {step === 'loading' && (
          <LoadingScanner
            previewUrl={previewUrl}
            language={language}
            phase={phase}
          />
        )}

        {step === 'result' && scanResult && (
          <ResultCard
            result={scanResult}
            language={language}
            onScanAnother={handleReset}
          />
        )}

        {step === 'error' && (
          <ErrorCard
            type={errorType}
            language={language}
            onAction={handleReset}
            customMessage={customErrorMsg}
            rawApiError={rawApiError}
            rawModelText={rawModelText}
          />
        )}
      </main>

      {/* Small Footer Line: Shows which model answered */}
      <footer className={`w-full py-4 text-center ${step === 'result' ? 'pb-28' : ''}`}>
        <p className="text-xs text-slate-400 font-medium">
          {scanResult?.modelUsed ? `Powered by ${scanResult.modelUsed}` : t.poweredBy}
        </p>
      </footer>
    </div>
  );
}
