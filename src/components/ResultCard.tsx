import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Camera,
  Loader2,
} from 'lucide-react';
import { SomaScanResult, TranslationResult } from '../lib/types.ts';
import { Language, TRANSLATIONS } from '../lib/translations.ts';

interface ResultCardProps {
  result: SomaScanResult;
  language: Language;
  onScanAnother: () => void;
}

export const ResultCard: React.FC<ResultCardProps> = ({
  result,
  language,
  onScanAnother,
}) => {
  const { extracted, expiry, registration } = result;
  const t = TRANSLATIONS[language];

  const [translation, setTranslation] = useState<TranslationResult | null>(result.translation || null);
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState<boolean>(false);

  // Fetch Luganda translation when language is switched to Luganda
  useEffect(() => {
    if (language === 'lug' && !translation && extracted.plain_explanation_en) {
      let isMounted = true;
      setIsTranslating(true);
      fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: extracted.plain_explanation_en }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (isMounted && data.success && data.translation) {
            setTranslation(data.translation);
          }
        })
        .catch((err) => {
          console.error('Translation error:', err);
        })
        .finally(() => {
          if (isMounted) setIsTranslating(false);
        });

      return () => {
        isMounted = false;
      };
    }
  }, [language, translation, extracted.plain_explanation_en]);

  // Ingredients string
  const ingredientsString = extracted.active_ingredients.length > 0
    ? extracted.active_ingredients
        .map((i) => `${i.name}${i.strength ? ` ${i.strength}` : ''}`)
        .join(', ')
    : null;

  // 1. Expiry status chip configuration (Colour + Icon + Word)
  const getExpiryChip = () => {
    switch (expiry.status) {
      case 'expired':
        return {
          icon: <XCircle className="w-5 h-5 text-red-600 shrink-0" />,
          word: t.statusExpired,
          chipStyle: 'bg-red-50 text-red-700 border-red-200',
          textColor: 'text-red-700',
        };
      case 'expiring_soon':
        return {
          icon: <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />,
          word: t.statusExpiresSoon,
          chipStyle: 'bg-amber-50 text-amber-800 border-amber-200',
          textColor: 'text-amber-800',
        };
      case 'valid':
        return {
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />,
          word: t.statusValid,
          chipStyle: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          textColor: 'text-emerald-800',
        };
      case 'not_found':
      default:
        return {
          icon: <HelpCircle className="w-5 h-5 text-slate-500 shrink-0" />,
          word: t.statusNotFound,
          chipStyle: 'bg-slate-100 text-slate-700 border-slate-200',
          textColor: 'text-slate-700',
        };
    }
  };

  // 2. Registration status chip configuration (Colour + Icon + Word)
  const getRegistrationChip = () => {
    switch (registration.status) {
      case 'matched':
        return {
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />,
          word: t.statusRegistered,
          chipStyle: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          subtitle: registration.matchedProductName || registration.rawRegistrationNumber,
        };
      case 'not_in_list':
        return {
          icon: <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />,
          word: t.statusNotInList,
          chipStyle: 'bg-amber-50 text-amber-800 border-amber-200',
          subtitle: language === 'lug'
            ? 'Teriri mu lukalala lwa NDA. Weebuuze ku musawo.'
            : 'Not in demo list. Check with NDA or a pharmacist.',
        };
      case 'not_printed':
      default:
        return {
          icon: <HelpCircle className="w-5 h-5 text-slate-500 shrink-0" />,
          word: t.statusNotPrinted,
          chipStyle: 'bg-slate-100 text-slate-700 border-slate-200',
          subtitle: language === 'lug' ? 'Tekiwanndiikiddwa' : 'Not visible on label',
        };
    }
  };

  const expChip = getExpiryChip();
  const regChip = getRegistrationChip();

  return (
    <div className="w-full flex flex-col pt-2 pb-28">
      {/* Top: Product Name and Strength */}
      <div className="mb-5">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
          {extracted.product_name || t.medicineIdentified}
        </h1>
        {ingredientsString && (
          <p className="mt-1 text-[17px] font-semibold text-emerald-700 leading-snug">
            {ingredientsString}
          </p>
        )}
      </div>

      {/* Two Status Chips: Expiry and Registration (Colour + Icon + Word) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        {/* Expiry Chip */}
        <div className={`p-3.5 rounded-2xl border flex flex-col justify-between ${expChip.chipStyle}`}>
          <div className="flex items-center gap-2 mb-1.5">
            {expChip.icon}
            <span className="font-bold text-[17px] leading-none">
              {expChip.word}
            </span>
          </div>
          <p className="text-sm font-medium text-slate-700 mt-1 leading-snug">
            {expiry.words}
          </p>
        </div>

        {/* Registration Chip */}
        <div className={`p-3.5 rounded-2xl border flex flex-col justify-between ${regChip.chipStyle}`}>
          <div className="flex items-center gap-2 mb-1.5">
            {regChip.icon}
            <span className="font-bold text-[17px] leading-none">
              {regChip.word}
            </span>
          </div>
          <p className="text-sm font-medium text-slate-700 mt-1 leading-snug">
            {regChip.subtitle}
          </p>
        </div>
      </div>

      {/* Plain Language Explanation (At least 17px body font, short sentences) */}
      <div className="mb-6 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
        {language === 'en' ? (
          <p className="text-[17px] text-slate-800 leading-relaxed font-normal">
            {extracted.plain_explanation_en}
          </p>
        ) : isTranslating ? (
          <div className="flex items-center gap-2.5 py-3 text-emerald-700">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-[17px] font-medium">Tuvvuunula mu Luganda...</span>
          </div>
        ) : (
          <div>
            <p className="text-[17px] text-slate-800 leading-relaxed font-normal">
              {translation?.lugandaText || extracted.plain_explanation_en}
            </p>
            <p className="mt-2.5 text-xs text-slate-400 italic">
              {translation?.note || t.machineTranslationNote}
            </p>
          </div>
        )}
      </div>

      {/* Collapsible "What the label says" Section */}
      <div className="mb-6 border-t border-slate-200 pt-4">
        <button
          type="button"
          onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}
          className="w-full flex items-center justify-between py-2 text-left font-bold text-[17px] text-slate-800 hover:text-emerald-700 transition-colors"
          aria-expanded={isDetailsExpanded}
        >
          <span>{isDetailsExpanded ? t.hideLabelSays : t.whatLabelSays}</span>
          {isDetailsExpanded ? (
            <ChevronUp className="w-5 h-5 text-slate-500" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-500" />
          )}
        </button>

        {isDetailsExpanded && (
          <div className="mt-3 bg-slate-50 rounded-2xl p-4 border border-slate-200 text-sm space-y-2.5">
            <div className="flex flex-col py-1 border-b border-slate-200/60">
              <span className="font-semibold text-slate-500 text-xs">{t.activeIngredients}</span>
              <span className="text-slate-800 font-medium">
                {ingredientsString || t.notVisible}
              </span>
            </div>

            <div className="flex flex-col py-1 border-b border-slate-200/60">
              <span className="font-semibold text-slate-500 text-xs">{t.dosageForm}</span>
              <span className="text-slate-800 font-medium">{extracted.dosage_form || t.notVisible}</span>
            </div>

            <div className="flex flex-col py-1 border-b border-slate-200/60">
              <span className="font-semibold text-slate-500 text-xs">{t.manufacturer}</span>
              <span className="text-slate-800 font-medium">{extracted.manufacturer || t.notVisible}</span>
            </div>

            <div className="flex flex-col py-1 border-b border-slate-200/60">
              <span className="font-semibold text-slate-500 text-xs">{t.batchNumber}</span>
              <span className="text-slate-800 font-mono font-medium">{extracted.batch_number || t.notVisible}</span>
            </div>

            <div className="flex flex-col py-1 border-b border-slate-200/60">
              <span className="font-semibold text-slate-500 text-xs">{t.expiryDate}</span>
              <span className="text-slate-800 font-mono font-medium">{extracted.expiry_date_raw || t.notVisible}</span>
            </div>

            <div className="flex flex-col py-1 border-b border-slate-200/60">
              <span className="font-semibold text-slate-500 text-xs">{t.registrationNumber}</span>
              <span className="text-slate-800 font-mono font-medium">{extracted.registration_number || t.notVisible}</span>
            </div>

            <div className="flex flex-col py-1 border-b border-slate-200/60">
              <span className="font-semibold text-slate-500 text-xs">{t.directions}</span>
              <span className="text-slate-800 font-medium">{extracted.printed_directions || t.nonePrinted}</span>
            </div>

            <div className="flex flex-col py-1">
              <span className="font-semibold text-slate-500 text-xs">{t.warnings}</span>
              {extracted.printed_warnings.length > 0 ? (
                <ul className="list-disc list-inside text-red-800 font-medium space-y-1 mt-0.5">
                  {extracted.printed_warnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              ) : (
                <span className="text-slate-500 italic">{t.nonePrinted}</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Safety Line */}
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center">
        <p className="text-sm font-medium text-slate-600 leading-snug">
          {t.safetyDisclaimer}
        </p>
      </div>

      {/* Pinned Bottom Button: "Scan another label" (stays pinned to the bottom of the screen) */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-sm border-t border-slate-200 z-20">
        <div className="w-full max-w-[390px] mx-auto">
          <button
            type="button"
            onClick={onScanAnother}
            className="w-full min-h-[56px] bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-lg rounded-2xl flex items-center justify-center gap-2 shadow-xs transition-colors"
          >
            <Camera className="w-5 h-5 text-white" />
            <span>{t.scanAnotherButton}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
