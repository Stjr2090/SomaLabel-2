import React from 'react';
import { Pill } from 'lucide-react';
import { Language } from '../lib/translations.ts';

interface HeaderProps {
  onReset: () => void;
  language: Language;
  onLanguageChange: (lang: Language) => void;
}

export const Header: React.FC<HeaderProps> = ({ onReset, language, onLanguageChange }) => {
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
      <div className="w-full max-w-[390px] mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo and Name SomaLabel only */}
        <button
          onClick={onReset}
          className="flex items-center gap-2.5 text-left focus:outline-none focus:ring-2 focus:ring-emerald-600 rounded-lg"
          aria-label="SomaLabel Home"
        >
          <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-black">
            <Pill className="w-5 h-5 rotate-45 text-white" />
          </div>
          <span className="font-extrabold text-xl tracking-tight text-slate-900">
            SomaLabel
          </span>
        </button>

        {/* English | Luganda toggle on the right */}
        <div className="inline-flex rounded-xl bg-slate-100 p-0.5 border border-slate-200" role="group" aria-label="Language selection">
          <button
            type="button"
            onClick={() => onLanguageChange('en')}
            className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors ${
              language === 'en'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            aria-pressed={language === 'en'}
          >
            English
          </button>
          <button
            type="button"
            onClick={() => onLanguageChange('lug')}
            className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors ${
              language === 'lug'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            aria-pressed={language === 'lug'}
          >
            Luganda
          </button>
        </div>
      </div>
    </header>
  );
};
