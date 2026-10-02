import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Language, TRANSLATIONS } from '../lib/translations.ts';

interface LoadingScannerProps {
  previewUrl: string | null;
  language: Language;
}

export const LoadingScanner: React.FC<LoadingScannerProps> = ({
  previewUrl,
  language,
}) => {
  const t = TRANSLATIONS[language];
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);

  const steps = [
    t.readingLabel,
    t.checkingExpiry,
    t.checkingRegister,
  ];

  useEffect(() => {
    const timer1 = setTimeout(() => setCurrentStepIndex(1), 1800);
    const timer2 = setTimeout(() => setCurrentStepIndex(2), 3800);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  return (
    <div className="w-full flex flex-col items-center py-6">
      {/* Photo Thumbnail */}
      {previewUrl && (
        <div className="w-36 h-36 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shadow-xs mb-6 relative">
          <img
            src={previewUrl}
            alt="Medicine label thumbnail"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-slate-900/10 pointer-events-none" />
        </div>
      )}

      {/* Progress Spinner & Dynamic Step Text */}
      <div className="flex flex-col items-center text-center px-4 w-full">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mb-4" />

        {/* Progress line changing through the 3 steps */}
        <h2 className="text-[19px] font-bold text-slate-800 transition-all duration-300">
          {steps[currentStepIndex]}
        </h2>

        {/* Subtle Step Indicator Dots */}
        <div className="flex items-center gap-2 mt-4">
          {steps.map((_, idx) => (
            <div
              key={idx}
              className={`h-2 rounded-full transition-all duration-300 ${
                idx === currentStepIndex
                  ? 'w-6 bg-emerald-600'
                  : idx < currentStepIndex
                  ? 'w-2 bg-emerald-300'
                  : 'w-2 bg-slate-200'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
