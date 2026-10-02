import React, { useRef } from 'react';
import { Camera } from 'lucide-react';
import { Language, TRANSLATIONS } from '../lib/translations.ts';
import { DEMO_SAMPLES } from '../lib/demo-data.ts';

interface HomeScannerProps {
  language: Language;
  onImageSelected: (file: File) => void;
  onDemoSelected: (base64: string, name: string) => void;
  disabled?: boolean;
}

export const HomeScanner: React.FC<HomeScannerProps> = ({
  language,
  onImageSelected,
  onDemoSelected,
  disabled,
}) => {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const t = TRANSLATIONS[language];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onImageSelected(files[0]);
    }
    e.target.value = '';
  };

  return (
    <div className="w-full flex flex-col justify-between pt-4 pb-2">
      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled}
      />

      {/* Primary Hero Section: Everything Important Visible Without Scrolling */}
      <div className="flex flex-col items-center text-center px-2 py-4">
        {/* Short Headline */}
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
          {t.headline}
        </h1>

        {/* One line of subtext (min 17px font for readability) */}
        <p className="mt-3 text-[17px] text-slate-600 leading-snug max-w-[340px]">
          {t.subtext}
        </p>

        {/* Large "Scan label" button (min 56px tall) */}
        <div className="w-full mt-8">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={disabled}
            className="w-full min-h-[58px] bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-lg rounded-2xl flex items-center justify-center gap-3 transition-colors shadow-xs active:scale-[0.99] disabled:opacity-50"
            aria-label={t.scanButton}
          >
            <Camera className="w-6 h-6 text-white" />
            <span>{t.scanButton}</span>
          </button>
        </div>

        {/* "or choose a photo" as a text link underneath */}
        <div className="mt-4">
          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            disabled={disabled}
            className="text-[17px] font-semibold text-emerald-700 hover:text-emerald-800 hover:underline active:opacity-75 py-2 px-3 rounded-lg transition-colors disabled:opacity-50"
          >
            {t.orChoosePhoto}
          </button>
        </div>
      </div>

      {/* Compact Demo Sample Packs for Quick Testing */}
      <div className="mt-6 pt-5 border-t border-slate-100">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider text-center mb-3">
          {t.trySampleLabel}
        </p>

        <div className="flex flex-col gap-2">
          {DEMO_SAMPLES.map((sample) => (
            <button
              key={sample.id}
              onClick={() => onDemoSelected(sample.generateImage(), sample.title)}
              disabled={disabled}
              className="w-full p-3 rounded-xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 transition-colors text-left flex items-center justify-between gap-3 group border border-slate-200/70"
            >
              <div className="min-w-0">
                <p className="font-semibold text-sm text-slate-800 truncate">
                  {sample.title}
                </p>
                <p className="text-xs text-slate-500 truncate mt-0.5">
                  {sample.subtitle}
                </p>
              </div>
              <span className="shrink-0 text-xs font-bold px-2.5 py-1 rounded-md bg-white text-emerald-700 border border-slate-200 group-hover:border-emerald-300">
                {language === 'lug' ? 'Gezaako' : 'Test'}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
