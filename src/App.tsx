import { useState } from 'react';
import { Header } from './components/Header.tsx';
import { HomeScanner } from './components/HomeScanner.tsx';
import { LoadingScanner } from './components/LoadingScanner.tsx';
import { ResultCard } from './components/ResultCard.tsx';
import { ErrorCard, ErrorType } from './components/ErrorCard.tsx';
import { resizeImageFile } from './lib/image-utils.ts';
import { SomaScanResult } from './lib/types.ts';
import { Language, TRANSLATIONS } from './lib/translations.ts';

type AppStep = 'home' | 'loading' | 'result' | 'error';

export default function App() {
  const [step, setStep] = useState<AppStep>('home');
  const [language, setLanguage] = useState<Language>('en');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<SomaScanResult | null>(null);
  const [errorType, setErrorType] = useState<ErrorType>('connection');
  const [customErrorMsg, setCustomErrorMsg] = useState<string | null>(null);
  const [rawApiError, setRawApiError] = useState<string | null>(null);
  const [rawModelText, setRawModelText] = useState<string | null>(null);

  const t = TRANSLATIONS[language];

  // Process user captured/uploaded photo
  const processImageFile = async (file: File) => {
    try {
      setStep('loading');
      setCustomErrorMsg(null);
      setRawApiError(null);
      setRawModelText(null);

      // Resize photo to max 1024px on the long side as JPEG at quality 80
      const processed = await resizeImageFile(file, 1024, 0.80);
      setPreviewUrl(processed.dataUrl);

      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: processed.base64,
          mimeType: processed.mimeType,
        }),
      });

      const data = await response.json();

      // If all server retries and fallbacks failed: show "no connection (Try again)" error state
      if (!response.ok || !data.success) {
        setRawApiError(data.rawApiError || data.error || 'All model attempts failed.');
        setRawModelText(data.rawModelText || null);
        setErrorType('connection');
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
    }
  };

  // Process demo sample pack
  const processDemoPack = async (base64: string) => {
    try {
      setStep('loading');
      setCustomErrorMsg(null);
      setRawApiError(null);
      setRawModelText(null);
      const dataUrl = `data:image/jpeg;base64,${base64}`;
      setPreviewUrl(dataUrl);

      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType: 'image/jpeg',
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setRawApiError(data.rawApiError || data.error || 'All model attempts failed.');
        setRawModelText(data.rawModelText || null);
        setErrorType('connection');
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
    }
  };

  const handleReset = () => {
    setStep('home');
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
