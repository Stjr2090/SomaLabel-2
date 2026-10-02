import React from 'react';
import { RotateCcw } from 'lucide-react';
import { Language, TRANSLATIONS } from '../lib/translations.ts';
import { DebugPanel } from './DebugPanel.tsx';
import { isDebugMode } from '../lib/debug.ts';

export type ErrorType = 'blurry' | 'not_medicine' | 'api_error' | 'connection' | 'gemma_rejection' | 'parse_error' | 'rate_limited' | 'service';

interface ErrorCardProps {
  type: ErrorType;
  language: Language;
  onAction: () => void;
  customMessage?: string | null;
  rawApiError?: string | null;
  rawModelText?: string | null;
}

export const ErrorCard: React.FC<ErrorCardProps> = ({
  type,
  language,
  onAction,
  customMessage,
  rawApiError,
  rawModelText,
}) => {
  const t = TRANSLATIONS[language];

  const getErrorContent = () => {
    switch (type) {
      case 'blurry':
        return {
          sentence: t.errorBlurryMessage,
          action: t.errorBlurryAction,
        };
      case 'not_medicine':
        return {
          sentence: t.errorNotMedicineMessage,
          action: t.errorNotMedicineAction,
        };
      case 'gemma_rejection':
        return {
          sentence: customMessage || t.errorGemmaRejectionMessage,
          action: t.errorGemmaRejectionAction,
        };
      case 'parse_error':
        return {
          sentence: customMessage || 'Model response was not valid JSON.',
          action: t.errorConnectionAction,
        };
      case 'api_error':
        return {
          sentence: customMessage || t.errorConnectionMessage,
          action: t.errorConnectionAction,
        };
      case 'rate_limited':
        return {
          sentence: t.errorRateLimitedMessage,
          action: t.errorConnectionAction,
        };
      case 'service':
        return {
          sentence: t.errorServiceMessage,
          action: t.errorConnectionAction,
        };
      case 'connection':
      default:
        return {
          sentence: customMessage || t.errorConnectionMessage,
          action: t.errorConnectionAction,
        };
    }
  };

  const content = getErrorContent();

  return (
    <div className="w-full flex flex-col items-center text-center py-8 px-2">
      {/* Real error or blurry message: friendly, one sentence */}
      <p className="text-[19px] font-semibold text-slate-800 leading-snug mb-8 max-w-[340px]">
        {content.sentence}
      </p>

      {/* One action button (min-h-[56px]) */}
      <div className="w-full">
        <button
          type="button"
          onClick={onAction}
          className="w-full min-h-[56px] bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-lg rounded-2xl flex items-center justify-center gap-2 transition-colors shadow-xs"
        >
          <RotateCcw className="w-5 h-5 text-white" />
          <span>{content.action}</span>
        </button>
      </div>

      {/* Collapsible Debug Panel showing raw API error and raw model text (debug mode only) */}
      {isDebugMode() && (
        <DebugPanel
          rawApiError={rawApiError}
          rawModelText={rawModelText}
        />
      )}
    </div>
  );
};
